import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { serviceDescriptions, serviceDescriptionTopics } from "@/lib/schema";
import { requireWriteAccess, serializeDecimal, errorResponse } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/billing/[id]/topics - Add topic
export async function POST(request: NextRequest, { params }: RouteParams) {
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

  const { topicName, pricingMode, hourlyRate, fixedFee } = body;

  if (!topicName || typeof topicName !== "string" || topicName.trim().length === 0) {
    return errorResponse("Topic name is required", 400);
  }

  try {
    // Verify service description exists and is draft
    const sd = await db.query.serviceDescriptions.findFirst({
      where: eq(serviceDescriptions.id, id),
      columns: { status: true },
      with: {
        topics: {
          columns: { displayOrder: true },
        },
      },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    if (sd.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const maxOrder = Math.max(0, ...sd.topics.map((t) => t.displayOrder));
    const now = new Date().toISOString();

    const [topic] = await db.insert(serviceDescriptionTopics).values({
      id: createId(),
      serviceDescriptionId: id,
      topicName: topicName.trim(),
      displayOrder: maxOrder + 1,
      pricingMode: pricingMode || "HOURLY",
      hourlyRate: hourlyRate ? String(hourlyRate) : null,
      fixedFee: fixedFee ? String(fixedFee) : null,
      updatedAt: now,
    }).returning({
      id: serviceDescriptionTopics.id,
      topicName: serviceDescriptionTopics.topicName,
      displayOrder: serviceDescriptionTopics.displayOrder,
      pricingMode: serviceDescriptionTopics.pricingMode,
      hourlyRate: serviceDescriptionTopics.hourlyRate,
      fixedFee: serviceDescriptionTopics.fixedFee,
    });

    return NextResponse.json({
      id: topic.id,
      topicName: topic.topicName,
      displayOrder: topic.displayOrder,
      pricingMode: topic.pricingMode,
      hourlyRate: serializeDecimal(topic.hourlyRate),
      fixedFee: serializeDecimal(topic.fixedFee),
      lineItems: [],
    });
  } catch (error) {
    console.error("Database error creating topic:", error);
    return errorResponse("Failed to create topic", 500);
  }
}
