import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-utils";
import { getTrendData } from "@/lib/trend-utils";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const data = await getTrendData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch trend data:", error);
    return NextResponse.json(
      { error: "Failed to fetch trend data", code: "TREND_FETCH_FAILED" },
      { status: 500 }
    );
  }
}
