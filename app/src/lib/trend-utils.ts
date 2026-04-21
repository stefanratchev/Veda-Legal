import { sql, eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeEntries, clients, users, serviceDescriptions } from "@/lib/schema";
import { serializeServiceDescription } from "@/lib/billing-utils";
import {
  calculateGrandTotal,
  calculateRetainerGrandTotal,
} from "@/lib/billing-pdf";
import { BILLING_START_DATE } from "@/lib/billing-config";
import type { MonthlyTrendPoint, TrendResponse } from "@/types/reports";
import type { ServiceDescription } from "@/types";

/**
 * Generate ISO date strings for the first day of each month in the trend
 * window. Default window is the last 12 months ending at `now`, but when a
 * `floor` date is provided, any months before the floor's month are excluded.
 *
 * With a floor newer than 11 months ago the array is shorter than 12; the
 * window grows month-by-month until the rolling 12-month cap takes over.
 */
export function generateLast12Months(now: Date = new Date(), floor?: string): string[] {
  const floorMonthKey = floor ? floor.slice(0, 7) + "-01" : null;
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const iso = `${year}-${month}-01`;
    if (floorMonthKey && iso < floorMonthKey) continue;
    months.push(iso);
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
 * A line item flattened for bucket allocation. Positive-hours items only;
 * zero/negative-hour items are dropped by buildSdLineItems.
 */
export interface LineItemForAllocation {
  date: string | null;
  hours: number;
  standardValue: number;
  isWaived: boolean;
  employeeName: string | null;
}

/**
 * Flatten an SD's topics into positive-hours line items annotated with
 * standardValue (hours * rate) and waive state.
 *
 * HOURLY topics use `topic.hourlyRate`; FIXED topics use `client.hourlyRate`
 * as the standard-rate proxy. When rate is missing, standardValue is 0 but
 * hours still count. For TE-linked items, originalHours is preferred over
 * the (possibly edited) billed hours so the standard-rate value reflects
 * what was actually worked.
 */
export function buildSdLineItems(sd: {
  topics: Array<{
    pricingMode: "HOURLY" | "FIXED";
    hourlyRate: number | null;
    lineItems: Array<{
      timeEntryId: string | null;
      originalHours?: number;
      hours: number | null;
      date: string | null;
      waiveMode: "EXCLUDED" | "ZERO" | null;
      employeeName?: string;
    }>;
  }>;
  client: { hourlyRate: number | null };
}): LineItemForAllocation[] {
  const out: LineItemForAllocation[] = [];
  for (const topic of sd.topics) {
    const rate =
      topic.pricingMode === "HOURLY"
        ? (topic.hourlyRate ?? 0)
        : (sd.client.hourlyRate ?? 0);
    for (const li of topic.lineItems) {
      const hours = li.timeEntryId
        ? (li.originalHours ?? li.hours ?? 0)
        : (li.hours ?? 0);
      if (hours <= 0) continue;
      out.push({
        date: li.date,
        hours,
        standardValue: hours * rate,
        isWaived: li.waiveMode === "EXCLUDED" || li.waiveMode === "ZERO",
        employeeName: li.employeeName ?? null,
      });
    }
  }
  return out;
}

/**
 * Pick the date used for manual line items without an explicit date.
 * Uses the date of the largest (by hours) non-waived item with a date.
 * Falls back to `periodEnd` when no non-waived dated items exist.
 */
export function pickFallbackDate(
  items: LineItemForAllocation[],
  periodEnd: string,
): string {
  let best: LineItemForAllocation | null = null;
  for (const i of items) {
    if (i.isWaived || i.date == null) continue;
    if (best == null || i.hours > best.hours) best = i;
  }
  return best?.date ?? periodEnd;
}

/**
 * The month with the most non-waived hours across the SD's line items.
 * Ties broken by the latest month. Used to place the retainer fee, which
 * isn't tied to any specific line item. Falls back to the periodEnd bucket
 * when there are no non-waived items.
 */
export function pickDominantMonth(
  itemsWithBucket: Array<LineItemForAllocation & { bucketMonth: string }>,
  periodEnd: string,
): string {
  const periodEndBucket = periodEnd.slice(0, 7) + "-01";
  const byMonth = new Map<string, number>();
  for (const i of itemsWithBucket) {
    if (i.isWaived) continue;
    byMonth.set(i.bucketMonth, (byMonth.get(i.bucketMonth) ?? 0) + i.hours);
  }
  if (byMonth.size === 0) return periodEndBucket;
  let topMonth: string | null = null;
  let topHours = -1;
  for (const [month, hours] of byMonth) {
    if (hours > topHours || (hours === topHours && topMonth != null && month > topMonth)) {
      topHours = hours;
      topMonth = month;
    }
  }
  return topMonth ?? periodEndBucket;
}

/**
 * For a retainer SD, split the grand total into the retainer-fee portion
 * and the rest (overage + fixed topics). The SD-level discount is applied
 * proportionally so this works for both PERCENTAGE and AMOUNT discounts:
 * compute the pre-discount retainer total and use its ratio to grandTotal.
 */
export function splitRetainerGrandTotal(
  sd: {
    topics: ServiceDescription["topics"];
    retainerFee: number;
    retainerHours: number;
    retainerOverageRate: number | null;
    discountType: "PERCENTAGE" | "AMOUNT" | null;
    discountValue: number | null;
  },
  grandTotal: number,
): { retainerPortion: number; nonRetainerGrandTotal: number } {
  const preDiscountTotal = calculateRetainerGrandTotal(
    sd.topics,
    sd.retainerFee,
    sd.retainerHours,
    sd.retainerOverageRate ?? 0,
    null,
    null,
  );
  if (preDiscountTotal <= 0) {
    return { retainerPortion: 0, nonRetainerGrandTotal: grandTotal };
  }
  const discountFactor = grandTotal / preDiscountTotal;
  const retainerPortion = sd.retainerFee * discountFactor;
  return {
    retainerPortion,
    nonRetainerGrandTotal: grandTotal - retainerPortion,
  };
}

/**
 * Distribute an SD's billed revenue, standard-rate value, and billed hours
 * into per-month buckets keyed by `lineItem.date`. Manual items without a
 * date use the fallback (largest non-waived dated item, else periodEnd).
 *
 * Waived items contribute to `standardRateValue` (so they show as lost
 * revenue) but NOT to `billedHours` or the pro-rata `billedRevenue`
 * distribution.
 *
 * For retainer SDs, the retainer-fee portion is placed in the dominant
 * month; the rest (overage + fixed topic totals) is distributed per line
 * item. Per-employee billed revenue is allocated proportionally to
 * non-waived standard share within each SD.
 */
export function allocateSdToBuckets(
  sd: ServiceDescription,
  periodEnd: string,
): {
  byMonth: Map<string, { billedRevenue: number; standardRateValue: number; billedHours: number }>;
  empBilledByMonth: Map<string, number>;
  empBilledHoursByMonth: Map<string, number>;
} {
  const items = buildSdLineItems(sd);
  const fallbackDate = pickFallbackDate(items, periodEnd);
  const itemsWithBucket = items.map((i) => ({
    ...i,
    bucketMonth: (i.date ?? fallbackDate).slice(0, 7) + "-01",
  }));

  const isRetainer = sd.retainerFee != null && sd.retainerHours != null;
  const grandTotal = isRetainer
    ? calculateRetainerGrandTotal(
        sd.topics,
        sd.retainerFee!,
        sd.retainerHours!,
        sd.retainerOverageRate ?? 0,
        sd.discountType,
        sd.discountValue,
      )
    : calculateGrandTotal(sd.topics, sd.discountType, sd.discountValue);

  const { retainerPortion, nonRetainerGrandTotal } = isRetainer
    ? splitRetainerGrandTotal(
        {
          topics: sd.topics,
          retainerFee: sd.retainerFee!,
          retainerHours: sd.retainerHours!,
          retainerOverageRate: sd.retainerOverageRate ?? 0,
          discountType: sd.discountType,
          discountValue: sd.discountValue,
        },
        grandTotal,
      )
    : { retainerPortion: 0, nonRetainerGrandTotal: grandTotal };

  const nonWaivedTotal = itemsWithBucket
    .filter((i) => !i.isWaived)
    .reduce((s, i) => s + i.standardValue, 0);

  const byMonth = new Map<
    string,
    { billedRevenue: number; standardRateValue: number; billedHours: number }
  >();
  const empBilledByMonth = new Map<string, number>();
  const empBilledHoursByMonth = new Map<string, number>();

  const ensureBucket = (month: string) => {
    let e = byMonth.get(month);
    if (!e) {
      e = { billedRevenue: 0, standardRateValue: 0, billedHours: 0 };
      byMonth.set(month, e);
    }
    return e;
  };

  for (const i of itemsWithBucket) {
    const entry = ensureBucket(i.bucketMonth);
    // Standard value: all items contribute (waived too — they are lost revenue).
    entry.standardRateValue += i.standardValue;
    if (i.isWaived) continue;

    entry.billedHours += i.hours;

    if (nonWaivedTotal > 0) {
      const revShare = (i.standardValue / nonWaivedTotal) * nonRetainerGrandTotal;
      entry.billedRevenue += revShare;

      if (i.employeeName) {
        const empKey = `${i.bucketMonth}:${i.employeeName}`;
        empBilledByMonth.set(empKey, (empBilledByMonth.get(empKey) ?? 0) + revShare);
        empBilledHoursByMonth.set(
          empKey,
          (empBilledHoursByMonth.get(empKey) ?? 0) + i.hours,
        );
      }
    }
  }

  // Fully-waived SD with nonzero non-retainer grand total (e.g. a FIXED
  // topic fee that survived even though all its line items were waived).
  // The pro-rata loop above had no non-waived base, so attribute the
  // orphaned revenue to the periodEnd bucket.
  if (nonWaivedTotal <= 0 && nonRetainerGrandTotal > 0) {
    const entry = ensureBucket(periodEnd.slice(0, 7) + "-01");
    entry.billedRevenue += nonRetainerGrandTotal;
  }

  // Retainer fee: entirely to the dominant month. Per-employee allocation
  // uses the SD's non-waived standard-value share.
  if (retainerPortion > 0) {
    const dominantMonth = pickDominantMonth(itemsWithBucket, periodEnd);
    ensureBucket(dominantMonth).billedRevenue += retainerPortion;

    if (nonWaivedTotal > 0) {
      const perEmpShares = new Map<string, number>();
      for (const i of itemsWithBucket) {
        if (i.isWaived || !i.employeeName) continue;
        perEmpShares.set(
          i.employeeName,
          (perEmpShares.get(i.employeeName) ?? 0) + i.standardValue,
        );
      }
      for (const [empName, share] of perEmpShares) {
        const empRetainerShare = (share / nonWaivedTotal) * retainerPortion;
        const empKey = `${dominantMonth}:${empName}`;
        empBilledByMonth.set(
          empKey,
          (empBilledByMonth.get(empKey) ?? 0) + empRetainerShare,
        );
      }
    }
  }

  return { byMonth, empBilledByMonth, empBilledHoursByMonth };
}

/**
 * Fetch and aggregate the last 12 months of time entry data for the trend dashboard.
 */
export async function getTrendData(): Promise<TrendResponse> {
  const monthStarts = generateLast12Months(new Date(), BILLING_START_DATE);
  const startDate = monthStarts[0]; // first day of oldest month (floored at BILLING_START_DATE)

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
      billableRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${clients.clientType} = 'REGULAR' AND ${timeEntries.isWrittenOff} = false THEN ${timeEntries.hours} * ${clients.hourlyRate} ELSE 0 END), 0)`,
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
    { id: string; name: string; hours: number; billableHours: number; billableRevenue: number }[]
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
      billableRevenue: Number(row.billableRevenue),
    });
  }

  // Query 3: Finalized service descriptions whose billing period ends in the
  // 12-month window. The actual per-month allocation inside allocateSdToBuckets
  // buckets by each line item's own date, which is finer-grained than periodEnd.
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

  // Per-month firm-level totals, bucketed by line-item date.
  const billingMap = new Map<
    string,
    { billedRevenue: number; standardRateValue: number; billedHours: number }
  >();
  // Per-employee billed revenue/hours keyed by "YYYY-MM-01:employeeName".
  const employeeBilledMap = new Map<string, number>();
  const employeeBilledHoursMap = new Map<string, number>();

  for (const rawSd of finalizedSDs) {
    if (!rawSd.periodEnd) continue;
    const sd = serializeServiceDescription(
      rawSd as Parameters<typeof serializeServiceDescription>[0],
    );
    const allocation = allocateSdToBuckets(sd, rawSd.periodEnd);

    for (const [bucket, val] of allocation.byMonth) {
      const entry = billingMap.get(bucket) ?? {
        billedRevenue: 0,
        standardRateValue: 0,
        billedHours: 0,
      };
      entry.billedRevenue += val.billedRevenue;
      entry.standardRateValue += val.standardRateValue;
      entry.billedHours += val.billedHours;
      billingMap.set(bucket, entry);
    }
    for (const [key, val] of allocation.empBilledByMonth) {
      employeeBilledMap.set(key, (employeeBilledMap.get(key) ?? 0) + val);
    }
    for (const [key, val] of allocation.empBilledHoursByMonth) {
      employeeBilledHoursMap.set(
        key,
        (employeeBilledHoursMap.get(key) ?? 0) + val,
      );
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
        billedHours: Math.round((employeeBilledHoursMap.get(`${monthStart}:${emp.name}`) ?? 0) * 100) / 100,
      })),
    };
  });

  // When the window is short (e.g. only 1 month past the floor), fall back
  // to zeros for missing latest/previous so callers can render a month-1
  // trend without special-casing.
  const latest = months[months.length - 1];
  const previous = months[months.length - 2];

  return {
    months,
    latest: {
      totalHours: latest?.totalHours ?? 0,
      revenue: latest?.revenue ?? 0,
      activeClients: latest?.activeClients ?? 0,
      utilization: latest?.utilization ?? 0,
    },
    previous: {
      totalHours: previous?.totalHours ?? 0,
      revenue: previous?.revenue ?? 0,
      activeClients: previous?.activeClients ?? 0,
      utilization: previous?.utilization ?? 0,
    },
  };
}
