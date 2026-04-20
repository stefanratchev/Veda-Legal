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
import { formatEur, formatEurPerHour } from "./chart-format";
import type { MonthlyTrendPoint } from "@/types/reports";

/** Chart-ready point: original MonthlyTrendPoint + derived display fields. */
export interface PricingHealthPoint extends MonthlyTrendPoint {
  lostRevenue: number;
  effectiveRate: number | null;
}

/**
 * Pure data transform — exported for testing.
 * lostRevenue: clamped at 0 to absorb sub-cent rounding artefacts.
 * effectiveRate: null when billedHours === 0 so Recharts draws a gap (per D-03).
 */
export function prepareChartData(data: MonthlyTrendPoint[]): PricingHealthPoint[] {
  return data.map((p) => ({
    ...p,
    lostRevenue: Math.max(0, p.standardRateValue - p.billedRevenue),
    effectiveRate: p.billedHours > 0 ? p.billedRevenue / p.billedHours : null,
  }));
}

interface PricingHealthTooltipProps {
  active?: boolean;
  payload?: { dataKey: string; value: number; payload: PricingHealthPoint }[];
}

function PricingHealthTooltip({ active, payload }: PricingHealthTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const rateLabel =
    point.effectiveRate != null ? `€${Math.round(point.effectiveRate)}/hr` : "—";

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
      <div style={{ color: "var(--text-primary)", marginBottom: 4, fontWeight: 500 }}>
        {point.label}
      </div>
      <div
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
            backgroundColor: "#F87171",
          }}
        />
        Lost Revenue: {formatEur(point.lostRevenue)}
      </div>
      <div
        style={{
          color: "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#5A8FC7",
          }}
        />
        Effective Rate: {rateLabel}
      </div>
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          marginTop: 6,
          paddingTop: 6,
          color: "var(--text-muted)",
          fontSize: "10px",
          lineHeight: 1.5,
        }}
      >
        <div>Billed: €{point.billedRevenue.toLocaleString()}</div>
        <div>Hours: {point.billedHours.toFixed(1)}h</div>
        <div>Standard: €{point.standardRateValue.toLocaleString()}</div>
      </div>
    </div>
  );
}

interface PricingHealthChartProps {
  data: MonthlyTrendPoint[];
}

export function PricingHealthChart({ data }: PricingHealthChartProps) {
  const chartData = prepareChartData(data);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart
        data={chartData}
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
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border-subtle)" }}
          tickLine={false}
          tickFormatter={formatEurPerHour}
        />
        <Tooltip
          content={<PricingHealthTooltip />}
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
          dataKey="lostRevenue"
          fill="#F87171"
          fillOpacity={0.4}
          radius={[4, 4, 0, 0]}
          name="Lost Revenue"
          isAnimationActive={false}
        />
        <Line
          yAxisId="right"
          dataKey="effectiveRate"
          type="monotone"
          stroke="#5A8FC7"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          name="Effective Rate"
          isAnimationActive={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
