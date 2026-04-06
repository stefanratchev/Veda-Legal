"use client";

import { useMemo } from "react";
import type { MonthlyTrendPoint } from "@/types/reports";

interface EmployeeRow {
  id: string;
  name: string;
  monthlyValues: number[]; // one per month
}

export type EmployeeHoursMode = "billable" | "total";

interface EmployeeTrendTableProps {
  data: MonthlyTrendPoint[];
  mode: EmployeeHoursMode;
}

export function EmployeeTrendTable({ data, mode }: EmployeeTrendTableProps) {
  const { rows, monthLabels, topPerMonth } = useMemo(() => {
    const labels = data.map((m) => m.label);

    // Collect per-employee billable hours by month
    const employeeMap = new Map<string, {
      id: string;
      name: string;
      monthly: number[];
      total: number;
    }>();

    for (let i = 0; i < data.length; i++) {
      for (const emp of data[i].byEmployee) {
        if (!employeeMap.has(emp.id)) {
          employeeMap.set(emp.id, {
            id: emp.id,
            name: emp.name,
            monthly: new Array(data.length).fill(0),
            total: 0,
          });
        }
        const entry = employeeMap.get(emp.id)!;
        const hours = mode === "billable" ? emp.billableHours : emp.hours;
        entry.monthly[i] = hours;
        entry.total += hours;
      }
    }

    // Sort by total descending
    const sorted = Array.from(employeeMap.values())
      .sort((a, b) => b.total - a.total)
      .map((emp): EmployeeRow => ({
        id: emp.id,
        name: emp.name,
        monthlyValues: emp.monthly,
      }));

    // Find top performer per month
    const tops: (string | null)[] = labels.map((_, monthIdx) => {
      let maxHours = 0;
      let topId: string | null = null;
      for (const row of sorted) {
        if (row.monthlyValues[monthIdx] > maxHours) {
          maxHours = row.monthlyValues[monthIdx];
          topId = row.id;
        }
      }
      return maxHours > 0 ? topId : null;
    });

    return { rows: sorted, monthLabels: labels, topPerMonth: tops };
  }, [data, mode]);

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-[13px]">
        No employee data
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            <th className="text-left py-2 pr-2 font-normal sticky left-0 bg-[var(--bg-elevated)] z-10">
              Employee
            </th>
            {monthLabels.map((label) => (
              <th key={label} className="text-right py-2 px-1.5 font-normal whitespace-nowrap">
                {label.split(" ")[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-t border-[var(--border-subtle)]"
            >
              <td className="py-2 pr-2 whitespace-nowrap sticky left-0 bg-[var(--bg-elevated)] z-10">
                <span className="text-[var(--text-primary)]">{row.name}</span>
              </td>
              {row.monthlyValues.map((value, i) => {
                const isTop = topPerMonth[i] === row.id;
                return (
                  <td
                    key={i}
                    className="text-right py-2 px-1.5 tabular-nums"
                    style={{
                      backgroundColor: isTop ? "rgba(74, 157, 110, 0.35)" : "transparent",
                      color: value > 0 ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                  >
                    {value > 0 ? `${Math.round(value)}h` : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
