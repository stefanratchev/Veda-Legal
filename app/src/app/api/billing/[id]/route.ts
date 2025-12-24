import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceDescriptions } from "@/lib/schema";
import {
  requireAuth,
  requireWriteAccess,
  serializeDecimal,
  errorResponse,
  getUserFromSession,
} from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string }> };

// Helper to serialize a full service description
function serializeServiceDescription(sd: {
  id: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    invoicedName: string | null;
    invoiceAttn: string | null;
    hourlyRate: string | null;
  };
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "FINALIZED";
  finalizedAt: string | null;
  topics: Array<{
    id: string;
    topicName: string;
    displayOrder: number;
    pricingMode: "HOURLY" | "FIXED";
    hourlyRate: string | null;
    fixedFee: string | null;
    lineItems: Array<{
      id: string;
      timeEntryId: string | null;
      date: string | null;
      description: string;
      hours: string | null;
      fixedAmount: string | null;
      displayOrder: number;
      timeEntry: { description: string; hours: string } | null;
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
}) {
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
    periodStart: sd.periodStart,
    periodEnd: sd.periodEnd,
    status: sd.status,
    finalizedAt: sd.finalizedAt || null,
    topics: sd.topics.map((topic) => ({
      id: topic.id,
      topicName: topic.topicName,
      displayOrder: topic.displayOrder,
      pricingMode: topic.pricingMode,
      hourlyRate: serializeDecimal(topic.hourlyRate),
      fixedFee: serializeDecimal(topic.fixedFee),
      lineItems: topic.lineItems.map((item) => ({
        id: item.id,
        timeEntryId: item.timeEntryId,
        date: item.date || null,
        description: item.description,
        hours: serializeDecimal(item.hours),
        fixedAmount: serializeDecimal(item.fixedAmount),
        displayOrder: item.displayOrder,
        originalDescription: item.timeEntry?.description,
        originalHours: item.timeEntry ? serializeDecimal(item.timeEntry.hours) : undefined,
      })),
    })),
    createdAt: sd.createdAt,
    updatedAt: sd.updatedAt,
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
    const sd = await db.query.serviceDescriptions.findFirst({
      where: eq(serviceDescriptions.id, id),
      columns: {
        id: true,
        clientId: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        finalizedAt: true,
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
    const existing = await db.query.serviceDescriptions.findFirst({
      where: eq(serviceDescriptions.id, id),
      columns: { status: true },
    });

    if (!existing) {
      return errorResponse("Service description not found", 404);
    }

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (status === "FINALIZED") {
      const user = await getUserFromSession(auth.session.user?.email);
      updateData.finalizedAt = new Date().toISOString();
      updateData.finalizedById = user?.id || null;
    } else {
      // Unlocking - clear finalized info
      updateData.finalizedAt = null;
      updateData.finalizedById = null;
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

// DELETE /api/billing/[id] - Delete draft service description
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
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
