import { NextRequest, NextResponse } from "next/server";
import { eq, max } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { topics, subtopics } from "@/lib/schema";
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
  const topic = await db.query.topics.findFirst({
    where: eq(topics.id, topicId),
    columns: { id: true },
  });
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

  try {
    // Get next display order within this topic
    const [maxOrderResult] = await db
      .select({ maxOrder: max(subtopics.displayOrder) })
      .from(subtopics)
      .where(eq(subtopics.topicId, topicId));
    const nextOrder = (maxOrderResult?.maxOrder ?? 0) + 1;

    const now = new Date().toISOString();
    const [subtopic] = await db.insert(subtopics).values({
      id: createId(),
      topicId,
      name: name.trim(),
      isPrefix,
      displayOrder: nextOrder,
      updatedAt: now,
    }).returning({
      id: subtopics.id,
      name: subtopics.name,
      isPrefix: subtopics.isPrefix,
      displayOrder: subtopics.displayOrder,
      status: subtopics.status,
    });

    return NextResponse.json(subtopic);
  } catch (error) {
    console.error("Database error creating subtopic:", error);
    return errorResponse("Failed to create subtopic", 500);
  }
}
