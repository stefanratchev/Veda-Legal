"use client";

import { useMemo } from "react";
import type { MonthlyTrendPoint } from "@/types/reports";

interface EmployeeRow {
  id: string;
  name: string;
  monthlyValues: number[]; // one per month
}

export type EmployeeHoursMode =
  | "billableHours"
  | "billedHours"
  | "unbillableHours"
  | "billableRevenue"
  | "billedRevenue"
  | "lostRevenue";

const EUR_MODES: readonly EmployeeHoursMode[] = [
  "billableRevenue",
  "billedRevenue",
  "lostRevenue",
];
// Modes where high value = bad (red highlight).
const WARN_MODES: readonly EmployeeHoursMode[] = ["unbillableHours", "lostRevenue"];

function formatValue(value: number, mode: EmployeeHoursMode): string {
  if (value <= 0) return "—";
  if (EUR_MODES.includes(mode)) {
    return value >= 1000
      ? `€${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`
      : `€${Math.round(value)}`;
  }
  return `${Math.round(value)}h`;
}

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
  const { rows, monthLabels, topPerMonth, totals } = useMemo(() => {
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

    // Sort by most-recent-month value (descending), alphabetical tie-break.
    // Prioritizes "who's leading right now" over 12-month lifetime totals.
    const lastIdx = data.length - 1;
    const sorted = Array.from(employeeMap.values())
      .sort((a, b) => {
        const aLast = a.monthly[lastIdx] ?? 0;
        const bLast = b.monthly[lastIdx] ?? 0;
        return (bLast - aLast) || a.name.localeCompare(b.name);
      })
      .map((emp): EmployeeRow => ({
        id: emp.id,
        name: emp.name,
        monthlyValues: emp.monthly,
      }));

    // Max per month. For unbillable this gets a red tint; for others, green.
    const tops: (string | null)[] = labels.map((_, monthIdx) => {
      let maxValue = 0;
      let topId: string | null = null;
      for (const row of sorted) {
        if (row.monthlyValues[monthIdx] > maxValue) {
          maxValue = row.monthlyValues[monthIdx];
          topId = row.id;
        }
      }
      return maxValue > 0 ? topId : null;
    });

    // Per-month sum across all employees (the footer total row).
    const totals: number[] = labels.map((_, monthIdx) =>
      sorted.reduce((sum, row) => sum + (row.monthlyValues[monthIdx] ?? 0), 0),
    );

    return { rows: sorted, monthLabels: labels, topPerMonth: tops, totals };
  }, [data, mode]);

  const highlightBg = WARN_MODES.includes(mode)
    ? "rgba(239, 68, 68, 0.30)" // red-500 @ 30%
    : "rgba(74, 157, 110, 0.35)"; // existing green

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
                      backgroundColor: isTop ? highlightBg : "transparent",
                      color: value > 0 ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                  >
                    {formatValue(value, mode)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--border-subtle)]">
            <td className="py-2 pr-2 whitespace-nowrap sticky left-0 bg-[var(--bg-elevated)] z-10">
              <span className="text-[var(--text-primary)] font-medium">Total</span>
            </td>
            {totals.map((value, i) => (
              <td
                key={i}
                className="text-right py-2 px-1.5 tabular-nums font-medium"
                style={{
                  color: value > 0 ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {formatValue(value, mode)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
