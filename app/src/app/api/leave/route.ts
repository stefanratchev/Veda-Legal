import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leavePeriods } from "@/lib/schema";
import { requireAuth, getUserFromSession, errorResponse, hasAdminAccess } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return errorResponse("User not found", 404);
  }

  const searchParams = request.nextUrl.searchParams;
  const statusFilter = searchParams.get("status");
  const userIdFilter = searchParams.get("userId");

  try {
    const isAdmin = hasAdminAccess(user.position);

    // Build where clause
    const conditions = [];

    if (!isAdmin) {
      // Regular users can only see their own leave
      conditions.push(eq(leavePeriods.userId, user.id));
    } else if (userIdFilter) {
      // Admin filtering by specific user
      conditions.push(eq(leavePeriods.userId, userIdFilter));
    }

    if (statusFilter && ["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)) {
      conditions.push(eq(leavePeriods.status, statusFilter as "PENDING" | "APPROVED" | "REJECTED"));
    }

    const results = await db.query.leavePeriods.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        user: { columns: { name: true } },
        reviewedBy: { columns: { name: true } },
      },
      orderBy: [desc(leavePeriods.createdAt)],
    });

    // Transform for response
    const leavePeriodsList = results.map((lp) => ({
      id: lp.id,
      userId: lp.userId,
      userName: lp.user?.name || null,
      startDate: lp.startDate,
      endDate: lp.endDate,
      leaveType: lp.leaveType,
      status: lp.status,
      reason: lp.reason,
      reviewedById: lp.reviewedById,
      reviewedByName: lp.reviewedBy?.name || null,
      reviewedAt: lp.reviewedAt,
      rejectionReason: lp.rejectionReason,
      createdAt: lp.createdAt,
    }));

    return NextResponse.json({ leavePeriods: leavePeriodsList });
  } catch (error) {
    console.error("Error fetching leave periods:", error);
    return errorResponse("Failed to fetch leave periods", 500);
  }
}
