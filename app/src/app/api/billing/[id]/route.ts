import { NextRequest, NextResponse } from "next/server";
import { eq, asc, and, isNotNull, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceDescriptions, serviceDescriptionLineItems, serviceDescriptionTopics, timeEntries } from "@/lib/schema";
import { requireAdmin, errorResponse, getUserFromSession } from "@/lib/api-utils";
import { serializeServiceDescription, resolveDiscountFields, validateDiscountFields } from "@/lib/billing-utils";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/billing/[id] - Get service description with all details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    const sd = await db.query.serviceDescriptions.findFirst({
      where: eq(serviceDescriptions.id, id),
      columns: {
        id: true,
        clientId: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        finalizedAt: true,
        discountType: true,
        discountValue: true,
        retainerFee: true,
        retainerHours: true,
        retainerOverageRate: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            invoicedName: true,
            invoiceAttn: true,
            hourlyRate: true,
            retainerFee: true,
            retainerHours: true,
            notes: true,
          },
        },
        topics: {
          columns: {
            id: true,
            topicName: true,
            displayOrder: true,
            pricingMode: true,
            hourlyRate: true,
            fixedFee: true,
            capHours: true,
            discountType: true,
            discountValue: true,
          },
          orderBy: (topics) => [asc(topics.displayOrder)],
          with: {
            lineItems: {
              columns: {
                id: true,
                timeEntryId: true,
                date: true,
                description: true,
                hours: true,
                displayOrder: true,
                waiveMode: true,
              },
              orderBy: (items) => [asc(items.displayOrder)],
              with: {
                timeEntry: {
                  columns: { description: true, hours: true },
                  with: {
                    user: {
                      columns: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    return NextResponse.json(serializeServiceDescription(sd));
  } catch (error) {
    console.error("Database error fetching service description:", error);
    return errorResponse("Failed to fetch service description", 500);
  }
}

// PATCH /api/billing/[id] - Update status (finalize/unlock) - admin only
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { status, discountType: bodyDiscountType, discountValue: bodyDiscountValue } = body;

  if (status && !["DRAFT", "FINALIZED"].includes(status)) {
    return errorResponse("Invalid status", 400);
  }

  if (!status && bodyDiscountType === undefined && bodyDiscountValue === undefined) {
    return errorResponse("No update fields provided", 400);
  }

  try {
    const existing = await db.query.serviceDescriptions.findFirst({
      where: eq(serviceDescriptions.id, id),
      columns: { status: true, discountType: true, discountValue: true },
    });

    if (!existing) {
      return errorResponse("Service description not found", 404);
    }

    // Validate discount fields against resulting DB state
    if (bodyDiscountType !== undefined || bodyDiscountValue !== undefined) {
      if (existing.status === "FINALIZED") {
        return errorResponse("Cannot modify finalized service description", 400);
      }
      const { type: resultType, value: resultValue } = resolveDiscountFields(
        { discountType: bodyDiscountType, discountValue: bodyDiscountValue },
        existing,
      );
      const discountError = validateDiscountFields(resultType, resultValue);
      if (discountError) return errorResponse(discountError, 400);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;
      if (status === "FINALIZED") {
        const user = await getUserFromSession(auth.session.user?.email);
        updateData.finalizedAt = new Date().toISOString();
        updateData.finalizedById = user?.id || null;
      } else {
        // Unlocking - clear finalized info
        updateData.finalizedAt = null;
        updateData.finalizedById = null;
      }
    }

    if (bodyDiscountType !== undefined) {
      updateData.discountType = bodyDiscountType || null;
    }
    if (bodyDiscountValue !== undefined) {
      updateData.discountValue = bodyDiscountValue != null ? String(bodyDiscountValue) : null;
    }

    const [updated] = await db.update(serviceDescriptions)
      .set(updateData)
      .where(eq(serviceDescriptions.id, id))
      .returning({
        id: serviceDescriptions.id,
        status: serviceDescriptions.status,
        finalizedAt: serviceDescriptions.finalizedAt,
      });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      finalizedAt: updated.finalizedAt || null,
    });
  } catch (error) {
    console.error("Database error updating service description:", error);
    return errorResponse("Failed to update service description", 500);
  }
}

// DELETE /api/billing/[id] - Delete draft service description (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    const existing = await db.query.serviceDescriptions.findFirst({
      where: eq(serviceDescriptions.id, id),
      columns: { status: true },
    });

    if (!existing) {
      return errorResponse("Service description not found", 404);
    }

    if (existing.status === "FINALIZED") {
      return errorResponse("Cannot delete finalized service description", 400);
    }

    await db.transaction(async (tx) => {
      // Find written-off time entries in this SD before cascade delete
      const writtenOffItems = await tx.query.serviceDescriptionTopics.findMany({
        where: eq(serviceDescriptionTopics.serviceDescriptionId, id),
        columns: { id: true },
        with: {
          lineItems: {
            where: isNotNull(serviceDescriptionLineItems.waiveMode),
            columns: { timeEntryId: true },
          },
        },
      });

      const timeEntryIds = writtenOffItems
        .flatMap((t) => t.lineItems.map((li) => li.timeEntryId))
        .filter((id): id is string => id !== null);

      // Delete the SD (cascades to topics and line items)
      await tx.delete(serviceDescriptions).where(eq(serviceDescriptions.id, id));

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
    console.error("Database error deleting service description:", error);
    return errorResponse("Failed to delete service description", 500);
  }
}
