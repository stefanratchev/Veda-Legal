"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatHours } from "@/lib/date-utils";
import { BAR_COLORS } from "./chart-colors";
import type { MonthlyTrendPoint } from "@/types/reports";

interface EmployeeTooltipPayload {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

interface EmployeeTooltipProps {
  active?: boolean;
  payload?: EmployeeTooltipPayload[];
  label?: string;
}

function EmployeeTooltip({ active, payload, label }: EmployeeTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "4px",
        padding: "8px 12px",
        fontSize: "11px",
      }}
    >
      <div
        style={{
          color: "var(--text-primary)",
          marginBottom: 4,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      {payload
        .filter((entry) => entry.value > 0)
        .map((entry) => (
          <div
            key={entry.dataKey}
            style={{
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 2,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: entry.color,
              }}
            />
            {entry.name}: {formatHours(entry.value)}
          </div>
        ))}
    </div>
  );
}

interface EmployeeTrendChartProps {
  data: MonthlyTrendPoint[];
}

export function EmployeeTrendChart({ data }: EmployeeTrendChartProps) {
  const { chartData, employeeNames } = useMemo(() => {
    // Collect all unique employee names across all months, sorted alphabetically
    const nameSet = new Set<string>();
    for (const point of data) {
      for (const emp of point.byEmployee) {
        nameSet.add(emp.name);
      }
    }
    const names = Array.from(nameSet).sort();

    // Transform each month into a flat object for Recharts
    const transformed = data.map((point) => {
      const row: Record<string, string | number> = { month: point.label };
      for (const emp of point.byEmployee) {
        if (emp.hours > 0) {
          row[emp.name] = emp.hours;
        }
      }
      return row;
    });

    return { chartData: transformed, employeeNames: names };
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
        barGap={1}
        barCategoryGap="20%"
      >
        <XAxis
          dataKey="month"
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border-subtle)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border-subtle)" }}
          tickLine={false}
          tickFormatter={formatHours}
        />
        <Tooltip
          content={<EmployeeTooltip />}
          cursor={{ fill: "var(--bg-surface)", fillOpacity: 0.5 }}
        />
        <Legend
          layout="horizontal"
          align="center"
          verticalAlign="bottom"
          wrapperStyle={{ paddingTop: 10, fontSize: 11, color: "var(--text-secondary)" }}
        />
        {employeeNames.map((name, idx) => (
          <Bar
            key={name}
            dataKey={name}
            fill={BAR_COLORS[idx % BAR_COLORS.length]}
            fillOpacity={0.8}
            name={name}
            barSize={Math.max(4, Math.floor(60 / employeeNames.length))}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
