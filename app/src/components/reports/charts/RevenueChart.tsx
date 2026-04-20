"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatEur } from "./chart-format";
import type { MonthlyTrendPoint } from "@/types/reports";

interface RevenueTooltipProps {
  active?: boolean;
  payload?: {
    dataKey: string;
    value: number;
    payload: MonthlyTrendPoint;
  }[];
}

function RevenueTooltip({ active, payload }: RevenueTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

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
        {point.label}
      </div>
      <div style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#4ECDC4",
          }}
        />
        Billed: €{point.billedRevenue.toLocaleString()}
      </div>
      <div style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#F5A623",
          }}
        />
        Realization: {point.realization}%
      </div>
    </div>
  );
}

interface RevenueChartProps {
  data: MonthlyTrendPoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={data}
        margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
      >
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border-subtle)" }}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border-subtle)" }}
          tickLine={false}
          tickFormatter={formatEur}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border-subtle)" }}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          content={<RevenueTooltip />}
          cursor={{ fill: "var(--bg-surface)", fillOpacity: 0.5 }}
        />
        <Legend
          formatter={(value: string) => (
            <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
              {value}
            </span>
          )}
        />
        <Bar
          yAxisId="left"
          dataKey="billedRevenue"
          fill="#4ECDC4"
          fillOpacity={0.4}
          radius={[4, 4, 0, 0]}
          name="Billed Revenue"
          isAnimationActive={false}
        />
        <Line
          yAxisId="right"
          dataKey="realization"
          type="monotone"
          stroke="#F5A623"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          name="Realization"
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
