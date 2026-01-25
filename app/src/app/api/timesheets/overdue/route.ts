import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { timesheetSubmissions, users } from "@/lib/schema";
import { requireAuth, getUserFromSession, hasAdminAccess } from "@/lib/api-utils";
import { getOverdueDates, DEFAULT_LOOKBACK_DAYS } from "@/lib/submission-utils";
import { formatDateISO } from "@/lib/date-utils";

interface UserOverdue {
  userId: string;
  name: string;
  dates: string[];
}

export async function GET(request: NextRequest) {
  // 1. Auth check
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // 2. Get user from session
  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const now = new Date();
  const lookbackStart = new Date(now);
  lookbackStart.setDate(lookbackStart.getDate() - DEFAULT_LOOKBACK_DAYS);
  const lookbackStartISO = formatDateISO(lookbackStart);

  try {
    // 3. Check if admin/partner
    if (hasAdminAccess(user.position)) {
      // Get all active users
      const activeUsers = await db.query.users.findMany({
        where: eq(users.status, "ACTIVE"),
        columns: { id: true, name: true, email: true, position: true },
      });

      // Get all submissions in the lookback period for all users
      const allSubmissions = await db.query.timesheetSubmissions.findMany({
        where: gte(timesheetSubmissions.date, lookbackStartISO),
        columns: { userId: true, date: true },
      });

      // Group submissions by user
      const submissionsByUser = new Map<string, Set<string>>();
      for (const sub of allSubmissions) {
        if (!submissionsByUser.has(sub.userId)) {
          submissionsByUser.set(sub.userId, new Set());
        }
        submissionsByUser.get(sub.userId)!.add(sub.date);
      }

      // Calculate overdue for each user
      const overdueByUser: UserOverdue[] = [];
      for (const u of activeUsers) {
        const userSubmissions = submissionsByUser.get(u.id) || new Set<string>();
        const overdueDates = getOverdueDates(now, userSubmissions, DEFAULT_LOOKBACK_DAYS);

        if (overdueDates.length > 0) {
          overdueByUser.push({
            userId: u.id,
            name: u.name || u.email,
            dates: overdueDates,
          });
        }
      }

      return NextResponse.json({ overdue: overdueByUser });
    }

    // 4. Regular user: get own submissions and calculate overdue
    const userSubmissions = await db.query.timesheetSubmissions.findMany({
      where: and(
        eq(timesheetSubmissions.userId, user.id),
        gte(timesheetSubmissions.date, lookbackStartISO)
      ),
      columns: { date: true },
    });

    const submittedDates = new Set(userSubmissions.map((s) => s.date));
    const overdueDates = getOverdueDates(now, submittedDates, DEFAULT_LOOKBACK_DAYS);

    return NextResponse.json({ overdue: overdueDates });
  } catch (error) {
    console.error("Database error fetching overdue dates:", error);
    return NextResponse.json(
      { error: "Failed to fetch overdue dates" },
      { status: 500 }
    );
  }
}
