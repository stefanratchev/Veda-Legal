import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceDescriptions } from "@/lib/schema";
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
                fixedAmount: true,
                displayOrder: true,
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

    await db.delete(serviceDescriptions).where(eq(serviceDescriptions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting service description:", error);
    return errorResponse("Failed to delete service description", 500);
  }
}
