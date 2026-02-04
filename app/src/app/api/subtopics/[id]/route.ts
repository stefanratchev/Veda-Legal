import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subtopics, timeEntries } from "@/lib/schema";
import { requireAdmin, errorResponse } from "@/lib/api-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/subtopics/[id] - Update subtopic (admin only)
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
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
    const [subtopic] = await db.update(subtopics)
      .set({
        ...updateData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(subtopics.id, id))
      .returning({
        id: subtopics.id,
        name: subtopics.name,
        isPrefix: subtopics.isPrefix,
        displayOrder: subtopics.displayOrder,
        status: subtopics.status,
      });

    if (!subtopic) {
      return errorResponse("Subtopic not found", 404);
    }

    return NextResponse.json(subtopic);
  } catch (error) {
    console.error("Database error updating subtopic:", error);
    return errorResponse("Failed to update subtopic", 500);
  }
}

// DELETE /api/subtopics/[id] - Delete subtopic (admin only, only if no entries reference it)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  try {
    // Check if any time entries reference this subtopic
    const entriesWithSubtopic = await db.query.timeEntries.findFirst({
      where: eq(timeEntries.subtopicId, id),
      columns: { id: true },
    });

    if (entriesWithSubtopic) {
      return errorResponse("Cannot delete subtopic with time entries. Deactivate instead.", 400);
    }

    await db.delete(subtopics).where(eq(subtopics.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting subtopic:", error);
    return errorResponse("Failed to delete subtopic", 500);
  }
}
