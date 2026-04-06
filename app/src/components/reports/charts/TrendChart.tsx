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
import { formatHours } from "@/lib/date-utils";
import type { MonthlyTrendPoint } from "@/types/reports";

interface TrendTooltipProps {
  active?: boolean;
  payload?: {
    dataKey: string;
    value: number;
    payload: MonthlyTrendPoint;
  }[];
  label?: string;
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
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
            backgroundColor: "#FF9999",
          }}
        />
        Billable: {formatHours(point.billableHours)}
      </div>
      <div style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#4A9D6E",
          }}
        />
        Utilization: {point.utilization}%
      </div>
    </div>
  );
}

interface TrendChartProps {
  data: MonthlyTrendPoint[];
}

export function TrendChart({ data }: TrendChartProps) {
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
          tickFormatter={formatHours}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border-subtle)" }}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          content={<TrendTooltip />}
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
          dataKey="billableHours"
          fill="#FF9999"
          fillOpacity={0.4}
          radius={[4, 4, 0, 0]}
          name="Billable Hours"
          isAnimationActive={false}
        />
        <Line
          yAxisId="right"
          dataKey="utilization"
          type="monotone"
          stroke="#4A9D6E"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          name="Utilization"
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
