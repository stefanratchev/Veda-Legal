import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceDescriptions, serviceDescriptionTopics, serviceDescriptionLineItems, timeEntries } from "@/lib/schema";
import { requireAdmin, serializeDecimal, errorResponse } from "@/lib/api-utils";
import { resolveDiscountFields, validateDiscountFields, validateCapHours } from "@/lib/billing-utils";

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
      where: and(eq(serviceDescriptionTopics.id, topicId), eq(serviceDescriptionTopics.serviceDescriptionId, id)),
      columns: { discountType: true, discountValue: true },
    });

    if (!existing) {
      return errorResponse("Topic not found", 404);
    }

    // Validate discount fields
    if (body.discountType !== undefined || body.discountValue !== undefined) {
      const { type, value } = resolveDiscountFields(body, existing);
      const discountError = validateDiscountFields(type, value);
      if (discountError) return errorResponse(discountError, 400);
    }
    const capError = validateCapHours(body.capHours);
    if (capError) return errorResponse(capError, 400);

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.topicName !== undefined) {
      updateData.topicName = body.topicName.trim();
    }
    if (body.pricingMode !== undefined) {
      if (!["HOURLY", "FIXED"].includes(body.pricingMode)) {
        return errorResponse("pricingMode must be HOURLY or FIXED", 400);
      }
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
      where: and(eq(serviceDescriptionTopics.id, topicId), eq(serviceDescriptionTopics.serviceDescriptionId, id)),
      columns: { id: true },
    });

    if (!existingTopic) {
      return errorResponse("Topic not found", 404);
    }

    await db.transaction(async (tx) => {
      // Find written-off time entries in this topic before cascade delete
      const writtenOffItems = await tx.query.serviceDescriptionLineItems.findMany({
        where: and(
          eq(serviceDescriptionLineItems.topicId, topicId),
          isNotNull(serviceDescriptionLineItems.waiveMode)
        ),
        columns: { timeEntryId: true },
      });

      const timeEntryIds = writtenOffItems
        .map((li) => li.timeEntryId)
        .filter((id): id is string => id !== null);

      // Delete the topic (cascades to line items)
      await tx.delete(serviceDescriptionTopics).where(eq(serviceDescriptionTopics.id, topicId));

      // Clear isWrittenOff on orphaned time entries (no remaining waived references)
      for (const teId of [...new Set(timeEntryIds)]) {
        const stillWaived = await tx.query.serviceDescriptionLineItems.findFirst({
          where: and(
            eq(serviceDescriptionLineItems.timeEntryId, teId),
            isNotNull(serviceDescriptionLineItems.waiveMode)
          ),
          columns: { id: true },
        });
        if (!stillWaived) {
          await tx.update(timeEntries)
            .set({ isWrittenOff: false })
            .where(eq(timeEntries.id, teId));
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting topic:", error);
    return errorResponse("Failed to delete topic", 500);
  }
}
