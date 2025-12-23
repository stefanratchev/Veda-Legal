import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
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
    const sd = await db.serviceDescription.findUnique({
      where: { id },
      select: { status: true, topics: { select: { displayOrder: true } } },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    if (sd.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const maxOrder = Math.max(0, ...sd.topics.map((t) => t.displayOrder));

    const topic = await db.serviceDescriptionTopic.create({
      data: {
        serviceDescriptionId: id,
        topicName: topicName.trim(),
        displayOrder: maxOrder + 1,
        pricingMode: pricingMode || "HOURLY",
        hourlyRate: hourlyRate ? new Prisma.Decimal(hourlyRate) : null,
        fixedFee: fixedFee ? new Prisma.Decimal(fixedFee) : null,
      },
      select: {
        id: true,
        topicName: true,
        displayOrder: true,
        pricingMode: true,
        hourlyRate: true,
        fixedFee: true,
      },
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
