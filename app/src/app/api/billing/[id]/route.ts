import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAuth,
  requireWriteAccess,
  serializeDecimal,
  errorResponse,
  getUserFromSession,
} from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string }> };

// Helper to serialize a full service description
function serializeServiceDescription(sd: any) {
  return {
    id: sd.id,
    clientId: sd.clientId,
    client: {
      id: sd.client.id,
      name: sd.client.name,
      invoicedName: sd.client.invoicedName,
      invoiceAttn: sd.client.invoiceAttn,
      hourlyRate: serializeDecimal(sd.client.hourlyRate),
    },
    periodStart: sd.periodStart.toISOString().split("T")[0],
    periodEnd: sd.periodEnd.toISOString().split("T")[0],
    status: sd.status,
    finalizedAt: sd.finalizedAt?.toISOString() || null,
    topics: sd.topics.map((topic: any) => ({
      id: topic.id,
      topicName: topic.topicName,
      displayOrder: topic.displayOrder,
      pricingMode: topic.pricingMode,
      hourlyRate: serializeDecimal(topic.hourlyRate),
      fixedFee: serializeDecimal(topic.fixedFee),
      lineItems: topic.lineItems.map((item: any) => ({
        id: item.id,
        timeEntryId: item.timeEntryId,
        date: item.date?.toISOString().split("T")[0] || null,
        description: item.description,
        hours: serializeDecimal(item.hours),
        fixedAmount: serializeDecimal(item.fixedAmount),
        displayOrder: item.displayOrder,
        originalDescription: item.timeEntry?.description,
        originalHours: item.timeEntry ? serializeDecimal(item.timeEntry.hours) : undefined,
      })),
    })),
    createdAt: sd.createdAt.toISOString(),
    updatedAt: sd.updatedAt.toISOString(),
  };
}

// GET /api/billing/[id] - Get service description with all details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    const sd = await db.serviceDescription.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            invoicedName: true,
            invoiceAttn: true,
            hourlyRate: true,
          },
        },
        topics: {
          orderBy: { displayOrder: "asc" },
          include: {
            lineItems: {
              orderBy: { displayOrder: "asc" },
              include: {
                timeEntry: { select: { description: true, hours: true } },
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

// PATCH /api/billing/[id] - Update status (finalize/unlock)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
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

  const { status } = body;

  if (!status || !["DRAFT", "FINALIZED"].includes(status)) {
    return errorResponse("Invalid status", 400);
  }

  try {
    const existing = await db.serviceDescription.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return errorResponse("Service description not found", 404);
    }

    const updateData: any = { status };

    if (status === "FINALIZED") {
      const user = await getUserFromSession(auth.session.user?.email);
      updateData.finalizedAt = new Date();
      updateData.finalizedById = user?.id || null;
    } else {
      // Unlocking - clear finalized info
      updateData.finalizedAt = null;
      updateData.finalizedById = null;
    }

    const updated = await db.serviceDescription.update({
      where: { id },
      data: updateData,
      select: { id: true, status: true, finalizedAt: true },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      finalizedAt: updated.finalizedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Database error updating service description:", error);
    return errorResponse("Failed to update service description", 500);
  }
}

// DELETE /api/billing/[id] - Delete draft service description
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    const existing = await db.serviceDescription.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return errorResponse("Service description not found", 404);
    }

    if (existing.status === "FINALIZED") {
      return errorResponse("Cannot delete finalized service description", 400);
    }

    await db.serviceDescription.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting service description:", error);
    return errorResponse("Failed to delete service description", 500);
  }
}
