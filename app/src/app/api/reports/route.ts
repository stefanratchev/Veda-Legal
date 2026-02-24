import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireAuth } from "@/lib/api-utils";
import { getReportData } from "@/lib/report-utils";

// GET /api/reports?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, auth.session.user?.email || ""),
    columns: { id: true, email: true, name: true, position: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isAdmin = ["ADMIN", "PARTNER"].includes(user.position);

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  if (start > end) {
    return NextResponse.json({ error: "startDate must be before or equal to endDate" }, { status: 400 });
  }

  try {
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    const response = await getReportData({
      startDate: startStr,
      endDate: endStr,
      userId: user.id,
      isAdmin,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Database error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}
