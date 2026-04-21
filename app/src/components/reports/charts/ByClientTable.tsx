"use client";

import { useMemo } from "react";
import type { MonthlyTrendPoint } from "@/types/reports";
import {
  TrendTable,
  type TrendTableMode,
  type TrendTableRow,
} from "./TrendTable";

function pickValue(
  c: MonthlyTrendPoint["byClient"][number],
  mode: TrendTableMode,
): number {
  switch (mode) {
    case "billableHours":
      return c.billableHours;
    case "billedHours":
      return c.billedHours;
    case "unbillableHours":
      return Math.max(0, c.hours - c.billableHours);
    case "billableRevenue":
      return c.billableRevenue;
    case "billedRevenue":
      return c.billedRevenue;
    case "lostRevenue":
      return Math.max(0, c.standardRateValue - c.billedRevenue);
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

    const clientMap = new Map<string, {
      id: string;
      name: string;
      monthly: number[];
    }>();

    for (let i = 0; i < data.length; i++) {
      for (const c of data[i].byClient) {
        if (!clientMap.has(c.id)) {
          clientMap.set(c.id, {
            id: c.id,
            name: c.name,
            monthly: new Array(data.length).fill(0),
          });
        }
        const entry = clientMap.get(c.id)!;
        entry.monthly[i] = pickValue(c, mode);
      }
    }

    const tableRows: TrendTableRow[] = Array.from(clientMap.values()).map(
      (c) => ({
        id: c.id,
        name: c.name,
        monthlyValues: c.monthly,
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
