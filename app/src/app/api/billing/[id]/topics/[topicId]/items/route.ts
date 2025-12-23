import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireWriteAccess, serializeDecimal, errorResponse } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string; topicId: string }> };

// POST - Add line item
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, topicId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { date, description, hours, fixedAmount } = body;

  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return errorResponse("Description is required", 400);
  }

  try {
    // Verify topic exists and service description is draft
    const topic = await db.serviceDescriptionTopic.findUnique({
      where: { id: topicId },
      select: {
        serviceDescription: { select: { id: true, status: true } },
        lineItems: { select: { displayOrder: true } },
      },
    });

    if (!topic || topic.serviceDescription.id !== id) {
      return errorResponse("Topic not found", 404);
    }

    if (topic.serviceDescription.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const maxOrder = Math.max(0, ...topic.lineItems.map((i) => i.displayOrder));

    const item = await db.serviceDescriptionLineItem.create({
      data: {
        topicId,
        date: date ? new Date(date) : null,
        description: description.trim(),
        hours: hours ? new Prisma.Decimal(hours) : null,
        fixedAmount: fixedAmount ? new Prisma.Decimal(fixedAmount) : null,
        displayOrder: maxOrder + 1,
      },
      select: {
        id: true,
        timeEntryId: true,
        date: true,
        description: true,
        hours: true,
        fixedAmount: true,
        displayOrder: true,
      },
    });

    return NextResponse.json({
      id: item.id,
      timeEntryId: item.timeEntryId,
      date: item.date?.toISOString().split("T")[0] || null,
      description: item.description,
      hours: serializeDecimal(item.hours),
      fixedAmount: serializeDecimal(item.fixedAmount),
      displayOrder: item.displayOrder,
    });
  } catch (error) {
    console.error("Database error creating line item:", error);
    return errorResponse("Failed to create line item", 500);
  }
}
