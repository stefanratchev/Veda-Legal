"use client";

import { useMemo } from "react";
import type { MonthlyTrendPoint } from "@/types/reports";
import {
  TrendTable,
  type TrendTableMode,
  type TrendTableRow,
} from "./TrendTable";

// Kept as an alias so existing imports (e.g. OverviewTab) keep working.
export type EmployeeHoursMode = TrendTableMode;

function pickValue(
  emp: MonthlyTrendPoint["byEmployee"][number],
  mode: EmployeeHoursMode,
): number {
  switch (mode) {
    case "billableHours":
      return emp.billableHours;
    case "billedHours":
      return emp.billedHours;
    case "unbillableHours":
      return Math.max(0, emp.hours - emp.billableHours);
    case "billableRevenue":
      return emp.billableRevenue;
    case "billedRevenue":
      return emp.billedRevenue;
    case "lostRevenue":
      return Math.max(0, emp.standardRateValue - emp.billedRevenue);
  }
}

interface EmployeeTrendTableProps {
  data: MonthlyTrendPoint[];
  mode: EmployeeHoursMode;
}

export function EmployeeTrendTable({ data, mode }: EmployeeTrendTableProps) {
  const { rows, monthLabels } = useMemo(() => {
    const labels = data.map((m) => m.label);

    const employeeMap = new Map<string, {
      id: string;
      name: string;
      monthly: number[];
    }>();

    for (let i = 0; i < data.length; i++) {
      for (const emp of data[i].byEmployee) {
        if (!employeeMap.has(emp.id)) {
          employeeMap.set(emp.id, {
            id: emp.id,
            name: emp.name,
            monthly: new Array(data.length).fill(0),
          });
        }
        const entry = employeeMap.get(emp.id)!;
        entry.monthly[i] = pickValue(emp, mode);
      }
    }

    const tableRows: TrendTableRow[] = Array.from(employeeMap.values()).map(
      (emp) => ({
        id: emp.id,
        name: emp.name,
        monthlyValues: emp.monthly,
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
