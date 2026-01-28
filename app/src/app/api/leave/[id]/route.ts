import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leavePeriods } from "@/lib/schema";
import { requireAuth, getUserFromSession, errorResponse, hasAdminAccess, parseDate } from "@/lib/api-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return errorResponse("User not found", 404);
  }

  const { id } = await context.params;

  let body: {
    startDate?: string;
    endDate?: string;
    leaveType?: string;
    reason?: string;
    status?: string;
    rejectionReason?: string;
  };

  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  try {
    const existing = await db.query.leavePeriods.findFirst({
      where: eq(leavePeriods.id, id),
    });

    if (!existing) {
      return errorResponse("Leave period not found", 404);
    }

    const isAdmin = hasAdminAccess(user.position);
    const isOwner = existing.userId === user.id;

    // Non-admin can only edit their own pending leave
    if (!isAdmin) {
      if (!isOwner) {
        return errorResponse("Cannot modify another user's leave", 403);
      }
      if (existing.status !== "PENDING") {
        return errorResponse("Can only edit pending leave requests", 403);
      }
      // Non-admin cannot change status
      if (body.status) {
        return errorResponse("Cannot change leave status", 403);
      }
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    // Handle status changes (admin only)
    if (body.status && isAdmin) {
      if (!["PENDING", "APPROVED", "REJECTED"].includes(body.status)) {
        return errorResponse("Invalid status", 400);
      }
      updates.status = body.status;
      updates.reviewedById = user.id;
      updates.reviewedAt = new Date().toISOString();

      if (body.status === "REJECTED" && body.rejectionReason) {
        updates.rejectionReason = body.rejectionReason;
      }
    }

    // Handle field updates (owner of pending, or admin)
    if (body.startDate) {
      const parsed = parseDate(body.startDate);
      if (!parsed) return errorResponse("Invalid startDate format", 400);
      updates.startDate = body.startDate;
    }

    if (body.endDate) {
      const parsed = parseDate(body.endDate);
      if (!parsed) return errorResponse("Invalid endDate format", 400);
      updates.endDate = body.endDate;
    }

    if (body.leaveType) {
      if (!["VACATION", "SICK_LEAVE", "MATERNITY_PATERNITY"].includes(body.leaveType)) {
        return errorResponse("Invalid leaveType", 400);
      }
      updates.leaveType = body.leaveType;
    }

    if (body.reason !== undefined) {
      updates.reason = body.reason || null;
    }

    const [updated] = await db
      .update(leavePeriods)
      .set(updates)
      .where(eq(leavePeriods.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating leave period:", error);
    return errorResponse("Failed to update leave period", 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return errorResponse("User not found", 404);
  }

  const { id } = await context.params;

  try {
    const existing = await db.query.leavePeriods.findFirst({
      where: eq(leavePeriods.id, id),
    });

    if (!existing) {
      return errorResponse("Leave period not found", 404);
    }

    const isAdmin = hasAdminAccess(user.position);
    const isOwner = existing.userId === user.id;

    // Non-admin can only delete their own pending leave
    if (!isAdmin) {
      if (!isOwner) {
        return errorResponse("Cannot delete another user's leave", 403);
      }
      if (existing.status !== "PENDING") {
        return errorResponse("Can only delete pending leave requests", 403);
      }
    }

    await db.delete(leavePeriods).where(eq(leavePeriods.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting leave period:", error);
    return errorResponse("Failed to delete leave period", 500);
  }
}
