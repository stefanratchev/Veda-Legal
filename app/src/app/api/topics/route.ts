import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireWriteAccess, errorResponse } from "@/lib/api-utils";

// GET /api/topics - List topics
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
      select: {
        id: true,
        name: true,
        code: true,
        displayOrder: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json(
      topics.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
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

  const { name, code } = body;

  // Validate name
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Name is required", 400);
  }
  if (name.trim().length > 100) {
    return errorResponse("Name must be 100 characters or less", 400);
  }

  // Validate code
  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return errorResponse("Code is required", 400);
  }
  if (code.trim().length > 10) {
    return errorResponse("Code must be 10 characters or less", 400);
  }
  if (!/^[A-Z0-9]+$/.test(code.trim())) {
    return errorResponse("Code must be uppercase letters and numbers only", 400);
  }

  // Check for duplicate code
  const existing = await db.topic.findUnique({
    where: { code: code.trim() },
  });
  if (existing) {
    return errorResponse("A topic with this code already exists", 400);
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
        code: code.trim(),
        displayOrder: nextOrder,
      },
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

    return NextResponse.json({
      ...topic,
      createdAt: topic.createdAt.toISOString(),
      updatedAt: topic.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Database error creating topic:", error);
    return errorResponse("Failed to create topic", 500);
  }
}
