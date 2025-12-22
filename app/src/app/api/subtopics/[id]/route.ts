import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/subtopics/[id] - Update subtopic
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

  const updateData: { name?: string; isPrefix?: boolean; displayOrder?: number; status?: "ACTIVE" | "INACTIVE" } = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("Name is required", 400);
    }
    if (name.trim().length > 200) {
      return errorResponse("Name must be 200 characters or less", 400);
    }
    updateData.name = name.trim();
    updateData.isPrefix = name.trim().endsWith(":");
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
    const subtopic = await db.subtopic.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        isPrefix: true,
        displayOrder: true,
        status: true,
      },
    });

    return NextResponse.json(subtopic);
  } catch (error) {
    console.error("Database error updating subtopic:", error);
    return errorResponse("Failed to update subtopic", 500);
  }
}

// DELETE /api/subtopics/[id] - Delete subtopic (only if no entries reference it)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  try {
    // Check if any time entries reference this subtopic
    const entryCount = await db.timeEntry.count({
      where: { subtopicId: id },
    });

    if (entryCount > 0) {
      return errorResponse("Cannot delete subtopic with time entries. Deactivate instead.", 400);
    }

    await db.subtopic.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting subtopic:", error);
    return errorResponse("Failed to delete subtopic", 500);
  }
}
