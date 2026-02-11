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

    // Fetch existing topic to validate against current DB state
    const existing = await db.query.serviceDescriptionTopics.findFirst({
      where: eq(serviceDescriptionTopics.id, topicId),
      columns: { discountType: true, discountValue: true },
    });

    if (!existing) {
      return errorResponse("Topic not found", 404);
    }

    // Validate discount fields
    if (body.discountType !== undefined || body.discountValue !== undefined) {
      // Merge sent fields with existing DB state
      const resultType = body.discountType !== undefined ? (body.discountType || null) : existing.discountType;
      const resultValue = body.discountValue !== undefined ? body.discountValue : (existing.discountValue ? Number(existing.discountValue) : null);

      if (resultType && !["PERCENTAGE", "AMOUNT"].includes(resultType)) {
        return errorResponse("discountType must be PERCENTAGE or AMOUNT", 400);
      }
      if (resultValue != null) {
        if (typeof resultValue !== "number" || resultValue <= 0) {
          return errorResponse("discountValue must be a positive number", 400);
        }
        if (resultType === "PERCENTAGE" && resultValue > 100) {
          return errorResponse("Percentage discount cannot exceed 100", 400);
        }
      }
      // discountType without discountValue is allowed (user sets type first, then value)
      // discountValue without discountType is not allowed
      if (!resultType && resultValue != null) {
        return errorResponse("discountValue requires a discountType", 400);
      }
    }
    if (body.capHours !== undefined && body.capHours !== null) {
      if (typeof body.capHours !== "number" || body.capHours <= 0) {
        return errorResponse("capHours must be a positive number", 400);
      }
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
    if (body.capHours !== undefined) {
      updateData.capHours = body.capHours != null ? String(body.capHours) : null;
    }
    if (body.discountType !== undefined) {
      updateData.discountType = body.discountType || null;
    }
    if (body.discountValue !== undefined) {
      updateData.discountValue = body.discountValue != null ? String(body.discountValue) : null;
    }

    if (body.pricingMode === "FIXED") {
      updateData.capHours = null;
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
        capHours: serviceDescriptionTopics.capHours,
        discountType: serviceDescriptionTopics.discountType,
        discountValue: serviceDescriptionTopics.discountValue,
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
      capHours: serializeDecimal(topic.capHours),
      discountType: topic.discountType,
      discountValue: serializeDecimal(topic.discountValue),
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
