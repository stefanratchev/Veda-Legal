import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireWriteAccess, serializeDecimal, errorResponse } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string; topicId: string; itemId: string }> };

// PATCH - Update line item
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, topicId, itemId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  try {
    // Verify hierarchy and draft status
    const item = await db.serviceDescriptionLineItem.findUnique({
      where: { id: itemId },
      select: {
        topic: {
          select: {
            id: true,
            serviceDescription: { select: { id: true, status: true } },
          },
        },
      },
    });

    if (!item || item.topic.id !== topicId || item.topic.serviceDescription.id !== id) {
      return errorResponse("Line item not found", 404);
    }

    if (item.topic.serviceDescription.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const updateData: Prisma.ServiceDescriptionLineItemUpdateInput = {};

    if (body.date !== undefined) {
      updateData.date = body.date ? new Date(body.date) : null;
    }
    if (body.description !== undefined) {
      updateData.description = body.description.trim();
    }
    if (body.hours !== undefined) {
      updateData.hours = body.hours ? new Prisma.Decimal(body.hours) : null;
    }
    if (body.fixedAmount !== undefined) {
      updateData.fixedAmount = body.fixedAmount ? new Prisma.Decimal(body.fixedAmount) : null;
    }
    if (body.displayOrder !== undefined) {
      updateData.displayOrder = body.displayOrder;
    }

    const updated = await db.serviceDescriptionLineItem.update({
      where: { id: itemId },
      data: updateData,
      select: {
        id: true,
        timeEntryId: true,
        date: true,
        description: true,
        hours: true,
        fixedAmount: true,
        displayOrder: true,
        timeEntry: { select: { description: true, hours: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      timeEntryId: updated.timeEntryId,
      date: updated.date?.toISOString().split("T")[0] || null,
      description: updated.description,
      hours: serializeDecimal(updated.hours),
      fixedAmount: serializeDecimal(updated.fixedAmount),
      displayOrder: updated.displayOrder,
      originalDescription: updated.timeEntry?.description,
      originalHours: updated.timeEntry ? serializeDecimal(updated.timeEntry.hours) : undefined,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return errorResponse("Line item not found", 404);
    }
    console.error("Database error updating line item:", error);
    return errorResponse("Failed to update line item", 500);
  }
}

// DELETE - Delete line item
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, topicId, itemId } = await params;

  try {
    const item = await db.serviceDescriptionLineItem.findUnique({
      where: { id: itemId },
      select: {
        topic: {
          select: {
            id: true,
            serviceDescription: { select: { id: true, status: true } },
          },
        },
      },
    });

    if (!item || item.topic.id !== topicId || item.topic.serviceDescription.id !== id) {
      return errorResponse("Line item not found", 404);
    }

    if (item.topic.serviceDescription.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    await db.serviceDescriptionLineItem.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting line item:", error);
    return errorResponse("Failed to delete line item", 500);
  }
}
