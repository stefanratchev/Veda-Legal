import { NextRequest, NextResponse } from "next/server";
import { eq, asc, max, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { topics, subtopics } from "@/lib/schema";
import { requireAuth, requireAdmin, errorResponse } from "@/lib/api-utils";

const VALID_TOPIC_TYPES = ["REGULAR", "INTERNAL", "MANAGEMENT"] as const;
type TopicType = (typeof VALID_TOPIC_TYPES)[number];

// GET /api/topics - List topics with subtopics
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const typeFilter = searchParams.get("type") as TopicType | null;

  // Validate type filter if provided
  if (typeFilter && !VALID_TOPIC_TYPES.includes(typeFilter)) {
    return errorResponse(`Invalid type. Must be one of: ${VALID_TOPIC_TYPES.join(", ")}`, 400);
  }

  try {
    // Build where conditions
    const conditions = [];
    if (!includeInactive) {
      conditions.push(eq(topics.status, "ACTIVE"));
    }
    if (typeFilter) {
      conditions.push(eq(topics.topicType, typeFilter));
    }

    const allTopics = await db.query.topics.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        subtopics: {
          where: includeInactive ? undefined : eq(subtopics.status, "ACTIVE"),
          orderBy: [asc(subtopics.displayOrder)],
          columns: {
            id: true,
            name: true,
            isPrefix: true,
            displayOrder: true,
            status: true,
          },
        },
      },
      orderBy: [asc(topics.displayOrder)],
    });

    return NextResponse.json(
      allTopics.map((t) => ({
        id: t.id,
        name: t.name,
        topicType: t.topicType,
        displayOrder: t.displayOrder,
        status: t.status,
        subtopics: t.subtopics,
      }))
    );
  } catch (error) {
    console.error("Database error fetching topics:", error);
    return errorResponse("Failed to fetch topics", 500);
  }
}

// POST /api/topics - Create topic (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { name, topicType = "REGULAR" } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Name is required", 400);
  }
  if (name.trim().length > 100) {
    return errorResponse("Name must be 100 characters or less", 400);
  }
  if (!VALID_TOPIC_TYPES.includes(topicType)) {
    return errorResponse(`Invalid topicType. Must be one of: ${VALID_TOPIC_TYPES.join(", ")}`, 400);
  }

  try {
    // Get next display order
    const [maxOrderResult] = await db
      .select({ maxOrder: max(topics.displayOrder) })
      .from(topics);
    const nextOrder = (maxOrderResult?.maxOrder ?? 0) + 1;

    const now = new Date().toISOString();
    const [topic] = await db.insert(topics).values({
      id: createId(),
      name: name.trim(),
      topicType,
      displayOrder: nextOrder,
      updatedAt: now,
    }).returning({
      id: topics.id,
      name: topics.name,
      topicType: topics.topicType,
      displayOrder: topics.displayOrder,
      status: topics.status,
    });

    return NextResponse.json({
      id: topic.id,
      name: topic.name,
      topicType: topic.topicType,
      displayOrder: topic.displayOrder,
      status: topic.status,
      subtopics: [],
    });
  } catch (error) {
    console.error("Database error creating topic:", error);
    return errorResponse("Failed to create topic", 500);
  }
}
