import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";

// POST /api/topics/reorder - Bulk update display order
export async function POST(request: NextRequest) {
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

  const { order } = body;

  // Validate order array
  if (!Array.isArray(order)) {
    return errorResponse("Order must be an array of topic IDs", 400);
  }

  try {
    // Update each topic's displayOrder in a transaction
    await db.$transaction(
      order.map((id: string, index: number) =>
        db.topic.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );

    // Return updated topics
    const topics = await db.topic.findMany({
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        displayOrder: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      topics.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Database error reordering topics:", error);
    return errorResponse("Failed to reorder topics", 500);
  }
}
