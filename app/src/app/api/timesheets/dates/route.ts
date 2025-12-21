import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireAuth, isAdmin, errorResponse, successResponse } from "@/lib/auth-utils";

// GET /api/timesheets/dates?year=2024&month=12 - Get dates with entries for a month
// ADMIN: sees all dates with entries, EMPLOYEE: sees only dates with own entries
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  if (!yearParam || !monthParam) {
    return errorResponse("Year and month parameters are required", 400);
  }

  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return errorResponse("Invalid year or month", 400);
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  try {
    // ADMIN sees all dates with entries, EMPLOYEE sees only their own
    const whereClause: Prisma.TimeEntryWhereInput = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };
    if (!isAdmin(auth.user.role)) {
      whereClause.userId = auth.user.id;
    }

    const entries = await db.timeEntry.findMany({
      where: whereClause,
      select: { date: true },
      distinct: ["date"],
    });

    const dates = entries.map((e) => e.date.toISOString().split("T")[0]);

    return successResponse(dates);
  } catch (error) {
    console.error("Database error fetching dates:", error);
    return errorResponse("Failed to fetch dates", 500);
  }
}
