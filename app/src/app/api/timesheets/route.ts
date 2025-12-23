import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  requireAuth,
  getUserFromSession,
  errorResponse,
  isValidHours,
  isNotFutureDate,
  MAX_HOURS_PER_ENTRY,
} from "@/lib/api-utils";

const TIMEENTRY_SELECT = {
  id: true,
  date: true,
  hours: true,
  description: true,
  clientId: true,
  client: {
    select: {
      id: true,
      name: true,
    },
  },
  subtopicId: true,
  topicName: true,
  subtopicName: true,
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
  const dateParam = searchParams.get("date");

  if (!dateParam) {
    return NextResponse.json({ error: "Date parameter is required" }, { status: 400 });
  }

  // Parse the date
  const date = new Date(dateParam);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    const entries = await db.timeEntry.findMany({
      where: {
        userId: user.id,
        date: date,
      },
      select: TIMEENTRY_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(entries.map(serializeTimeEntry));
  } catch (error) {
    console.error("Database error fetching time entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch time entries" },
      { status: 500 }
    );
  }
}

// POST /api/timesheets - Create time entry
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, clientId, subtopicId, hours, description } = body;

  // Validate date
  if (!date) {
    return errorResponse("Date is required", 400);
  }
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return errorResponse("Invalid date format", 400);
  }

  // Don't allow future dates
  if (!isNotFutureDate(parsedDate)) {
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

  // Validate subtopic (required for new entries)
  if (!subtopicId) {
    return errorResponse("Subtopic is required", 400);
  }
  const subtopic = await db.subtopic.findUnique({
    where: { id: subtopicId },
    include: {
      topic: {
        select: { name: true, status: true },
      },
    },
  });
  if (!subtopic) {
    return errorResponse("Subtopic not found", 404);
  }
  if (subtopic.status !== "ACTIVE") {
    return errorResponse("Cannot log time with inactive subtopic", 400);
  }
  if (subtopic.topic.status !== "ACTIVE") {
    return errorResponse("Cannot log time with inactive topic", 400);
  }

  // Validate hours
  if (hours === undefined || hours === null) {
    return errorResponse("Hours is required", 400);
  }
  const hoursNum = Number(hours);
  if (!isValidHours(hoursNum)) {
    return errorResponse(`Hours must be between 0 and ${MAX_HOURS_PER_ENTRY}`, 400);
  }

  // Validate description (no minimum length required)
  if (description !== undefined && typeof description !== "string") {
    return errorResponse("Description must be a string", 400);
  }

  try {
    const entry = await db.timeEntry.create({
      data: {
        date: parsedDate,
        hours: new Prisma.Decimal(hoursNum),
        description: (description || "").trim(),
        userId: user.id,
        clientId: clientId,
        subtopicId: subtopicId,
        topicName: subtopic.topic.name,
        subtopicName: subtopic.name,
      },
      select: TIMEENTRY_SELECT,
    });

    return NextResponse.json(serializeTimeEntry(entry));
  } catch (error) {
    console.error("Database error creating time entry:", error);
    return NextResponse.json(
      { error: "Failed to create time entry" },
      { status: 500 }
    );
  }
}

// DELETE /api/timesheets?id=xxx - Delete time entry
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });
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

      if (existingEntry.userId !== user.id) {
        throw new Error("FORBIDDEN");
      }

      await tx.timeEntry.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "You can only delete your own entries" }, { status: 403 });
      }
    }
    console.error("Database error deleting time entry:", error);
    return NextResponse.json(
      { error: "Failed to delete time entry" },
      { status: 500 }
    );
  }
}
