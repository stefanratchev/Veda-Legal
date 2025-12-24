import { NextRequest, NextResponse } from "next/server";
import { eq, asc, max } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { topics, subtopics } from "@/lib/schema";
import { requireAuth, requireWriteAccess, errorResponse } from "@/lib/api-utils";

// GET /api/topics - List topics with subtopics
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  try {
    const allTopics = await db.query.topics.findMany({
      where: includeInactive ? undefined : eq(topics.status, "ACTIVE"),
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

  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Name is required", 400);
  }
  if (name.trim().length > 100) {
    return errorResponse("Name must be 100 characters or less", 400);
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
      displayOrder: nextOrder,
      updatedAt: now,
    }).returning({
      id: topics.id,
      name: topics.name,
      displayOrder: topics.displayOrder,
      status: topics.status,
    });

    return NextResponse.json({
      id: topic.id,
      name: topic.name,
      displayOrder: topic.displayOrder,
      status: topic.status,
      subtopics: [],
    });
  } catch (error) {
    console.error("Database error creating topic:", error);
    return errorResponse("Failed to create topic", 500);
  }
}
