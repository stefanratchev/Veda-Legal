import type { ReportEntry } from "@/types/reports";

/**
 * Result shape for aggregation functions.
 * Used by Detail tab charts (Hours/Revenue by Client/Employee/Topic).
 */
export interface AggregationResult {
  id: string;
  name: string;
  totalHours: number;
  revenue: number | null;
}

/**
 * Filter entries by client, employee, and topic.
 * Empty Set = show all (no filter for that dimension).
 * AND across dimensions, OR within.
 */
export function filterEntries(
  entries: ReportEntry[],
  clientIds: Set<string>,
  employeeIds: Set<string>,
  topicNames: Set<string>
): ReportEntry[] {
  return entries.filter((entry) => {
    const matchClient = clientIds.size === 0 || clientIds.has(entry.clientId);
    const matchEmployee = employeeIds.size === 0 || employeeIds.has(entry.userId);
    const matchTopic = topicNames.size === 0 || topicNames.has(entry.topicName);
    return matchClient && matchEmployee && matchTopic;
  });
}

/**
 * Generic aggregation helper.
 * Groups entries by a key function, extracts name via name function,
 * sums hours and revenue, sorts by totalHours descending.
 */
function aggregateBy(
  entries: ReportEntry[],
  keyFn: (e: ReportEntry) => string,
  nameFn: (e: ReportEntry) => string
): AggregationResult[] {
  const map = new Map<
    string,
    { name: string; totalHours: number; revenueSum: number; hasNonNullRevenue: boolean }
  >();

  for (const entry of entries) {
    const key = keyFn(entry);
    if (!map.has(key)) {
      map.set(key, { name: nameFn(entry), totalHours: 0, revenueSum: 0, hasNonNullRevenue: false });
    }
    const group = map.get(key)!;
    group.totalHours += entry.hours;
    if (entry.revenue !== null) {
      group.revenueSum += entry.revenue;
      group.hasNonNullRevenue = true;
    }
  }

  return Array.from(map.entries())
    .map(([id, group]) => ({
      id,
      name: group.name,
      totalHours: group.totalHours,
      revenue: group.hasNonNullRevenue ? group.revenueSum : null,
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
}

/**
 * Aggregate entries by client.
 * Returns sorted by totalHours descending.
 */
export function aggregateByClient(entries: ReportEntry[]): AggregationResult[] {
  return aggregateBy(
    entries,
    (e) => e.clientId,
    (e) => e.clientName
  );
}

/**
 * Aggregate entries by employee.
 * Returns sorted by totalHours descending.
 */
export function aggregateByEmployee(entries: ReportEntry[]): AggregationResult[] {
  return aggregateBy(
    entries,
    (e) => e.userId,
    (e) => e.userName
  );
}

/**
 * Aggregate entries by topic.
 * Returns sorted by totalHours descending.
 * Uses topicName as both id and name (no separate topic ID on ReportEntry).
 */
export function aggregateByTopic(entries: ReportEntry[]): AggregationResult[] {
  return aggregateBy(
    entries,
    (e) => e.topicName,
    (e) => e.topicName
  );
}
