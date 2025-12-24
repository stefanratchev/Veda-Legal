import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeEntries } from "@/lib/schema";
import { requireAuth, getUserFromSession } from "@/lib/api-utils";

// GET /api/timesheets/dates?year=2024&month=12 - Get dates with entries for a month
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
    return NextResponse.json({ error: "Year and month parameters are required" }, { status: 400 });
  }

  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  // Get first and last day of the month as date strings (YYYY-MM-DD)
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  try {
    const entries = await db
      .selectDistinct({ date: timeEntries.date })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, user.id),
          gte(timeEntries.date, startDate),
          lte(timeEntries.date, endDate)
        )
      );

    // Return array of date strings (already in YYYY-MM-DD format from schema)
    const dates = entries.map((e) => e.date);

    return NextResponse.json(dates);
  } catch (error) {
    console.error("Database error fetching dates:", error);
    return NextResponse.json(
      { error: "Failed to fetch dates" },
      { status: 500 }
    );
  }
}
