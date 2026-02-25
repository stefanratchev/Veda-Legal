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
  _entries: ReportEntry[],
  _clientIds: Set<string>,
  _employeeIds: Set<string>,
  _topicNames: Set<string>
): ReportEntry[] {
  return [];
}

/**
 * Aggregate entries by client.
 * Returns sorted by totalHours descending.
 */
export function aggregateByClient(
  _entries: ReportEntry[]
): AggregationResult[] {
  return [];
}

/**
 * Aggregate entries by employee.
 * Returns sorted by totalHours descending.
 */
export function aggregateByEmployee(
  _entries: ReportEntry[]
): AggregationResult[] {
  return [];
}

/**
 * Aggregate entries by topic.
 * Returns sorted by totalHours descending.
 */
export function aggregateByTopic(
  _entries: ReportEntry[]
): AggregationResult[] {
  return [];
}
