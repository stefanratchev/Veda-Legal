import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";

interface ReorderItem {
  id: string;
  displayOrder: number;
}

// PATCH /api/topics/reorder - Batch update topic display orders
export async function PATCH(request: NextRequest) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse("Items array is required", 400);
  }

  // Validate each item
  for (const item of items) {
    if (typeof item.id !== "string" || item.id.length === 0) {
      return errorResponse("Each item must have a valid id", 400);
    }
    if (typeof item.displayOrder !== "number" || item.displayOrder < 0) {
      return errorResponse("Each item must have a valid displayOrder", 400);
    }
  }

  try {
    // Update all topics in a transaction
    await db.$transaction(
      items.map((item: ReorderItem) =>
        db.topic.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error reordering topics:", error);
    return errorResponse("Failed to reorder topics", 500);
  }
}
