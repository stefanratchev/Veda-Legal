"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BarChartProps {
  data: { name: string; value: number; id?: string }[];
  onBarClick?: (id: string) => void;
  valueFormatter?: (value: number) => string;
  layout?: "horizontal" | "vertical";
  valueLabel?: string;
}

export function BarChart({
  data,
  onBarClick,
  valueFormatter = (v) => v.toFixed(1),
  layout = "horizontal",
  valueLabel = "Hours",
}: BarChartProps) {
  const handleClick = (entry: { id?: string }) => {
    if (onBarClick && entry.id) {
      onBarClick(entry.id);
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
      <RechartsBarChart
        data={data}
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
          onClick={(_, index) => handleClick(data[index])}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill="var(--accent-pink)"
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
