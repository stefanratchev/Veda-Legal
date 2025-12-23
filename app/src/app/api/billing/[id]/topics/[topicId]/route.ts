import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireWriteAccess, serializeDecimal, errorResponse } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string; topicId: string }> };

// PATCH /api/billing/[id]/topics/[topicId] - Update topic
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

  try {
    // Verify service description is draft
    const sd = await db.serviceDescription.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    if (sd.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const updateData: Prisma.ServiceDescriptionTopicUpdateInput = {};

    if (body.topicName !== undefined) {
      updateData.topicName = body.topicName.trim();
    }
    if (body.pricingMode !== undefined) {
      updateData.pricingMode = body.pricingMode;
    }
    if (body.hourlyRate !== undefined) {
      updateData.hourlyRate = body.hourlyRate ? new Prisma.Decimal(body.hourlyRate) : null;
    }
    if (body.fixedFee !== undefined) {
      updateData.fixedFee = body.fixedFee ? new Prisma.Decimal(body.fixedFee) : null;
    }
    if (body.displayOrder !== undefined) {
      updateData.displayOrder = body.displayOrder;
    }

    const topic = await db.serviceDescriptionTopic.update({
      where: { id: topicId },
      data: updateData,
      select: {
        id: true,
        topicName: true,
        displayOrder: true,
        pricingMode: true,
        hourlyRate: true,
        fixedFee: true,
      },
    });

    return NextResponse.json({
      id: topic.id,
      topicName: topic.topicName,
      displayOrder: topic.displayOrder,
      pricingMode: topic.pricingMode,
      hourlyRate: serializeDecimal(topic.hourlyRate),
      fixedFee: serializeDecimal(topic.fixedFee),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return errorResponse("Topic not found", 404);
    }
    console.error("Database error updating topic:", error);
    return errorResponse("Failed to update topic", 500);
  }
}

// DELETE /api/billing/[id]/topics/[topicId] - Delete topic
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, topicId } = await params;

  try {
    const sd = await db.serviceDescription.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    if (sd.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    await db.serviceDescriptionTopic.delete({ where: { id: topicId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return errorResponse("Topic not found", 404);
    }
    console.error("Database error deleting topic:", error);
    return errorResponse("Failed to delete topic", 500);
  }
}
