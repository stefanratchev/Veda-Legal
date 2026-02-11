import { serializeDecimal } from "@/lib/api-utils";
import type { ServiceDescription } from "@/types";

/**
 * Input type for the raw Drizzle query result before serialization.
 * The `timeEntry` field on line items is optional — present when the query
 * includes the timeEntry relation (page.tsx, detail API), absent for PDF.
 */
interface RawServiceDescription {
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
  status: string;
  finalizedAt: string | null;
  discountType: string | null;
  discountValue: string | null;
  topics: Array<{
    id: string;
    topicName: string;
    displayOrder: number;
    pricingMode: string;
    hourlyRate: string | null;
    fixedFee: string | null;
    capHours: string | null;
    discountType: string | null;
    discountValue: string | null;
    lineItems: Array<{
      id: string;
      timeEntryId: string | null;
      date: string | null;
      description: string;
      hours: string | null;
      fixedAmount: string | null;
      displayOrder: number;
      timeEntry?: {
        description: string;
        hours: string;
        user: { name: string | null } | null;
      } | null;
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Converts a raw Drizzle service description query result into the
 * serialized ServiceDescription type used by the API and client components.
 * Handles decimal string → number conversion for all numeric fields.
 * When timeEntry data is present on line items, includes originalDescription,
 * originalHours, and employeeName.
 */
export function serializeServiceDescription(sd: RawServiceDescription): ServiceDescription {
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
    status: sd.status as "DRAFT" | "FINALIZED",
    finalizedAt: sd.finalizedAt || null,
    discountType: (sd.discountType as "PERCENTAGE" | "AMOUNT" | null) || null,
    discountValue: serializeDecimal(sd.discountValue),
    topics: sd.topics.map((topic) => ({
      id: topic.id,
      topicName: topic.topicName,
      displayOrder: topic.displayOrder,
      pricingMode: topic.pricingMode as "HOURLY" | "FIXED",
      hourlyRate: serializeDecimal(topic.hourlyRate),
      fixedFee: serializeDecimal(topic.fixedFee),
      capHours: serializeDecimal(topic.capHours),
      discountType: (topic.discountType as "PERCENTAGE" | "AMOUNT" | null) || null,
      discountValue: serializeDecimal(topic.discountValue),
      lineItems: topic.lineItems.map((item) => ({
        id: item.id,
        timeEntryId: item.timeEntryId,
        date: item.date || null,
        description: item.description,
        hours: serializeDecimal(item.hours),
        fixedAmount: serializeDecimal(item.fixedAmount),
        displayOrder: item.displayOrder,
        ...(item.timeEntry ? {
          originalDescription: item.timeEntry.description,
          originalHours: serializeDecimal(item.timeEntry.hours) ?? undefined,
          employeeName: item.timeEntry.user?.name ?? undefined,
        } : {}),
      })),
    })),
    createdAt: sd.createdAt,
    updatedAt: sd.updatedAt,
  };
}

/**
 * Validates discount fields (type + value). Returns an error message string
 * if validation fails, or null if valid.
 */
export function validateDiscountFields(
  discountType: unknown,
  discountValue: unknown,
): string | null {
  if (discountType && !["PERCENTAGE", "AMOUNT"].includes(discountType as string)) {
    return "discountType must be PERCENTAGE or AMOUNT";
  }
  if (discountValue != null) {
    if (typeof discountValue !== "number" || !Number.isFinite(discountValue) || discountValue <= 0) {
      return "discountValue must be a positive number";
    }
    if (discountType === "PERCENTAGE" && (discountValue as number) > 100) {
      return "Percentage discount cannot exceed 100";
    }
  }
  if (!discountType && discountValue != null) {
    return "discountValue requires a discountType";
  }
  return null;
}

/**
 * Merges incoming discount fields with existing DB state for PATCH operations.
 * Returns the resulting type and value that would exist after the update.
 */
export function resolveDiscountFields(
  body: { discountType?: string | null; discountValue?: number | null },
  existing: { discountType: string | null; discountValue: string | null },
): { type: string | null; value: number | null } {
  const type = body.discountType !== undefined ? (body.discountType || null) : existing.discountType;
  const value = body.discountValue !== undefined
    ? body.discountValue
    : (existing.discountValue ? Number(existing.discountValue) : null);
  return { type, value };
}

/**
 * Validates capHours field. Returns an error message if invalid, null if valid.
 */
export function validateCapHours(capHours: unknown): string | null {
  if (capHours !== undefined && capHours !== null) {
    if (typeof capHours !== "number" || !Number.isFinite(capHours) || capHours <= 0) {
      return "capHours must be a positive number";
    }
  }
  return null;
}
