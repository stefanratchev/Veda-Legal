import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireAuth, isAdmin, errorResponse, successResponse } from "@/lib/auth-utils";

const TIMEENTRY_SELECT = {
  id: true,
  date: true,
  hours: true,
  description: true,
  clientId: true,
  userId: true,
  user: {
    select: {
      id: true,
      name: true,
    },
  },
  client: {
    select: {
      id: true,
      name: true,
      timesheetCode: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

function serializeTimeEntry<T extends { hours: Prisma.Decimal; date: Date }>(entry: T) {
  return {
    ...entry,
    hours: Number(entry.hours),
    date: entry.date.toISOString().split("T")[0],
  };
}

// GET /api/timesheets?date=YYYY-MM-DD - List entries for a date
// ADMIN: sees all entries, EMPLOYEE: sees only own entries
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  if (!dateParam) {
    return errorResponse("Date parameter is required", 400);
  }

  const date = new Date(dateParam);
  if (isNaN(date.getTime())) {
    return errorResponse("Invalid date format", 400);
  }

  try {
    // ADMIN sees all entries, EMPLOYEE sees only their own
    const whereClause: Prisma.TimeEntryWhereInput = { date };
    if (!isAdmin(auth.user.role)) {
      whereClause.userId = auth.user.id;
    }

    const entries = await db.timeEntry.findMany({
      where: whereClause,
      select: TIMEENTRY_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return successResponse(entries.map(serializeTimeEntry));
  } catch (error) {
    console.error("Database error fetching time entries:", error);
    return errorResponse("Failed to fetch time entries", 500);
  }
}

// POST /api/timesheets - Create time entry
// ADMIN: can create for any user (optional userId param), EMPLOYEE: creates for self only
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { date, clientId, hours, description, userId: targetUserId } = body;

  // Determine which user the entry is for
  let entryUserId = auth.user.id;
  if (targetUserId && isAdmin(auth.user.role)) {
    // Admin can create entries for other users
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!targetUser) {
      return errorResponse("Target user not found", 404);
    }
    entryUserId = targetUserId;
  } else if (targetUserId && targetUserId !== auth.user.id) {
    // Non-admin trying to create for another user
    return errorResponse("You can only create entries for yourself", 403);
  }

  // Validate date
  if (!date) {
    return errorResponse("Date is required", 400);
  }
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return errorResponse("Invalid date format", 400);
  }

  // Don't allow future dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (parsedDate > today) {
    return errorResponse("Cannot log time for future dates", 400);
  }

  // Validate client
  if (!clientId) {
    return errorResponse("Client is required", 400);
  }
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, status: true },
  });
  if (!client) {
    return errorResponse("Client not found", 404);
  }
  if (client.status !== "ACTIVE") {
    return errorResponse("Cannot log time for inactive clients", 400);
  }

  // Validate hours
  if (hours === undefined || hours === null) {
    return errorResponse("Hours is required", 400);
  }
  const hoursNum = Number(hours);
  if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 12) {
    return errorResponse("Hours must be between 0 and 12", 400);
  }

  // Validate description
  if (!description || typeof description !== "string") {
    return errorResponse("Description is required", 400);
  }
  if (description.trim().length < 10) {
    return errorResponse("Description must be at least 10 characters", 400);
  }

  try {
    const entry = await db.timeEntry.create({
      data: {
        date: parsedDate,
        hours: new Prisma.Decimal(hoursNum),
        description: description.trim(),
        userId: entryUserId,
        clientId: clientId,
      },
      select: TIMEENTRY_SELECT,
    });

    return successResponse(serializeTimeEntry(entry));
  } catch (error) {
    console.error("Database error creating time entry:", error);
    return errorResponse("Failed to create time entry", 500);
  }
}

// PATCH /api/timesheets - Update time entry
// ADMIN: can update any entry, EMPLOYEE: can update only own entries
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { id, clientId, hours, description } = body;

  if (!id) {
    return errorResponse("Entry ID is required", 400);
  }

  // Verify the entry exists
  const existingEntry = await db.timeEntry.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existingEntry) {
    return errorResponse("Entry not found", 404);
  }

  // Check ownership (ADMIN can edit any, EMPLOYEE only their own)
  if (!isAdmin(auth.user.role) && existingEntry.userId !== auth.user.id) {
    return errorResponse("You can only edit your own entries", 403);
  }

  // Build update data
  const updateData: Prisma.TimeEntryUpdateInput = {};

  if (clientId !== undefined) {
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true, status: true },
    });
    if (!client) {
      return errorResponse("Client not found", 404);
    }
    if (client.status !== "ACTIVE") {
      return errorResponse("Cannot log time for inactive clients", 400);
    }
    updateData.client = { connect: { id: clientId } };
  }

  if (hours !== undefined) {
    const hoursNum = Number(hours);
    if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 12) {
      return errorResponse("Hours must be between 0 and 12", 400);
    }
    updateData.hours = new Prisma.Decimal(hoursNum);
  }

  if (description !== undefined) {
    if (typeof description !== "string" || description.trim().length < 10) {
      return errorResponse("Description must be at least 10 characters", 400);
    }
    updateData.description = description.trim();
  }

  try {
    const entry = await db.timeEntry.update({
      where: { id },
      data: updateData,
      select: TIMEENTRY_SELECT,
    });

    return successResponse(serializeTimeEntry(entry));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return errorResponse("Entry not found", 404);
    }
    console.error("Database error updating time entry:", error);
    return errorResponse("Failed to update time entry", 500);
  }
}

// DELETE /api/timesheets?id=xxx - Delete time entry
// ADMIN: can delete any entry, EMPLOYEE: can delete only own entries
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return errorResponse("Entry ID is required", 400);
  }

  try {
    await db.$transaction(async (tx) => {
      const existingEntry = await tx.timeEntry.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!existingEntry) {
        throw new Error("NOT_FOUND");
      }

      // Check ownership (ADMIN can delete any, EMPLOYEE only their own)
      if (!isAdmin(auth.user.role) && existingEntry.userId !== auth.user.id) {
        throw new Error("FORBIDDEN");
      }

      await tx.timeEntry.delete({ where: { id } });
    });

    return successResponse({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return errorResponse("Entry not found", 404);
      }
      if (error.message === "FORBIDDEN") {
        return errorResponse("You can only delete your own entries", 403);
      }
    }
    console.error("Database error deleting time entry:", error);
    return errorResponse("Failed to delete time entry", 500);
  }
}
