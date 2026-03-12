import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, errorResponse } from "@/lib/api-utils";
import { db } from "@/lib/db";
import {
  timeEntries,
  serviceDescriptionLineItems,
  serviceDescriptionTopics,
  serviceDescriptions,
} from "@/lib/schema";
import { eq, and, gte, lte, notInArray, sql } from "drizzle-orm";

/**
 * PATCH /api/timesheets/bulk-waive
 *
 * Bulk write-off unbilled time entries for a single client.
 * Sets isWrittenOff = true on all matching entries that are NOT linked to a FINALIZED service description.
 *
 * Body: { clientId: string, dateFrom?: string, dateTo?: string }
 * Returns: { success: true, updatedCount: number }
 *
 * Admin-only endpoint (ADMIN or PARTNER).
 *
 * Note: unbilled-summary already filters isWrittenOff = true,
 * so waived entries automatically disappear from the Ready to Bill view.
 * POST /api/billing (SD creation) already filters isWrittenOff entries,
 * so no changes needed there.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  try {
    const body = await request.json();
    const { clientId, dateFrom, dateTo } = body;

    // Validate clientId
    if (!clientId || typeof clientId !== "string" || clientId.trim() === "") {
      return errorResponse("clientId is required", 400);
    }

    // Validate date formats if provided
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (dateFrom !== undefined && dateFrom !== null) {
      if (typeof dateFrom !== "string" || !dateRegex.test(dateFrom) || isNaN(Date.parse(dateFrom))) {
        return errorResponse("dateFrom must be a valid date in YYYY-MM-DD format", 400);
      }
    }

    if (dateTo !== undefined && dateTo !== null) {
      if (typeof dateTo !== "string" || !dateRegex.test(dateTo) || isNaN(Date.parse(dateTo))) {
        return errorResponse("dateTo must be a valid date in YYYY-MM-DD format", 400);
      }
    }

    // Validate dateFrom <= dateTo when both provided
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return errorResponse("dateFrom must be before or equal to dateTo", 400);
    }

    // Build subquery: IDs of time entries linked to FINALIZED service descriptions
    const finalizedEntryIds = db
      .select({ id: serviceDescriptionLineItems.timeEntryId })
      .from(serviceDescriptionLineItems)
      .innerJoin(
        serviceDescriptionTopics,
        eq(serviceDescriptionLineItems.topicId, serviceDescriptionTopics.id)
      )
      .innerJoin(
        serviceDescriptions,
        and(
          eq(serviceDescriptionTopics.serviceDescriptionId, serviceDescriptions.id),
          eq(serviceDescriptions.status, "FINALIZED")
        )
      )
      .where(sql`${serviceDescriptionLineItems.timeEntryId} IS NOT NULL`);

    // Build WHERE conditions for the update
    const whereConditions = [
      eq(timeEntries.clientId, clientId),
      eq(timeEntries.isWrittenOff, false),
      notInArray(timeEntries.id, finalizedEntryIds),
    ];

    if (dateFrom) {
      whereConditions.push(gte(timeEntries.date, dateFrom));
    }
    if (dateTo) {
      whereConditions.push(lte(timeEntries.date, dateTo));
    }

    // Execute bulk update
    const result = await db
      .update(timeEntries)
      .set({
        isWrittenOff: true,
        updatedAt: new Date().toISOString(),
      })
      .where(and(...whereConditions));

    // Drizzle returns rowCount on the result for PostgreSQL
    const updatedCount = result.rowCount ?? 0;

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error("Failed to bulk waive time entries:", error);
    return errorResponse("Failed to bulk waive time entries", 500);
  }
}
