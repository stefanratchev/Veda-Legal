import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leavePeriods } from "@/lib/schema";
import { requireAuth, getUserFromSession, errorResponse, hasAdminAccess, parseDate } from "@/lib/api-utils";
import { createId } from "@paralleldrive/cuid2";

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

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return errorResponse("User not found", 404);
  }

  let body: {
    startDate?: string;
    endDate?: string;
    leaveType?: string;
    reason?: string;
    userId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  // Validate required fields
  if (!body.startDate || !body.endDate) {
    return errorResponse("startDate and endDate are required", 400);
  }

  if (!body.leaveType || !["VACATION", "SICK_LEAVE", "MATERNITY_PATERNITY"].includes(body.leaveType)) {
    return errorResponse("Valid leaveType is required (VACATION, SICK_LEAVE, MATERNITY_PATERNITY)", 400);
  }

  // Validate dates
  const startDate = parseDate(body.startDate);
  const endDate = parseDate(body.endDate);

  if (!startDate || !endDate) {
    return errorResponse("Invalid date format", 400);
  }

  if (startDate > endDate) {
    return errorResponse("startDate must be before or equal to endDate", 400);
  }

  const isAdmin = hasAdminAccess(user.position);
  const targetUserId = (isAdmin && body.userId) ? body.userId : user.id;
  const isAutoApproved = isAdmin && body.userId && body.userId !== user.id;

  try {
    // Check for overlapping leave periods
    const existingLeave = await db.query.leavePeriods.findMany({
      where: eq(leavePeriods.userId, targetUserId),
    });

    const hasOverlap = existingLeave.some((lp) => {
      if (lp.status === "REJECTED") return false;
      const lpStart = new Date(lp.startDate);
      const lpEnd = new Date(lp.endDate);
      return startDate <= lpEnd && endDate >= lpStart;
    });

    if (hasOverlap) {
      return errorResponse("Leave period overlaps with existing leave", 400);
    }

    const now = new Date().toISOString();
    const [created] = await db
      .insert(leavePeriods)
      .values({
        id: createId(),
        userId: targetUserId,
        startDate: body.startDate,
        endDate: body.endDate,
        leaveType: body.leaveType as "VACATION" | "SICK_LEAVE" | "MATERNITY_PATERNITY",
        status: isAutoApproved ? "APPROVED" : "PENDING",
        reason: body.reason || null,
        reviewedById: isAutoApproved ? user.id : null,
        reviewedAt: isAutoApproved ? now : null,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating leave period:", error);
    return errorResponse("Failed to create leave period", 500);
  }
}
