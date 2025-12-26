import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  timeEntries,
  clients,
  subtopics,
  serviceDescriptionLineItems,
  serviceDescriptionTopics,
  serviceDescriptions,
} from "@/lib/schema";
import {
  requireAuth,
  getUserFromSession,
  errorResponse,
  serializeDecimal,
  isValidHours,
  MAX_HOURS_PER_ENTRY,
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
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Authenticate user
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { hours, description, subtopicId } = body;

  try {
    // Find the existing entry
    const existingEntry = await db.query.timeEntries.findFirst({
      where: eq(timeEntries.id, id),
      columns: {
        id: true,
        userId: true,
        clientId: true,
        date: true,
        hours: true,
        description: true,
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
    });

    if (!existingEntry) {
      return errorResponse("Entry not found", 404);
    }

    // Check that entry belongs to current user
    if (existingEntry.userId !== user.id) {
      return errorResponse("You can only edit your own entries", 403);
    }

    // Check if entry is linked to a finalized service description
    const billedEntry = await db
      .select({ status: serviceDescriptions.status })
      .from(serviceDescriptionLineItems)
      .innerJoin(
        serviceDescriptionTopics,
        eq(serviceDescriptionLineItems.topicId, serviceDescriptionTopics.id)
      )
      .innerJoin(
        serviceDescriptions,
        eq(serviceDescriptionTopics.serviceDescriptionId, serviceDescriptions.id)
      )
      .where(
        and(
          eq(serviceDescriptionLineItems.timeEntryId, id),
          eq(serviceDescriptions.status, "FINALIZED")
        )
      )
      .limit(1);

    if (billedEntry.length > 0) {
      return errorResponse("Cannot edit entries that have been billed", 403);
    }

    // Build update object with validated fields
    const updateData: {
      hours?: string;
      description?: string;
      subtopicId?: string;
      topicName?: string;
      subtopicName?: string;
      updatedAt: string;
    } = {
      updatedAt: new Date().toISOString(),
    };

    // Validate and include hours if provided
    if (hours !== undefined) {
      const hoursNum = Number(hours);
      if (!isValidHours(hoursNum)) {
        return errorResponse(`Hours must be between 0 and ${MAX_HOURS_PER_ENTRY}`, 400);
      }
      updateData.hours = String(hoursNum);
    }

    // Include description if provided
    if (description !== undefined) {
      if (typeof description !== "string") {
        return errorResponse("Description must be a string", 400);
      }
      updateData.description = description.trim();
    }

    // Validate and include subtopicId if provided
    if (subtopicId !== undefined) {
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
        return errorResponse("Cannot use inactive subtopic", 400);
      }
      if (subtopic.topic.status !== "ACTIVE") {
        return errorResponse("Cannot use subtopic with inactive topic", 400);
      }

      updateData.subtopicId = subtopicId;
      updateData.topicName = subtopic.topic.name;
      updateData.subtopicName = subtopic.name;
    }

    // Perform the update
    const [updatedEntry] = await db
      .update(timeEntries)
      .set(updateData)
      .where(eq(timeEntries.id, id))
      .returning({
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

    // Fetch client for response
    const entryClient = await db.query.clients.findFirst({
      where: eq(clients.id, updatedEntry.clientId),
      columns: { id: true, name: true },
    });

    return NextResponse.json(
      serializeTimeEntry({
        ...updatedEntry,
        client: entryClient ?? null,
      })
    );
  } catch (error) {
    console.error("Database error updating time entry:", error);
    return NextResponse.json(
      { error: "Failed to update time entry" },
      { status: 500 }
    );
  }
}
