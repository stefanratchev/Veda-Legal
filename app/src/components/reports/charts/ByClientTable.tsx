"use client";

import { useMemo } from "react";
import type { MonthlyTrendPoint } from "@/types/reports";
import {
  TrendTable,
  type TrendTableCell,
  type TrendTableMode,
  type TrendTableRow,
} from "./TrendTable";

// Ratio modes live here too (local constant). Lets us pick the default cell
// shape for absent entries: denom=1 for absolute modes, denom=0 for ratio
// modes — both display as "—" when there is no data.
const RATIO_MODES_IN_WRAPPER: readonly TrendTableMode[] = [
  "realization",
  "utilization",
  "effectiveRate",
];

function pickCell(
  c: MonthlyTrendPoint["byClient"][number],
  mode: TrendTableMode,
): TrendTableCell {
  switch (mode) {
    case "billableHours":
      return { numerator: c.billableHours, denominator: 1 };
    case "billedHours":
      return { numerator: c.billedHours, denominator: 1 };
    case "unbillableHours":
      return {
        numerator: Math.max(0, c.hours - c.billableHours),
        denominator: 1,
      };
    case "billableRevenue":
      return { numerator: c.billableRevenue, denominator: 1 };
    case "billedRevenue":
      return { numerator: c.billedRevenue, denominator: 1 };
    case "lostRevenue":
      return {
        numerator: Math.max(0, c.standardRateValue - c.billedRevenue),
        denominator: 1,
      };
    case "realization":
      return { numerator: c.billedRevenue, denominator: c.standardRateValue };
    case "utilization":
      return { numerator: c.billableHours, denominator: c.hours };
    case "effectiveRate":
      return { numerator: c.billedRevenue, denominator: c.billedHours };
  }
}

interface ByClientTableProps {
  data: MonthlyTrendPoint[];
  mode: TrendTableMode;
}

/**
 * Renders per-client monthly trend values through the shared TrendTable.
 * Caps display at the top 20 clients by most-recent-month value; any
 * remainder is rolled into a single muted "Others" row.
 */
export function ByClientTable({ data, mode }: ByClientTableProps) {
  const { rows, monthLabels } = useMemo(() => {
    const labels = data.map((m) => m.label);
    const defaultDenom = RATIO_MODES_IN_WRAPPER.includes(mode) ? 0 : 1;

    const clientMap = new Map<
      string,
      { id: string; name: string; monthly: TrendTableCell[] }
    >();

    for (let i = 0; i < data.length; i++) {
      for (const c of data[i].byClient) {
        if (!clientMap.has(c.id)) {
          clientMap.set(c.id, {
            id: c.id,
            name: c.name,
            monthly: Array.from({ length: data.length }, () => ({
              numerator: 0,
              denominator: defaultDenom,
            })),
          });
        }
        const entry = clientMap.get(c.id)!;
        entry.monthly[i] = pickCell(c, mode);
      }
    }

    const tableRows: TrendTableRow[] = Array.from(clientMap.values()).map(
      (c) => ({
        id: c.id,
        name: c.name,
        monthlyCells: c.monthly,
      }),
    );

    return { rows: tableRows, monthLabels: labels };
  }, [data, mode]);

  return (
    <TrendTable
      rows={rows}
      monthLabels={monthLabels}
      mode={mode}
      entityLabel="Client"
      topN={20}
    />
  );
}
