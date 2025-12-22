import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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

  const updateData: { name?: string; displayOrder?: number; status?: "ACTIVE" | "INACTIVE" } = {};

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
    const topic = await db.topic.update({
      where: { id },
      data: updateData,
      include: {
        subtopics: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            name: true,
            isPrefix: true,
            displayOrder: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: topic.id,
      name: topic.name,
      displayOrder: topic.displayOrder,
      status: topic.status,
      subtopics: topic.subtopics,
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
    const subtopicCount = await db.subtopic.count({
      where: { topicId: id },
    });

    if (subtopicCount > 0) {
      return errorResponse("Cannot delete topic with subtopics. Delete subtopics first.", 400);
    }

    await db.topic.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting topic:", error);
    return errorResponse("Failed to delete topic", 500);
  }
}
