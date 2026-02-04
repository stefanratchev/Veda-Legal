import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { serviceDescriptionTopics, serviceDescriptionLineItems } from "@/lib/schema";
import { requireAdmin, serializeDecimal, errorResponse } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string; topicId: string }> };

// POST - Add line item (admin only)
export async function POST(request: NextRequest, { params }: RouteParams) {
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

  const { date, description, hours, fixedAmount } = body;

  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return errorResponse("Description is required", 400);
  }

  try {
    // Verify topic exists and service description is draft
    const topic = await db.query.serviceDescriptionTopics.findFirst({
      where: eq(serviceDescriptionTopics.id, topicId),
      columns: { id: true },
      with: {
        serviceDescription: {
          columns: { id: true, status: true },
        },
        lineItems: {
          columns: { displayOrder: true },
        },
      },
    });

    if (!topic || topic.serviceDescription.id !== id) {
      return errorResponse("Topic not found", 404);
    }

    if (topic.serviceDescription.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const maxOrder = Math.max(0, ...topic.lineItems.map((i) => i.displayOrder));
    const now = new Date().toISOString();

    const [item] = await db.insert(serviceDescriptionLineItems).values({
      id: createId(),
      topicId,
      date: date ? date : null,
      description: description.trim(),
      hours: hours ? String(hours) : null,
      fixedAmount: fixedAmount ? String(fixedAmount) : null,
      displayOrder: maxOrder + 1,
      updatedAt: now,
    }).returning({
      id: serviceDescriptionLineItems.id,
      timeEntryId: serviceDescriptionLineItems.timeEntryId,
      date: serviceDescriptionLineItems.date,
      description: serviceDescriptionLineItems.description,
      hours: serviceDescriptionLineItems.hours,
      fixedAmount: serviceDescriptionLineItems.fixedAmount,
      displayOrder: serviceDescriptionLineItems.displayOrder,
    });

    return NextResponse.json({
      id: item.id,
      timeEntryId: item.timeEntryId,
      date: item.date || null,
      description: item.description,
      hours: serializeDecimal(item.hours),
      fixedAmount: serializeDecimal(item.fixedAmount),
      displayOrder: item.displayOrder,
    });
  } catch (error) {
    console.error("Database error creating line item:", error);
    return errorResponse("Failed to create line item", 500);
  }
}
