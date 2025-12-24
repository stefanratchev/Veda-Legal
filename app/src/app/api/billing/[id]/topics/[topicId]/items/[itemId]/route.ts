import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceDescriptionLineItems } from "@/lib/schema";
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
    const item = await db.query.serviceDescriptionLineItems.findFirst({
      where: eq(serviceDescriptionLineItems.id, itemId),
      columns: { id: true },
      with: {
        topic: {
          columns: { id: true },
          with: {
            serviceDescription: {
              columns: { id: true, status: true },
            },
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

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.date !== undefined) {
      updateData.date = body.date ? body.date : null;
    }
    if (body.description !== undefined) {
      updateData.description = body.description.trim();
    }
    if (body.hours !== undefined) {
      updateData.hours = body.hours ? String(body.hours) : null;
    }
    if (body.fixedAmount !== undefined) {
      updateData.fixedAmount = body.fixedAmount ? String(body.fixedAmount) : null;
    }
    if (body.displayOrder !== undefined) {
      updateData.displayOrder = body.displayOrder;
    }

    const [updated] = await db.update(serviceDescriptionLineItems)
      .set(updateData)
      .where(eq(serviceDescriptionLineItems.id, itemId))
      .returning({
        id: serviceDescriptionLineItems.id,
        timeEntryId: serviceDescriptionLineItems.timeEntryId,
        date: serviceDescriptionLineItems.date,
        description: serviceDescriptionLineItems.description,
        hours: serviceDescriptionLineItems.hours,
        fixedAmount: serviceDescriptionLineItems.fixedAmount,
        displayOrder: serviceDescriptionLineItems.displayOrder,
      });

    // Fetch the time entry for original values if linked
    let originalDescription: string | undefined;
    let originalHours: number | null | undefined;

    if (updated.timeEntryId) {
      const fullItem = await db.query.serviceDescriptionLineItems.findFirst({
        where: eq(serviceDescriptionLineItems.id, itemId),
        columns: { id: true },
        with: {
          timeEntry: {
            columns: { description: true, hours: true },
          },
        },
      });
      if (fullItem?.timeEntry) {
        originalDescription = fullItem.timeEntry.description;
        originalHours = serializeDecimal(fullItem.timeEntry.hours);
      }
    }

    return NextResponse.json({
      id: updated.id,
      timeEntryId: updated.timeEntryId,
      date: updated.date || null,
      description: updated.description,
      hours: serializeDecimal(updated.hours),
      fixedAmount: serializeDecimal(updated.fixedAmount),
      displayOrder: updated.displayOrder,
      originalDescription,
      originalHours,
    });
  } catch (error) {
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
    const item = await db.query.serviceDescriptionLineItems.findFirst({
      where: eq(serviceDescriptionLineItems.id, itemId),
      columns: { id: true },
      with: {
        topic: {
          columns: { id: true },
          with: {
            serviceDescription: {
              columns: { id: true, status: true },
            },
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

    await db.delete(serviceDescriptionLineItems).where(eq(serviceDescriptionLineItems.id, itemId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting line item:", error);
    return errorResponse("Failed to delete line item", 500);
  }
}
