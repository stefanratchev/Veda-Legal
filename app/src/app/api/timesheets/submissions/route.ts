import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { timesheetSubmissions } from "@/lib/schema";
import { requireAuth, getUserFromSession } from "@/lib/api-utils";

// GET /api/timesheets/submissions?year=YYYY&month=MM - Get submitted dates for a month
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  if (!yearParam || !monthParam) {
    return NextResponse.json({ error: "Year and month are required" }, { status: 400 });
  }

  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  // Get first and last day of month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  try {
    const submissions = await db.query.timesheetSubmissions.findMany({
      where: and(
        eq(timesheetSubmissions.userId, user.id),
        gte(timesheetSubmissions.date, startDate),
        lte(timesheetSubmissions.date, endDate)
      ),
      columns: { date: true },
    });

    return NextResponse.json(submissions.map((s) => s.date));
  } catch (error) {
    console.error("Database error fetching submissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}
