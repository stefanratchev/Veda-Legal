"use client";

import type { MonthlyTrendPoint } from "@/types/reports";
import { TrendEntityTable } from "./TrendEntityTable";
import type { TrendTableMode } from "./TrendTable";

interface ByClientTableProps {
  data: MonthlyTrendPoint[];
  mode: TrendTableMode;
}

/**
 * Renders per-client monthly trend values via the shared TrendEntityTable.
 * Caps display at the top 20 clients by most-recent-month value; any
 * remainder is rolled into a single muted "Others" row.
 */
export function ByClientTable({ data, mode }: ByClientTableProps) {
  return (
    <TrendEntityTable
      data={data}
      mode={mode}
      getEntities={(m) => m.byClient}
      entityLabel="Client"
      topN={20}
    />
  );
}
