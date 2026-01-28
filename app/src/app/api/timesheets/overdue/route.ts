import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { timesheetSubmissions, users, leavePeriods } from "@/lib/schema";
import { requireAuth, getUserFromSession, hasAdminAccess, requiresTimesheetSubmission } from "@/lib/api-utils";
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

      // Filter to only positions required to submit timesheets
      const usersRequiringSubmission = activeUsers.filter(u =>
        requiresTimesheetSubmission(u.position)
      );

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

      // Get all approved leave periods for relevant users
      const allLeave = await db.query.leavePeriods.findMany({
        where: eq(leavePeriods.status, "APPROVED"),
        columns: { userId: true, startDate: true, endDate: true },
      });

      // Group leave by user
      const leaveByUser = new Map<string, { startDate: string; endDate: string }[]>();
      for (const leave of allLeave) {
        if (!leaveByUser.has(leave.userId)) {
          leaveByUser.set(leave.userId, []);
        }
        leaveByUser.get(leave.userId)!.push({ startDate: leave.startDate, endDate: leave.endDate });
      }

      // Calculate overdue for each user
      const overdueByUser: UserOverdue[] = [];
      for (const u of usersRequiringSubmission) {
        const userSubmissions = submissionsByUser.get(u.id) || new Set<string>();
        const userLeave = leaveByUser.get(u.id) || [];
        const overdueDates = getOverdueDates(now, userSubmissions, DEFAULT_LOOKBACK_DAYS, userLeave);

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

    // 4. Regular user: check if required to submit
    if (!requiresTimesheetSubmission(user.position)) {
      return NextResponse.json({ overdue: [] });
    }

    // 5. Get own submissions and calculate overdue
    const userSubmissions = await db.query.timesheetSubmissions.findMany({
      where: and(
        eq(timesheetSubmissions.userId, user.id),
        gte(timesheetSubmissions.date, lookbackStartISO)
      ),
      columns: { date: true },
    });

    // Get user's approved leave periods
    const userLeave = await db.query.leavePeriods.findMany({
      where: and(
        eq(leavePeriods.userId, user.id),
        eq(leavePeriods.status, "APPROVED")
      ),
      columns: { startDate: true, endDate: true },
    });

    const submittedDates = new Set(userSubmissions.map((s) => s.date));
    const overdueDates = getOverdueDates(now, submittedDates, DEFAULT_LOOKBACK_DAYS, userLeave);

    return NextResponse.json({ overdue: overdueDates });
  } catch (error) {
    console.error("Database error fetching overdue dates:", error);
    return NextResponse.json(
      { error: "Failed to fetch overdue dates" },
      { status: 500 }
    );
  }
}
