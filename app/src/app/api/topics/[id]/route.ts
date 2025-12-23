import { NextRequest, NextResponse } from "next/server";
import { eq, asc, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { topics, subtopics } from "@/lib/schema";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/topics/[id] - Update topic
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { name, displayOrder, status } = body;

  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("Name is required", 400);
    }
    if (name.trim().length > 100) {
      return errorResponse("Name must be 100 characters or less", 400);
    }
    updateData.name = name.trim();
  }

  if (displayOrder !== undefined) {
    if (typeof displayOrder !== "number" || displayOrder < 0) {
      return errorResponse("Invalid display order", 400);
    }
    updateData.displayOrder = displayOrder;
  }

  if (status !== undefined) {
    if (status !== "ACTIVE" && status !== "INACTIVE") {
      return errorResponse("Invalid status", 400);
    }
    updateData.status = status;
  }

  try {
    const [updatedTopic] = await db.update(topics)
      .set(updateData)
      .where(eq(topics.id, id))
      .returning({
        id: topics.id,
        name: topics.name,
        displayOrder: topics.displayOrder,
        status: topics.status,
      });

    if (!updatedTopic) {
      return errorResponse("Topic not found", 404);
    }

    // Fetch subtopics for the response
    const topicSubtopics = await db.query.subtopics.findMany({
      where: eq(subtopics.topicId, id),
      orderBy: [asc(subtopics.displayOrder)],
      columns: {
        id: true,
        name: true,
        isPrefix: true,
        displayOrder: true,
        status: true,
      },
    });

    return NextResponse.json({
      id: updatedTopic.id,
      name: updatedTopic.name,
      displayOrder: updatedTopic.displayOrder,
      status: updatedTopic.status,
      subtopics: topicSubtopics,
    });
  } catch (error) {
    console.error("Database error updating topic:", error);
    return errorResponse("Failed to update topic", 500);
  }
}

// DELETE /api/topics/[id] - Delete topic (only if no subtopics)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  try {
    // Check if topic has subtopics
    const [subtopicCountResult] = await db
      .select({ count: count() })
      .from(subtopics)
      .where(eq(subtopics.topicId, id));

    if (subtopicCountResult.count > 0) {
      return errorResponse("Cannot delete topic with subtopics. Delete subtopics first.", 400);
    }

    await db.delete(topics).where(eq(topics.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting topic:", error);
    return errorResponse("Failed to delete topic", 500);
  }
}
