import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  requireAuth,
  requireWriteAccess,
  serializeDecimal,
  errorResponse,
} from "@/lib/api-utils";

// GET /api/billing - List all service descriptions
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const serviceDescriptions = await db.serviceDescription.findMany({
      select: {
        id: true,
        clientId: true,
        client: { select: { name: true } },
        periodStart: true,
        periodEnd: true,
        status: true,
        updatedAt: true,
        topics: {
          select: {
            pricingMode: true,
            hourlyRate: true,
            fixedFee: true,
            lineItems: {
              select: { hours: true, fixedAmount: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Calculate total amount for each service description
    const result = serviceDescriptions.map((sd) => {
      let totalAmount = 0;
      for (const topic of sd.topics) {
        if (topic.pricingMode === "FIXED" && topic.fixedFee) {
          totalAmount += Number(topic.fixedFee);
        } else if (topic.pricingMode === "HOURLY" && topic.hourlyRate) {
          const totalHours = topic.lineItems.reduce(
            (sum, item) => sum + (item.hours ? Number(item.hours) : 0),
            0
          );
          totalAmount += totalHours * Number(topic.hourlyRate);
          // Add fixed amounts from line items
          totalAmount += topic.lineItems.reduce(
            (sum, item) => sum + (item.fixedAmount ? Number(item.fixedAmount) : 0),
            0
          );
        }
      }

      return {
        id: sd.id,
        clientId: sd.clientId,
        clientName: sd.client.name,
        periodStart: sd.periodStart.toISOString().split("T")[0],
        periodEnd: sd.periodEnd.toISOString().split("T")[0],
        status: sd.status,
        totalAmount: Math.round(totalAmount * 100) / 100,
        updatedAt: sd.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Database error fetching service descriptions:", error);
    return errorResponse("Failed to fetch service descriptions", 500);
  }
}

// POST /api/billing - Create new service description
export async function POST(request: NextRequest) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { clientId, periodStart, periodEnd } = body;

  if (!clientId || typeof clientId !== "string") {
    return errorResponse("Client ID is required", 400);
  }

  if (!periodStart || !periodEnd) {
    return errorResponse("Period start and end dates are required", 400);
  }

  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return errorResponse("Invalid date format", 400);
  }

  if (startDate > endDate) {
    return errorResponse("Period start must be before end", 400);
  }

  try {
    // Get client with hourly rate
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true, hourlyRate: true },
    });

    if (!client) {
      return errorResponse("Client not found", 404);
    }

    // Get unbilled time entries for this client in the date range
    // Exclude entries that are in FINALIZED service descriptions
    const unbilledEntries = await db.timeEntry.findMany({
      where: {
        clientId,
        date: { gte: startDate, lte: endDate },
        billingLineItems: {
          none: {
            topic: {
              serviceDescription: { status: "FINALIZED" },
            },
          },
        },
      },
      select: {
        id: true,
        date: true,
        hours: true,
        description: true,
        topicName: true,
      },
      orderBy: [{ topicName: "asc" }, { date: "asc" }],
    });

    // Group entries by topic
    const entriesByTopic = new Map<string, typeof unbilledEntries>();
    for (const entry of unbilledEntries) {
      const topicName = entry.topicName || "Other";
      if (!entriesByTopic.has(topicName)) {
        entriesByTopic.set(topicName, []);
      }
      entriesByTopic.get(topicName)!.push(entry);
    }

    // Create service description with topics and line items
    const serviceDescription = await db.serviceDescription.create({
      data: {
        clientId,
        periodStart: startDate,
        periodEnd: endDate,
        status: "DRAFT",
        topics: {
          create: Array.from(entriesByTopic.entries()).map(
            ([topicName, entries], topicIndex) => ({
              topicName,
              displayOrder: topicIndex,
              pricingMode: "HOURLY",
              hourlyRate: client.hourlyRate,
              lineItems: {
                create: entries.map((entry, itemIndex) => ({
                  timeEntryId: entry.id,
                  date: entry.date,
                  description: entry.description,
                  hours: entry.hours,
                  displayOrder: itemIndex,
                })),
              },
            })
          ),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ id: serviceDescription.id });
  } catch (error) {
    console.error("Database error creating service description:", error);
    return errorResponse("Failed to create service description", 500);
  }
}
