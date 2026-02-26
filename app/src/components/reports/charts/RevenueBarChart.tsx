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
  LabelList,
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
  "#E879F9", // fuchsia
  "#34D399", // emerald
  "#FBBF24", // yellow
  "#818CF8", // indigo
  "#F87171", // red
  "#2DD4BF", // teal-light
  "#A78BFA", // violet
  "#FCA5A1", // rose
  "#67E8F9", // cyan
  "#BEF264", // lime-light
];

const MAX_LABEL_CHARS = 14;

function TruncatedYAxisTick(props: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  const { x, y, payload } = props;
  const name = payload?.value ?? "";
  const display =
    name.length > MAX_LABEL_CHARS
      ? name.slice(0, MAX_LABEL_CHARS - 1) + "\u2026"
      : name;

  return (
    <text
      x={x}
      y={y}
      textAnchor="end"
      dominantBaseline="central"
      fill="var(--text-muted)"
      fontSize={11}
    >
      {display}
    </text>
  );
}

// --- Types ---

interface RevenueItem {
  name: string;
  value: number;
  id?: string;
}

interface RevenueItemWithChange extends RevenueItem {
  percentChange: number | null;
}

interface RevenueBarChartProps {
  data: RevenueItem[];
  comparisonData?: RevenueItem[];
  onBarClick?: (id: string) => void;
  activeIds?: Set<string>;
  maxBars?: number;
}

export function getBarOpacity(activeIds: Set<string> | undefined, itemId: string | undefined): number {
  if (!activeIds || activeIds.size === 0) return 0.8;
  if (itemId != null && activeIds.has(itemId)) return 0.8;
  return 0.25;
}

// --- EUR Formatters (exported for testing) ---

export function formatEurAbbreviated(value: number): string {
  if (value >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(1);
    return `\u20AC${formatted.replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    const formatted = (value / 1_000).toFixed(1);
    return `\u20AC${formatted.replace(/\.0$/, "")}K`;
  }
  return `\u20AC${Math.round(value)}`;
}

const eurExactFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatEurExact(value: number): string {
  return eurExactFormatter.format(value);
}

// --- Data Transformation (exported for testing) ---

export function prepareRevenueData(
  data: RevenueItem[],
  maxBars: number = 20
): RevenueItem[] {
  const filtered = data.filter((item) => item.value > 0);
  const sorted = [...filtered].sort((a, b) => b.value - a.value);

  const top = sorted.slice(0, maxBars);
  const rest = sorted.slice(maxBars);

  if (rest.length > 0) {
    const otherTotal = rest.reduce((sum, item) => sum + item.value, 0);
    top.push({ name: "Other", value: otherTotal });
  }

  return top;
}

export function mergeComparisonData(
  currentData: RevenueItem[],
  comparisonData?: RevenueItem[]
): RevenueItemWithChange[] {
  if (!comparisonData || comparisonData.length === 0) {
    return currentData.map((item) => ({ ...item, percentChange: null }));
  }

  const comparisonMap = new Map<string, number>();
  for (const item of comparisonData) {
    if (item.id) {
      comparisonMap.set(item.id, item.value);
    }
  }

  return currentData.map((item) => {
    // "Other" has no id -- no comparison badge
    if (!item.id) {
      return { ...item, percentChange: null };
    }

    const previousValue = comparisonMap.get(item.id);

    // No match or zero previous value -- no comparison badge
    if (previousValue === undefined || previousValue === 0) {
      return { ...item, percentChange: null };
    }

    const percentChange = ((item.value - previousValue) / previousValue) * 100;
    return { ...item, percentChange };
  });
}

// --- Custom Tooltip ---

interface TooltipPayloadItem {
  value: number;
  payload: RevenueItemWithChange;
}

interface RevenueTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function RevenueTooltip({ active, payload }: RevenueTooltipProps) {
  if (!active || !payload?.length) return null;

  const { value, payload: item } = payload[0];
  const changeStr =
    item.percentChange != null
      ? ` (${item.percentChange > 0 ? "+" : ""}${Math.round(item.percentChange)}%)`
      : "";

  return (
    <div
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "4px",
        padding: "8px 12px",
        fontSize: "12px",
      }}
    >
      <div style={{ color: "var(--text-primary)", marginBottom: 2 }}>
        {item.name}
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        {formatEurExact(value)}
        {changeStr}
      </div>
    </div>
  );
}

// --- Custom LabelList Renderer ---

interface PercentChangeLabelProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number | null;
}

function PercentChangeLabel({ x, y, width, height, value }: PercentChangeLabelProps) {
  if (value == null) return null;

  const isPositive = value > 0;
  const color = isPositive ? "var(--success)" : "var(--danger)";
  const text = `${isPositive ? "+" : ""}${Math.round(value)}%`;

  // Position at the end of horizontal bar, vertically centered
  return (
    <text
      x={(x ?? 0) + (width ?? 0) + 4}
      y={(y ?? 0) + (height ?? 0) / 2}
      fill={color}
      textAnchor="start"
      dominantBaseline="central"
      fontSize={10}
      fontWeight={500}
    >
      {text}
    </text>
  );
}

// --- Main Component ---

export function RevenueBarChart({
  data,
  comparisonData,
  onBarClick,
  activeIds,
  maxBars = 20,
}: RevenueBarChartProps) {
  const preparedData = useMemo(
    () => prepareRevenueData(data, maxBars),
    [data, maxBars]
  );

  const chartData = useMemo(
    () => mergeComparisonData(preparedData, comparisonData),
    [preparedData, comparisonData]
  );

  const handleClick = (entry: RevenueItemWithChange) => {
    if (onBarClick && entry.id) {
      onBarClick(entry.id);
    }
  };

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        No revenue data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 10, right: 50, left: 10, bottom: 10 }}
      >
        <XAxis
          type="number"
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--border-subtle)" }}
          tickLine={false}
          tickFormatter={formatEurAbbreviated}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={<TruncatedYAxisTick />}
          axisLine={{ stroke: "var(--border-subtle)" }}
          tickLine={false}
          width={100}
          interval={0}
        />
        <Tooltip
          content={<RevenueTooltip />}
          cursor={{ fill: "var(--bg-surface)", fillOpacity: 0.5 }}
        />
        <Bar
          dataKey="value"
          radius={[4, 4, 4, 4]}
          cursor={onBarClick ? "pointer" : "default"}
          onClick={(_, index) => handleClick(chartData[index])}
        >
          {chartData.map((item, index) => (
            <Cell
              key={`cell-${index}`}
              fill={BAR_COLORS[index % BAR_COLORS.length]}
              fillOpacity={getBarOpacity(activeIds, item.id)}
            />
          ))}
          <LabelList
            dataKey="percentChange"
            position="right"
            content={<PercentChangeLabel />}
          />
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
