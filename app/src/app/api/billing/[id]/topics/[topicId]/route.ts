import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceDescriptions, serviceDescriptionTopics } from "@/lib/schema";
import { requireAdmin, serializeDecimal, errorResponse } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string; topicId: string }> };

// PATCH /api/billing/[id]/topics/[topicId] - Update topic (admin only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
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
    const sd = await db.query.serviceDescriptions.findFirst({
      where: eq(serviceDescriptions.id, id),
      columns: { status: true },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    if (sd.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.topicName !== undefined) {
      updateData.topicName = body.topicName.trim();
    }
    if (body.pricingMode !== undefined) {
      updateData.pricingMode = body.pricingMode;
    }
    if (body.hourlyRate !== undefined) {
      updateData.hourlyRate = body.hourlyRate ? String(body.hourlyRate) : null;
    }
    if (body.fixedFee !== undefined) {
      updateData.fixedFee = body.fixedFee ? String(body.fixedFee) : null;
    }
    if (body.displayOrder !== undefined) {
      updateData.displayOrder = body.displayOrder;
    }

    const [topic] = await db.update(serviceDescriptionTopics)
      .set(updateData)
      .where(eq(serviceDescriptionTopics.id, topicId))
      .returning({
        id: serviceDescriptionTopics.id,
        topicName: serviceDescriptionTopics.topicName,
        displayOrder: serviceDescriptionTopics.displayOrder,
        pricingMode: serviceDescriptionTopics.pricingMode,
        hourlyRate: serviceDescriptionTopics.hourlyRate,
        fixedFee: serviceDescriptionTopics.fixedFee,
      });

    if (!topic) {
      return errorResponse("Topic not found", 404);
    }

    return NextResponse.json({
      id: topic.id,
      topicName: topic.topicName,
      displayOrder: topic.displayOrder,
      pricingMode: topic.pricingMode,
      hourlyRate: serializeDecimal(topic.hourlyRate),
      fixedFee: serializeDecimal(topic.fixedFee),
    });
  } catch (error) {
    console.error("Database error updating topic:", error);
    return errorResponse("Failed to update topic", 500);
  }
}

// DELETE /api/billing/[id]/topics/[topicId] - Delete topic (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, topicId } = await params;

  try {
    const sd = await db.query.serviceDescriptions.findFirst({
      where: eq(serviceDescriptions.id, id),
      columns: { status: true },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    if (sd.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    // Check if topic exists before deleting
    const existingTopic = await db.query.serviceDescriptionTopics.findFirst({
      where: eq(serviceDescriptionTopics.id, topicId),
      columns: { id: true },
    });

    if (!existingTopic) {
      return errorResponse("Topic not found", 404);
    }

    await db.delete(serviceDescriptionTopics).where(eq(serviceDescriptionTopics.id, topicId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting topic:", error);
    return errorResponse("Failed to delete topic", 500);
  }
}
