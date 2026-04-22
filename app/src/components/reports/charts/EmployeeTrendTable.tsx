"use client";

import type { MonthlyTrendPoint } from "@/types/reports";
import { TrendEntityTable } from "./TrendEntityTable";
import type { TrendTableMode } from "./TrendTable";

// Kept as an alias so existing imports (e.g. OverviewTab) keep working.
export type EmployeeHoursMode = TrendTableMode;

interface EmployeeTrendTableProps {
  data: MonthlyTrendPoint[];
  mode: EmployeeHoursMode;
}

export function EmployeeTrendTable({ data, mode }: EmployeeTrendTableProps) {
  return (
    <TrendEntityTable
      data={data}
      mode={mode}
      getEntities={(m) => m.byEmployee}
      entityLabel="Employee"
    />
  );
}
