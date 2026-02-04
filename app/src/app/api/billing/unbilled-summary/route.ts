import { NextRequest, NextResponse } from "next/server";
import { requireAuth, errorResponse, serializeDecimal } from "@/lib/api-utils";
import { db } from "@/lib/db";
import {
  clients,
  timeEntries,
  serviceDescriptionLineItems,
  serviceDescriptionTopics,
  serviceDescriptions,
} from "@/lib/schema";
import { eq, and, isNull, sql, min, max, sum, gte } from "drizzle-orm";
import { BILLING_START_DATE } from "@/lib/billing-config";

/**
 * GET /api/billing/unbilled-summary
 *
 * Returns aggregated unbilled hours per client with:
 * - clientId, clientName, hourlyRate
 * - totalUnbilledHours, estimatedValue (hours x rate, null if no rate)
 * - oldestEntryDate, newestEntryDate
 * - existingDraftId, existingDraftPeriod (if DRAFT service description exists)
 *
 * Only includes ACTIVE clients.
 * Excludes time entries already in FINALIZED service descriptions.
 * Sorted by estimatedValue descending (nulls last).
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  try {
    // Query 1: Get unbilled hours aggregated per client
    // - Join time entries with clients
    // - Left join with service description chain to find entries in FINALIZED SDs
    // - Filter to ACTIVE clients and exclude FINALIZED entries
    const unbilledResults = await db
      .select({
        clientId: clients.id,
        clientName: clients.name,
        hourlyRate: clients.hourlyRate,
        totalUnbilledHours: sum(timeEntries.hours),
        oldestEntryDate: min(timeEntries.date),
        newestEntryDate: max(timeEntries.date),
      })
      .from(timeEntries)
      .innerJoin(clients, eq(timeEntries.clientId, clients.id))
      .leftJoin(
        serviceDescriptionLineItems,
        eq(timeEntries.id, serviceDescriptionLineItems.timeEntryId)
      )
      .leftJoin(
        serviceDescriptionTopics,
        eq(serviceDescriptionLineItems.topicId, serviceDescriptionTopics.id)
      )
      .leftJoin(
        serviceDescriptions,
        and(
          eq(serviceDescriptionTopics.serviceDescriptionId, serviceDescriptions.id),
          eq(serviceDescriptions.status, "FINALIZED")
        )
      )
      .where(
        and(
          eq(clients.status, "ACTIVE"),
          gte(timeEntries.date, BILLING_START_DATE),
          // Exclude entries that are in a FINALIZED service description
          isNull(serviceDescriptions.id)
        )
      )
      .groupBy(clients.id, clients.name, clients.hourlyRate)
      .orderBy(
        sql`(${sum(timeEntries.hours)} * ${clients.hourlyRate}) DESC NULLS LAST`
      );

    // Query 2: Get all DRAFT service descriptions (separate query for clarity)
    const drafts = await db
      .select({
        clientId: serviceDescriptions.clientId,
        draftId: serviceDescriptions.id,
        periodStart: serviceDescriptions.periodStart,
        periodEnd: serviceDescriptions.periodEnd,
      })
      .from(serviceDescriptions)
      .where(eq(serviceDescriptions.status, "DRAFT"));

    // Create a map of clientId -> draft info for quick lookup
    const draftsByClient = new Map(
      drafts.map((d) => [d.clientId, d])
    );

    // Transform and merge results
    const response = unbilledResults.map((row) => {
      const hourlyRate = serializeDecimal(row.hourlyRate);
      const totalUnbilledHours = serializeDecimal(row.totalUnbilledHours);
      const estimatedValue =
        hourlyRate !== null && totalUnbilledHours !== null
          ? hourlyRate * totalUnbilledHours
          : null;

      // Look up draft for this client
      const draft = draftsByClient.get(row.clientId);

      return {
        clientId: row.clientId,
        clientName: row.clientName,
        hourlyRate,
        totalUnbilledHours,
        estimatedValue,
        oldestEntryDate: row.oldestEntryDate,
        newestEntryDate: row.newestEntryDate,
        existingDraftId: draft?.draftId || null,
        existingDraftPeriod: draft
          ? `${draft.periodStart} - ${draft.periodEnd}`
          : null,
      };
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch unbilled summary:", error);
    return errorResponse("Failed to fetch unbilled summary", 500);
  }
}
