"use client";

import { useMemo } from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const BAR_COLORS = [
  "#FF9999", // coral pink (accent)
  "#4ECDC4", // teal (revenue accent)
  "#F5A623", // amber
  "#5A8FC7", // steel blue
  "#C084FC", // purple
  "#4A9D6E", // green
  "#F472B6", // pink
  "#FB923C", // orange
  "#38BDF8", // sky blue
  "#A3E635", // lime
];

interface BarChartItem {
  name: string;
  value: number;
  id?: string;
}

interface BarChartProps {
  data: BarChartItem[];
  onBarClick?: (id: string) => void;
  valueFormatter?: (value: number) => string;
  layout?: "horizontal" | "vertical";
  valueLabel?: string;
  maxBars?: number;
}

export function prepareBarData(
  data: BarChartItem[],
  maxBars: number
): BarChartItem[] {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, maxBars);
  const rest = sorted.slice(maxBars);

  if (rest.length > 0) {
    const otherTotal = rest.reduce((sum, item) => sum + item.value, 0);
    top.push({ name: "Other", value: otherTotal });
  }

  return top;
}

export function BarChart({
  data,
  onBarClick,
  valueFormatter = (v) => v.toFixed(1),
  layout = "horizontal",
  valueLabel = "Hours",
  maxBars,
}: BarChartProps) {
  const chartData = useMemo(
    () => (maxBars != null ? prepareBarData(data, maxBars) : data),
    [data, maxBars]
  );

  const handleClick = (entry: { id?: string }) => {
    if (onBarClick && entry.id) {
      onBarClick(entry.id);
    }
  };

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart
        data={chartData}
        layout={layout}
        margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
      >
        {layout === "horizontal" ? (
          <>
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border-subtle)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border-subtle)" }}
              tickLine={false}
              tickFormatter={valueFormatter}
            />
          </>
        ) : (
          <>
            <XAxis
              type="number"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border-subtle)" }}
              tickLine={false}
              tickFormatter={valueFormatter}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border-subtle)" }}
              tickLine={false}
              width={100}
              interval={0}
            />
          </>
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "4px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "var(--text-primary)" }}
          itemStyle={{ color: "var(--text-secondary)" }}
          formatter={(value) => [valueFormatter(value as number), valueLabel]}
          cursor={{ fill: "var(--bg-surface)", fillOpacity: 0.5 }}
        />
        <Bar
          dataKey="value"
          radius={[4, 4, 4, 4]}
          cursor={onBarClick ? "pointer" : "default"}
          onClick={(_, index) => handleClick(chartData[index])}
        >
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={BAR_COLORS[index % BAR_COLORS.length]}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
