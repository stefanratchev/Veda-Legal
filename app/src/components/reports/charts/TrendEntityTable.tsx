"use client";

import { useMemo } from "react";
import type { MonthlyTrendPoint } from "@/types/reports";
import {
  TrendTable,
  type TrendTableCell,
  type TrendTableMode,
  type TrendTableRow,
} from "./TrendTable";

// Common shape across MonthlyTrendPoint.byEmployee[number] and byClient[number].
// Both carry the same fields; this alias avoids a branded discriminator and
// keeps pickCell a single implementation.
export type TrendEntity = {
  id: string;
  name: string;
  hours: number;
  billableHours: number;
  billableRevenue: number;
  billedRevenue: number;
  billedHours: number;
  standardRateValue: number;
};

// Ratio modes live here so we can pick the default cell shape for absent
// entries: denom=1 for absolute modes (0/1 → "—"), denom=0 for ratio modes
// (0/0 → "—"). Keeping a local list avoids importing a non-exported constant
// from TrendTable.
const RATIO_MODES: readonly TrendTableMode[] = [
  "realization",
  "utilization",
  "effectiveRate",
];

function pickCell(e: TrendEntity, mode: TrendTableMode): TrendTableCell {
  switch (mode) {
    case "billableHours":
      return { numerator: e.billableHours, denominator: 1 };
    case "billedHours":
      return { numerator: e.billedHours, denominator: 1 };
    case "unbillableHours":
      return {
        numerator: Math.max(0, e.hours - e.billableHours),
        denominator: 1,
      };
    case "billableRevenue":
      return { numerator: e.billableRevenue, denominator: 1 };
    case "billedRevenue":
      return { numerator: e.billedRevenue, denominator: 1 };
    case "lostRevenue":
      return {
        numerator: Math.max(0, e.standardRateValue - e.billedRevenue),
        denominator: 1,
      };
    case "realization":
      return { numerator: e.billedRevenue, denominator: e.standardRateValue };
    case "utilization":
      return { numerator: e.billableHours, denominator: e.hours };
    case "effectiveRate":
      return { numerator: e.billedRevenue, denominator: e.billedHours };
  }
}

interface TrendEntityTableProps {
  data: MonthlyTrendPoint[];
  mode: TrendTableMode;
  /** Extract the per-month entity array (byEmployee or byClient). */
  getEntities: (m: MonthlyTrendPoint) => TrendEntity[];
  entityLabel: string;
  topN?: number;
}

/**
 * Shared pivot table for per-entity monthly trends (employees, clients, …).
 * Walks each month's entity array, builds one row per unique entity id, and
 * passes TrendTableRow[] to the presentational TrendTable.
 */
export function TrendEntityTable({
  data,
  mode,
  getEntities,
  entityLabel,
  topN,
}: TrendEntityTableProps) {
  const { rows, monthLabels } = useMemo(() => {
    const labels = data.map((m) => m.label);
    const defaultDenom = RATIO_MODES.includes(mode) ? 0 : 1;

    const entityMap = new Map<
      string,
      { id: string; name: string; monthly: TrendTableCell[] }
    >();

    for (let i = 0; i < data.length; i++) {
      for (const e of getEntities(data[i])) {
        if (!entityMap.has(e.id)) {
          entityMap.set(e.id, {
            id: e.id,
            name: e.name,
            monthly: Array.from({ length: data.length }, () => ({
              numerator: 0,
              denominator: defaultDenom,
            })),
          });
        }
        entityMap.get(e.id)!.monthly[i] = pickCell(e, mode);
      }
    }

    const tableRows: TrendTableRow[] = Array.from(entityMap.values()).map(
      (e) => ({ id: e.id, name: e.name, monthlyCells: e.monthly }),
    );

    return { rows: tableRows, monthLabels: labels };
  }, [data, mode, getEntities]);

  return (
    <TrendTable
      rows={rows}
      monthLabels={monthLabels}
      mode={mode}
      entityLabel={entityLabel}
      topN={topN}
    />
  );
}
