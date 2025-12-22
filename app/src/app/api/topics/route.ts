import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
    const topics = await db.topic.findMany({
      where: includeInactive ? {} : { status: "ACTIVE" },
      include: {
        subtopics: {
          where: includeInactive ? {} : { status: "ACTIVE" },
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
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json(
      topics.map((t) => ({
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

  // Get next display order
  const maxOrder = await db.topic.aggregate({
    _max: { displayOrder: true },
  });
  const nextOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  try {
    const topic = await db.topic.create({
      data: {
        name: name.trim(),
        displayOrder: nextOrder,
      },
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
    console.error("Database error creating topic:", error);
    return errorResponse("Failed to create topic", 500);
  }
}
