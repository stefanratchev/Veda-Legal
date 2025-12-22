import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";
import { Prisma, TopicStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/topics/[id] - Update topic
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  // Check topic exists
  const existing = await db.topic.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!existing) {
    return errorResponse("Topic not found", 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { name, code, displayOrder, status } = body;
  const updateData: Prisma.TopicUpdateInput = {};

  // Validate and set name
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("Name cannot be empty", 400);
    }
    if (name.trim().length > 100) {
      return errorResponse("Name must be 100 characters or less", 400);
    }
    updateData.name = name.trim();
  }

  // Validate and set code
  if (code !== undefined) {
    if (typeof code !== "string" || code.trim().length === 0) {
      return errorResponse("Code cannot be empty", 400);
    }
    if (code.trim().length > 10) {
      return errorResponse("Code must be 10 characters or less", 400);
    }
    if (!/^[A-Z0-9]+$/.test(code.trim())) {
      return errorResponse("Code must be uppercase letters and numbers only", 400);
    }
    // Check for duplicate code (excluding current topic)
    if (code.trim() !== existing.code) {
      const duplicate = await db.topic.findUnique({
        where: { code: code.trim() },
      });
      if (duplicate) {
        return errorResponse("A topic with this code already exists", 400);
      }
    }
    updateData.code = code.trim();
  }

  // Validate and set displayOrder
  if (displayOrder !== undefined) {
    if (typeof displayOrder !== "number" || displayOrder < 0) {
      return errorResponse("Display order must be a non-negative number", 400);
    }
    updateData.displayOrder = displayOrder;
  }

  // Validate and set status
  if (status !== undefined) {
    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return errorResponse("Status must be ACTIVE or INACTIVE", 400);
    }
    updateData.status = status as TopicStatus;
  }

  try {
    const topic = await db.topic.update({
      where: { id },
      data: updateData,
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
    console.error("Database error updating topic:", error);
    return errorResponse("Failed to update topic", 500);
  }
}
