import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { timeEntries, clients, subtopics, users } from "@/lib/schema";
import {
  requireAuth,
  getUserFromSession,
  errorResponse,
  serializeDecimal,
  isValidHours,
  isNotFutureDate,
  MAX_HOURS_PER_ENTRY,
  canViewTeamTimesheets,
} from "@/lib/api-utils";

function serializeTimeEntry(entry: {
  id: string;
  date: string;
  hours: string;
  description: string;
  clientId: string;
  client: { id: string; name: string } | null;
  subtopicId: string | null;
  topicName: string;
  subtopicName: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    ...entry,
    hours: serializeDecimal(entry.hours),
    // date is already a string in Drizzle
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

  // Format date as YYYY-MM-DD for comparison (Drizzle stores date as string)
  const dateStr = date.toISOString().split("T")[0];

  try {
    // Fetch current user's entries
    const entries = await db.query.timeEntries.findMany({
      where: and(
        eq(timeEntries.userId, user.id),
        eq(timeEntries.date, dateStr)
      ),
      columns: {
        id: true,
        date: true,
        hours: true,
        description: true,
        clientId: true,
        subtopicId: true,
        topicName: true,
        subtopicName: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        client: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [desc(timeEntries.createdAt)],
    });

    const serializedEntries = entries.map(serializeTimeEntry);

    // For ADMIN/PARTNER: also fetch team summaries
    if (user.position && canViewTeamTimesheets(user.position)) {
      const teamSummaries = await db
        .select({
          userId: users.id,
          userName: users.name,
          position: users.position,
          totalHours: sql<string>`COALESCE(SUM(CAST(${timeEntries.hours} AS DECIMAL)), 0)`,
        })
        .from(users)
        .leftJoin(
          timeEntries,
          and(
            eq(timeEntries.userId, users.id),
            eq(timeEntries.date, dateStr)
          )
        )
        .where(
          and(
            ne(users.id, user.id),
            eq(users.status, 'ACTIVE')
          )
        )
        .groupBy(users.id, users.name, users.position)
        .having(sql`SUM(CAST(${timeEntries.hours} AS DECIMAL)) > 0`)
        .orderBy(sql`SUM(CAST(${timeEntries.hours} AS DECIMAL)) DESC`);

      return NextResponse.json({
        entries: serializedEntries,
        teamSummaries: teamSummaries.map((s) => ({
          ...s,
          userName: s.userName || "Unknown",
          totalHours: Number(s.totalHours),
        })),
      });
    }

    // For regular users: return entries array directly (backward compatible)
    return NextResponse.json(serializedEntries);
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
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
    columns: { id: true, status: true },
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
  const subtopic = await db.query.subtopics.findFirst({
    where: eq(subtopics.id, subtopicId),
    columns: {
      id: true,
      name: true,
      status: true,
    },
    with: {
      topic: {
        columns: { name: true, status: true },
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
    const now = new Date().toISOString();
    const dateStr = parsedDate.toISOString().split("T")[0];

    const [entry] = await db.insert(timeEntries).values({
      id: createId(),
      date: dateStr,
      hours: String(hoursNum),
      description: (description || "").trim(),
      userId: user.id,
      clientId: clientId,
      subtopicId: subtopicId,
      topicName: subtopic.topic.name,
      subtopicName: subtopic.name,
      updatedAt: now,
    }).returning({
      id: timeEntries.id,
      date: timeEntries.date,
      hours: timeEntries.hours,
      description: timeEntries.description,
      clientId: timeEntries.clientId,
      subtopicId: timeEntries.subtopicId,
      topicName: timeEntries.topicName,
      subtopicName: timeEntries.subtopicName,
      createdAt: timeEntries.createdAt,
      updatedAt: timeEntries.updatedAt,
    });

    // Fetch the client for the response
    const entryClient = await db.query.clients.findFirst({
      where: eq(clients.id, clientId),
      columns: { id: true, name: true },
    });

    return NextResponse.json(serializeTimeEntry({
      ...entry,
      client: entryClient ?? null,
    }));
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
    // First check if entry exists and belongs to user
    const existingEntry = await db.query.timeEntries.findFirst({
      where: eq(timeEntries.id, id),
      columns: { userId: true },
    });

    if (!existingEntry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (existingEntry.userId !== user.id) {
      return NextResponse.json({ error: "You can only delete your own entries" }, { status: 403 });
    }

    await db.delete(timeEntries).where(eq(timeEntries.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting time entry:", error);
    return NextResponse.json(
      { error: "Failed to delete time entry" },
      { status: 500 }
    );
  }
}
