import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, asc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import {
  serviceDescriptions,
  serviceDescriptionTopics,
  serviceDescriptionLineItems,
  clients,
  timeEntries,
} from "@/lib/schema";
import {
  requireAuth,
  requireAdmin,
  errorResponse,
} from "@/lib/api-utils";
import { BILLING_START_DATE } from "@/lib/billing-config";

// GET /api/billing - List all service descriptions
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const allServiceDescriptions = await db.query.serviceDescriptions.findMany({
      columns: {
        id: true,
        clientId: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        updatedAt: true,
      },
      with: {
        client: {
          columns: { name: true },
        },
        topics: {
          columns: {
            pricingMode: true,
            hourlyRate: true,
            fixedFee: true,
          },
          with: {
            lineItems: {
              columns: { hours: true, fixedAmount: true },
            },
          },
        },
      },
      orderBy: [desc(serviceDescriptions.updatedAt)],
    });

    // Calculate total amount for each service description
    const result = allServiceDescriptions.map((sd) => {
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
        periodStart: sd.periodStart,
        periodEnd: sd.periodEnd,
        status: sd.status,
        totalAmount: Math.round(totalAmount * 100) / 100,
        updatedAt: sd.updatedAt,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Database error fetching service descriptions:", error);
    return errorResponse("Failed to fetch service descriptions", 500);
  }
}

// POST /api/billing - Create new service description (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
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
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, clientId),
      columns: { id: true, hourlyRate: true },
    });

    if (!client) {
      return errorResponse("Client not found", 404);
    }

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    // Get unbilled time entries for this client in the date range
    // Exclude entries that are in FINALIZED service descriptions
    // Using a subquery approach for Drizzle
    const unbilledEntries = await db.query.timeEntries.findMany({
      where: and(
        eq(timeEntries.clientId, clientId),
        // date >= startDate AND date <= endDate
        // In Drizzle with date strings, we compare directly
      ),
      columns: {
        id: true,
        date: true,
        hours: true,
        description: true,
        topicName: true,
      },
      with: {
        billingLineItems: {
          columns: { id: true },
          with: {
            topic: {
              columns: { id: true },
              with: {
                serviceDescription: {
                  columns: { status: true },
                },
              },
            },
          },
        },
      },
      orderBy: [asc(timeEntries.topicName), asc(timeEntries.date)],
    });

    // Filter entries: include only those in date range and not in FINALIZED service descriptions
    const filteredEntries = unbilledEntries.filter((entry) => {
      // Check date range (with billing start date as floor)
      const effectiveStartDate =
        startDateStr < BILLING_START_DATE ? BILLING_START_DATE : startDateStr;
      if (entry.date < effectiveStartDate || entry.date > endDateStr) {
        return false;
      }
      // Check if any billing line item is in a FINALIZED service description
      const hasFinalized = entry.billingLineItems.some(
        (li) => li.topic?.serviceDescription?.status === "FINALIZED"
      );
      return !hasFinalized;
    });

    // Group entries by topic
    const entriesByTopic = new Map<string, typeof filteredEntries>();
    for (const entry of filteredEntries) {
      const topicName = entry.topicName || "Other";
      if (!entriesByTopic.has(topicName)) {
        entriesByTopic.set(topicName, []);
      }
      entriesByTopic.get(topicName)!.push(entry);
    }

    // Create service description
    const now = new Date().toISOString();
    const serviceDescriptionId = createId();

    await db.insert(serviceDescriptions).values({
      id: serviceDescriptionId,
      clientId,
      periodStart: startDateStr,
      periodEnd: endDateStr,
      status: "DRAFT",
      updatedAt: now,
    });

    // Create topics and line items
    let topicIndex = 0;
    for (const [topicName, entries] of entriesByTopic.entries()) {
      const topicId = createId();
      await db.insert(serviceDescriptionTopics).values({
        id: topicId,
        serviceDescriptionId,
        topicName,
        displayOrder: topicIndex,
        pricingMode: "HOURLY",
        hourlyRate: client.hourlyRate,
        updatedAt: now,
      });

      // Create line items for this topic
      const lineItemValues = entries.map((entry, itemIndex) => ({
        id: createId(),
        topicId,
        timeEntryId: entry.id,
        date: entry.date,
        description: entry.description,
        hours: entry.hours,
        displayOrder: itemIndex,
        updatedAt: now,
      }));

      if (lineItemValues.length > 0) {
        await db.insert(serviceDescriptionLineItems).values(lineItemValues);
      }

      topicIndex++;
    }

    return NextResponse.json({ id: serviceDescriptionId });
  } catch (error) {
    console.error("Database error creating service description:", error);
    return errorResponse("Failed to create service description", 500);
  }
}
