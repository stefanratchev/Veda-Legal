import { sql, eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeEntries, clients, users } from "@/lib/schema";
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

  // Query 2: Per-employee monthly aggregation
  const employeeRows = await db
    .select({
      month: sql<string>`DATE_TRUNC('month', ${timeEntries.date})::date`.as(
        "month"
      ),
      userId: timeEntries.userId,
      userName: users.name,
      hours: sql<string>`COALESCE(SUM(${timeEntries.hours}), 0)`,
    })
    .from(timeEntries)
    .innerJoin(users, eq(timeEntries.userId, users.id))
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
    { id: string; name: string; hours: number }[]
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
    });
  }

  // Build the full 12-month array, defaulting missing months to zeros
  const months: MonthlyTrendPoint[] = monthStarts.map((monthStart) => {
    const firm = firmMap.get(monthStart);
    const totalHours = firm?.totalHours ?? 0;
    const regularHours = firm?.regularHours ?? 0;
    const revenue = firm?.revenue ?? 0;
    const activeClients = firm?.activeClients ?? 0;

    return {
      month: monthStart.slice(0, 7), // "YYYY-MM"
      label: formatMonthLabel(monthStart),
      totalHours,
      revenue,
      activeClients,
      utilization: calculateUtilization(regularHours, totalHours),
      byEmployee: employeeMap.get(monthStart) ?? [],
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
