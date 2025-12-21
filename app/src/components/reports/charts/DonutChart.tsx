"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface DonutChartProps {
  data: { name: string; value: number; id?: string }[];
  onSliceClick?: (id: string) => void;
  valueFormatter?: (value: number) => string;
  maxSlices?: number;
  valueLabel?: string;
}

const COLORS = [
  "var(--accent-pink)",
  "#7B68C9",
  "#68A9C9",
  "#68C99B",
  "#C9B868",
  "#C97868",
];

export function DonutChart({
  data,
  onSliceClick,
  valueFormatter = (v) => v.toFixed(1),
  maxSlices = 5,
  valueLabel = "Hours",
}: DonutChartProps) {
  // Group smaller slices into "Other"
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  let chartData: { name: string; value: number; id?: string }[];

  if (sortedData.length > maxSlices) {
    const topSlices = sortedData.slice(0, maxSlices);
    const otherValue = sortedData.slice(maxSlices).reduce((sum, d) => sum + d.value, 0);
    chartData = [...topSlices, { name: "Other", value: otherValue }];
  } else {
    chartData = sortedData;
  }

  const handleClick = (entry: { id?: string }) => {
    if (onSliceClick && entry.id) {
      onSliceClick(entry.id);
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius="50%"
          outerRadius="80%"
          paddingAngle={2}
          dataKey="value"
          cursor={onSliceClick ? "pointer" : "default"}
          onClick={(_, index) => handleClick(chartData[index])}
        >
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              fillOpacity={0.8}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "4px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "var(--text-primary)" }}
          formatter={(value) => [valueFormatter(value as number), valueLabel]}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
