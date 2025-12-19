import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getToken } from "next-auth/jwt";

async function requireAuth(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return { session };
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) {
    return { session: { user: { name: token.name, email: token.email } } };
  }

  return { error: "Unauthorized", status: 401 };
}

async function getUserFromSession(email: string | null | undefined) {
  if (!email) return null;

  return db.user.findUnique({
    where: { email },
    select: { id: true },
  });
}

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

  // Get first and last day of the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month

  try {
    const entries = await db.timeEntry.findMany({
      where: {
        userId: user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
      },
      distinct: ["date"],
    });

    // Return array of date strings (YYYY-MM-DD)
    const dates = entries.map((e) => e.date.toISOString().split("T")[0]);

    return NextResponse.json(dates);
  } catch (error) {
    console.error("Database error fetching dates:", error);
    return NextResponse.json(
      { error: "Failed to fetch dates" },
      { status: 500 }
    );
  }
}
