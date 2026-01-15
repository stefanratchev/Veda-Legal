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
import { eq, and, isNull, sql, min, max, sum } from "drizzle-orm";

/**
 * Type for the raw SQL result from the unbilled summary query.
 * Includes both Drizzle-selected fields and fields from the raw SQL subquery.
 */
type UnbilledSummaryQueryResult = {
  clientId: string;
  clientName: string;
  hourlyRate: string | null;
  totalUnbilledHours: string | null;
  oldestEntryDate: string | null;
  newestEntryDate: string | null;
  existingDraftId: string | null;
  existingDraftPeriodStart: string | null;
  existingDraftPeriodEnd: string | null;
  draft_id?: string | null;
  draft_period_start?: string | null;
  draft_period_end?: string | null;
};

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
    // Query to get unbilled hours aggregated per client
    // We need to:
    // 1. Get all time entries
    // 2. Join with clients to get client info
    // 3. Left join with service_description_line_items to find billed entries
    // 4. Left join with service_description_topics and service_descriptions to check status
    // 5. Filter to only include entries not in FINALIZED service descriptions
    // 6. Filter to only ACTIVE clients
    // 7. Group by client and aggregate
    // 8. Also get existing DRAFT service description if any

    const results = await db
      .select({
        clientId: clients.id,
        clientName: clients.name,
        hourlyRate: clients.hourlyRate,
        totalUnbilledHours: sum(timeEntries.hours),
        oldestEntryDate: min(timeEntries.date),
        newestEntryDate: max(timeEntries.date),
        existingDraftId: serviceDescriptions.id,
        existingDraftPeriodStart: serviceDescriptions.periodStart,
        existingDraftPeriodEnd: serviceDescriptions.periodEnd,
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
      // Left join again for draft service descriptions (separate from the finalized check)
      .leftJoin(
        sql`(
          SELECT id as draft_id, client_id as draft_client_id, period_start as draft_period_start, period_end as draft_period_end
          FROM service_descriptions
          WHERE status = 'DRAFT'
        ) AS drafts`,
        sql`drafts.draft_client_id = ${clients.id}`
      )
      .where(
        and(
          eq(clients.status, "ACTIVE"),
          // Exclude entries that are in a FINALIZED service description
          isNull(serviceDescriptions.id)
        )
      )
      .groupBy(
        clients.id,
        clients.name,
        clients.hourlyRate,
        serviceDescriptions.id,
        serviceDescriptions.periodStart,
        serviceDescriptions.periodEnd
      )
      .orderBy(
        // Sort by estimated value descending (nulls last)
        sql`(${sum(timeEntries.hours)} * ${clients.hourlyRate}) DESC NULLS LAST`
      );

    // Transform results to response format
    const response = results.map((row: UnbilledSummaryQueryResult) => {
      const hourlyRate = serializeDecimal(row.hourlyRate);
      const totalUnbilledHours = serializeDecimal(row.totalUnbilledHours);
      const estimatedValue =
        hourlyRate !== null && totalUnbilledHours !== null
          ? hourlyRate * totalUnbilledHours
          : null;

      // Handle draft info - access raw SQL fields from the result
      // The raw SQL subquery returns draft_id, draft_period_start, draft_period_end fields
      const draftId = row.draft_id || row.existingDraftId;
      const draftPeriodStart = row.draft_period_start || row.existingDraftPeriodStart;
      const draftPeriodEnd = row.draft_period_end || row.existingDraftPeriodEnd;

      return {
        clientId: row.clientId,
        clientName: row.clientName,
        hourlyRate,
        totalUnbilledHours,
        estimatedValue,
        oldestEntryDate: row.oldestEntryDate,
        newestEntryDate: row.newestEntryDate,
        existingDraftId: draftId || null,
        existingDraftPeriod:
          draftId && draftPeriodStart && draftPeriodEnd
            ? `${draftPeriodStart} - ${draftPeriodEnd}`
            : null,
      };
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch unbilled summary:", error);
    return errorResponse("Failed to fetch unbilled summary", 500);
  }
}
