import { sql, eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeEntries, clients, users, serviceDescriptions } from "@/lib/schema";
import { serializeServiceDescription } from "@/lib/billing-utils";
import {
  calculateGrandTotal,
  calculateRetainerGrandTotal,
} from "@/lib/billing-pdf";
import type { MonthlyTrendPoint, TrendResponse } from "@/types/reports";

/**
 * Generate an array of 12 ISO date strings representing the first day of each
 * month, from 11 months ago through the current month.
 */
export function generateLast12Months(now: Date = new Date()): string[] {
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}-01`);
  }
  return months;
}

/**
 * Convert an ISO date string like "2025-05-01" to a display label like "May '25".
 */
export function formatMonthLabel(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  const monthName = d.toLocaleDateString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  const year = String(d.getUTCFullYear()).slice(2);
  return `${monthName} '${year}`;
}

/**
 * Calculate utilization as percentage of regular (billable) hours to total hours.
 * Returns 0 when total is 0 to avoid division by zero.
 */
export function calculateUtilization(
  regularHours: number,
  totalHours: number
): number {
  return totalHours > 0
    ? Math.round((regularHours / totalHours) * 100)
    : 0;
}

/**
 * Compute total billed hours and total standard-rate value for a single
 * serialized service description's topics array.
 *
 * - billedHours: sum of hours across all line items (HOURLY + FIXED both contribute), per D-01
 * - standardValue: hours * rate, where rate is topic.hourlyRate (HOURLY) or
 *   clientHourlyRate (FIXED). When rate is missing, that line contributes 0
 *   to standardValue but still contributes to billedHours.
 *
 * Line items with hours <= 0 are skipped. For TE-linked items, originalHours
 * is preferred over hours (matches the legacy inline loop at trend-utils.ts:250).
 *
 * Exported for unit testing — getTrendData uses this internally per SD.
 */
export function accumulateBilledHoursForSd(
  topics: Array<{
    pricingMode: string;
    hourlyRate: number | null;
    lineItems: Array<{
      timeEntryId: string | null;
      originalHours?: number | null;
      hours: number | null;
    }>;
  }>,
  clientHourlyRate: number | null
): { standardValue: number; billedHours: number } {
  let standardValue = 0;
  let billedHours = 0;
  for (const topic of topics) {
    for (const item of topic.lineItems) {
      const hours = item.timeEntryId
        ? (item.originalHours ?? item.hours ?? 0)
        : (item.hours ?? 0);
      if (hours <= 0) continue;

      billedHours += hours;

      if (topic.pricingMode === "HOURLY" && topic.hourlyRate) {
        standardValue += hours * topic.hourlyRate;
      } else if (topic.pricingMode === "FIXED" && clientHourlyRate) {
        standardValue += hours * clientHourlyRate;
      }
    }
  }
  return { standardValue, billedHours };
}

/**
 * Fetch and aggregate the last 12 months of time entry data for the trend dashboard.
 */
