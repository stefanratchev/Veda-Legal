"use client";

import { useMemo } from "react";
import type { MonthlyTrendPoint } from "@/types/reports";
import {
  TrendTable,
  type TrendTableCell,
  type TrendTableMode,
  type TrendTableRow,
} from "./TrendTable";

// Kept as an alias so existing imports (e.g. OverviewTab) keep working.
export type EmployeeHoursMode = TrendTableMode;

// Ratio modes live here too (local constant, not imported from TrendTable
// which keeps its own internal copy) — lets us decide default cell shape for
// absent entries: denom=1 for absolute modes (0/1 → "—"), denom=0 for ratio
// modes (0/0 → "—") so display is consistent in both cases.
const RATIO_MODES_IN_WRAPPER: readonly TrendTableMode[] = [
  "realization",
  "utilization",
  "effectiveRate",
];

function pickCell(
  emp: MonthlyTrendPoint["byEmployee"][number],
  mode: EmployeeHoursMode,
): TrendTableCell {
  switch (mode) {
    case "billableHours":
      return { numerator: emp.billableHours, denominator: 1 };
    case "billedHours":
      return { numerator: emp.billedHours, denominator: 1 };
    case "unbillableHours":
      return {
        numerator: Math.max(0, emp.hours - emp.billableHours),
        denominator: 1,
      };
    case "billableRevenue":
      return { numerator: emp.billableRevenue, denominator: 1 };
    case "billedRevenue":
      return { numerator: emp.billedRevenue, denominator: 1 };
    case "lostRevenue":
      return {
        numerator: Math.max(0, emp.standardRateValue - emp.billedRevenue),
        denominator: 1,
      };
    case "realization":
      return {
        numerator: emp.billedRevenue,
        denominator: emp.standardRateValue,
      };
    case "utilization":
      return { numerator: emp.billableHours, denominator: emp.hours };
    case "effectiveRate":
      return { numerator: emp.billedRevenue, denominator: emp.billedHours };
  }
}

interface EmployeeTrendTableProps {
  data: MonthlyTrendPoint[];
  mode: EmployeeHoursMode;
}

export function EmployeeTrendTable({ data, mode }: EmployeeTrendTableProps) {
  const { rows, monthLabels } = useMemo(() => {
    const labels = data.map((m) => m.label);
    const defaultDenom = RATIO_MODES_IN_WRAPPER.includes(mode) ? 0 : 1;

    const employeeMap = new Map<
      string,
      { id: string; name: string; monthly: TrendTableCell[] }
    >();

    for (let i = 0; i < data.length; i++) {
      for (const emp of data[i].byEmployee) {
        if (!employeeMap.has(emp.id)) {
          employeeMap.set(emp.id, {
            id: emp.id,
            name: emp.name,
            monthly: Array.from({ length: data.length }, () => ({
              numerator: 0,
              denominator: defaultDenom,
            })),
          });
        }
        const entry = employeeMap.get(emp.id)!;
        entry.monthly[i] = pickCell(emp, mode);
      }
    }

    const tableRows: TrendTableRow[] = Array.from(employeeMap.values()).map(
      (emp) => ({
        id: emp.id,
        name: emp.name,
        monthlyCells: emp.monthly,
      }),
    );

    return { rows: tableRows, monthLabels: labels };
  }, [data, mode]);

  return (
    <TrendTable
      rows={rows}
      monthLabels={monthLabels}
      mode={mode}
      entityLabel="Employee"
    />
  );
}
