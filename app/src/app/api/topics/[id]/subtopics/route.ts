import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/topics/[id]/subtopics - Create subtopic
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: topicId } = await context.params;

  // Verify topic exists
  const topic = await db.topic.findUnique({ where: { id: topicId } });
  if (!topic) {
    return errorResponse("Topic not found", 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Name is required", 400);
  }
  if (name.trim().length > 200) {
    return errorResponse("Name must be 200 characters or less", 400);
  }

  // Auto-detect isPrefix from name
  const isPrefix = name.trim().endsWith(":");

  // Get next display order within this topic
  const maxOrder = await db.subtopic.aggregate({
    where: { topicId },
    _max: { displayOrder: true },
  });
  const nextOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  try {
    const subtopic = await db.subtopic.create({
      data: {
        topicId,
        name: name.trim(),
        isPrefix,
        displayOrder: nextOrder,
      },
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
    console.error("Database error creating subtopic:", error);
    return errorResponse("Failed to create subtopic", 500);
  }
}