export async function getTrendData(): Promise<TrendResponse> {
  const monthStarts = generateLast12Months();
  const startDate = monthStarts[0]; // first day of oldest month

  // Last day of the most recent month
  const lastMonthStart = monthStarts[monthStarts.length - 1];
  const lastParts = lastMonthStart.split("-").map(Number);
  const endDateObj = new Date(lastParts[0], lastParts[1], 0); // day 0 of next month = last day of this month
  const endDate = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, "0")}-${String(endDateObj.getDate()).padStart(2, "0")}`;

  // Query 1: Firm-wide monthly aggregation
  const firmRows = await db
    .select({
      month: sql<string>`DATE_TRUNC('month', ${timeEntries.date})::date`.as(
        "month"
      ),
      totalHours: sql<string>`COALESCE(SUM(${timeEntries.hours}), 0)`,
      regularHours: sql<string>`COALESCE(SUM(CASE WHEN ${clients.clientType} = 'REGULAR' AND ${timeEntries.isWrittenOff} = false THEN ${timeEntries.hours} ELSE 0 END), 0)`,
      revenue: sql<string>`COALESCE(SUM(CASE WHEN ${clients.clientType} = 'REGULAR' AND ${timeEntries.isWrittenOff} = false THEN ${timeEntries.hours} * ${clients.hourlyRate} ELSE 0 END), 0)`,
      activeClients: sql<string>`COUNT(DISTINCT ${timeEntries.clientId})`,
    })
    .from(timeEntries)
    .innerJoin(clients, eq(timeEntries.clientId, clients.id))
    .where(and(gte(timeEntries.date, startDate), lte(timeEntries.date, endDate)))
    .groupBy(sql`DATE_TRUNC('month', ${timeEntries.date})::date`)
    .orderBy(sql`month`);

  // Query 2: Per-employee monthly aggregation (total + billable hours)
  const employeeRows = await db
    .select({
      month: sql<string>`DATE_TRUNC('month', ${timeEntries.date})::date`.as(
        "month"
      ),
      userId: timeEntries.userId,
      userName: users.name,
      hours: sql<string>`COALESCE(SUM(${timeEntries.hours}), 0)`,
      billableHours: sql<string>`COALESCE(SUM(CASE WHEN ${clients.clientType} = 'REGULAR' AND ${timeEntries.isWrittenOff} = false THEN ${timeEntries.hours} ELSE 0 END), 0)`,
    })
    .from(timeEntries)
    .innerJoin(users, eq(timeEntries.userId, users.id))
    .innerJoin(clients, eq(timeEntries.clientId, clients.id))
    .where(and(gte(timeEntries.date, startDate), lte(timeEntries.date, endDate)))
    .groupBy(
      sql`DATE_TRUNC('month', ${timeEntries.date})::date`,
      timeEntries.userId,
      users.name
    )
    .orderBy(sql`month`);

  // Build lookup maps keyed by "YYYY-MM-01" string
  const firmMap = new Map<
    string,
    {
      totalHours: number;
      regularHours: number;
      revenue: number;
      activeClients: number;
    }
  >();

  for (const row of firmRows) {
    const key = String(row.month);
    firmMap.set(key, {
      totalHours: Number(row.totalHours),
      regularHours: Number(row.regularHours),
      revenue: Number(row.revenue),
      activeClients: Number(row.activeClients),
    });
  }

  const employeeMap = new Map<
    string,
    { id: string; name: string; hours: number; billableHours: number }[]
  >();

  for (const row of employeeRows) {
    const key = String(row.month);
    if (!employeeMap.has(key)) {
      employeeMap.set(key, []);
    }
    employeeMap.get(key)!.push({
      id: row.userId,
      name: row.userName || "Unknown",
      hours: Number(row.hours),
      billableHours: Number(row.billableHours),
    });
  }

  // Query 3: Finalized service descriptions whose billing period ends in the
  // 12-month window. Bucketing by `periodEnd` (not `finalizedAt`) keeps
  // revenue aligned with when the work was performed, not when the partner
  // clicked Finalize.
  const finalizedSDs = await db.query.serviceDescriptions.findMany({
    where: and(
      eq(serviceDescriptions.status, "FINALIZED"),
      gte(serviceDescriptions.periodEnd, startDate),
      lte(serviceDescriptions.periodEnd, endDate),
    ),
    columns: {
      id: true,
      clientId: true,
      finalizedAt: true,
      discountType: true,
      discountValue: true,
      retainerFee: true,
      retainerHours: true,
      retainerOverageRate: true,
      periodStart: true,
      periodEnd: true,
      status: true,
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
          retainerFee: true,
          retainerHours: true,
          notes: true,
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
          capHours: true,
          discountType: true,
          discountValue: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          lineItems: {
            columns: {
              id: true,
              timeEntryId: true,
              date: true,
              description: true,
              hours: true,
              displayOrder: true,
              waiveMode: true,
              createdAt: true,
              updatedAt: true,
            },
            with: {
              timeEntry: {
                columns: { hours: true, description: true },
                with: { user: { columns: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  // Compute billed revenue, standard rate value, and billed hours per month,
  // bucketed by the SD's periodEnd so revenue lands in the month the work covered.
  const billingMap = new Map<
    string,
    { billedRevenue: number; standardRateValue: number; billedHours: number }
  >();
  // Per-employee billed revenue keyed by "YYYY-MM-01:employeeName"
  const employeeBilledMap = new Map<string, number>();

  for (const rawSd of finalizedSDs) {
    if (!rawSd.periodEnd) continue;
    const bucketMonth = rawSd.periodEnd.slice(0, 7) + "-01"; // "YYYY-MM-01"

    const sd = serializeServiceDescription(rawSd as Parameters<typeof serializeServiceDescription>[0]);

    // Compute grand total (numerator)
    const isRetainer = sd.retainerFee != null && sd.retainerHours != null;
    const grandTotal = isRetainer
      ? calculateRetainerGrandTotal(
          sd.topics,
          sd.retainerFee!,
          sd.retainerHours!,
          sd.retainerOverageRate || 0,
          sd.discountType,
          sd.discountValue,
        )
      : calculateGrandTotal(sd.topics, sd.discountType, sd.discountValue);

    // Compute standard rate value (denominator) + billed hours via shared helper
    const { standardValue, billedHours: billedHoursForSd } =
      accumulateBilledHoursForSd(sd.topics, sd.client.hourlyRate ?? null);

    const entry =
      billingMap.get(bucketMonth) ??
      { billedRevenue: 0, standardRateValue: 0, billedHours: 0 };
    entry.billedRevenue += grandTotal;
    entry.standardRateValue += standardValue;
    entry.billedHours += billedHoursForSd;
    billingMap.set(bucketMonth, entry);

    // Attribute billed revenue to employees proportionally by their standard-rate contribution
    // First compute per-employee standard value for this SD
    const empStandardValues = new Map<string, { name: string; value: number }>();
    for (const topic of sd.topics) {
      for (const item of topic.lineItems) {
        if (!item.timeEntryId || !item.employeeName) continue;
        const hours = item.originalHours ?? item.hours ?? 0;
        if (hours <= 0) continue;

        let rate = 0;
        if (topic.pricingMode === "HOURLY" && topic.hourlyRate) {
          rate = topic.hourlyRate;
        } else if (topic.pricingMode === "FIXED" && sd.client.hourlyRate) {
          rate = sd.client.hourlyRate;
        }

        // Use timeEntryId as a proxy to find the userId — we need to look it up
        // from the line item's timeEntry relation. The employeeName is available.
        const empName = item.employeeName;
        const existing = empStandardValues.get(empName) ?? { name: empName, value: 0 };
        existing.value += hours * rate;
        empStandardValues.set(empName, existing);
      }
    }

    // Proportionally allocate grandTotal to employees
    const totalStandard = Array.from(empStandardValues.values()).reduce((sum, e) => sum + e.value, 0);
    if (totalStandard > 0) {
      for (const [empName, emp] of empStandardValues) {
        const proportion = emp.value / totalStandard;
        const allocated = grandTotal * proportion;

        const empKey = `${bucketMonth}:${empName}`;
        const empEntry = employeeBilledMap.get(empKey) ?? 0;
        employeeBilledMap.set(empKey, empEntry + allocated);
      }
    }
  }

  // Build the full 12-month array, defaulting missing months to zeros
  const months: MonthlyTrendPoint[] = monthStarts.map((monthStart) => {
    const firm = firmMap.get(monthStart);
    const totalHours = firm?.totalHours ?? 0;
    const regularHours = firm?.regularHours ?? 0;
    const revenue = firm?.revenue ?? 0;
    const activeClients = firm?.activeClients ?? 0;
    const billing = billingMap.get(monthStart);
    const billedRevenue = Math.round((billing?.billedRevenue ?? 0) * 100) / 100;
    const standardRateValue = Math.round((billing?.standardRateValue ?? 0) * 100) / 100;
    const billedHours = Math.round((billing?.billedHours ?? 0) * 100) / 100;

    return {
      month: monthStart.slice(0, 7), // "YYYY-MM"
      label: formatMonthLabel(monthStart),
      totalHours,
      billableHours: regularHours,
      revenue,
      activeClients,
      utilization: calculateUtilization(regularHours, totalHours),
      billedRevenue,
      standardRateValue,
      billedHours,
      realization: standardRateValue > 0 ? Math.round((billedRevenue / standardRateValue) * 100) : 0,
      byEmployee: (employeeMap.get(monthStart) ?? []).map((emp) => ({
        ...emp,
        billedRevenue: Math.round((employeeBilledMap.get(`${monthStart}:${emp.name}`) ?? 0) * 100) / 100,
      })),
    };
  });

  const latest = months[months.length - 1];
  const previous = months[months.length - 2];

  return {
    months,
    latest: {
      totalHours: latest.totalHours,
      revenue: latest.revenue,
      activeClients: latest.activeClients,
      utilization: latest.utilization,
    },
    previous: {
      totalHours: previous.totalHours,
      revenue: previous.revenue,
      activeClients: previous.activeClients,
      utilization: previous.utilization,
    },
  };
}
