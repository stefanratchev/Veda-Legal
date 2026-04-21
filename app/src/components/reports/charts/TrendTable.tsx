"use client";

import { useMemo } from "react";

export type TrendTableMode =
  | "billableHours"
  | "billedHours"
  | "unbillableHours"
  | "billableRevenue"
  | "billedRevenue"
  | "lostRevenue";

export interface TrendTableRow {
  id: string;
  name: string;
  monthlyValues: number[]; // one per month, matches monthLabels length
}

const EUR_MODES: readonly TrendTableMode[] = [
  "billableRevenue",
  "billedRevenue",
  "lostRevenue",
];
// Modes where high value = bad (red highlight).
const WARN_MODES: readonly TrendTableMode[] = ["unbillableHours", "lostRevenue"];

export const OTHERS_ROW_ID = "__others__";
const OTHERS_ROW_NAME = "Others";

function formatValue(value: number, mode: TrendTableMode): string {
  if (value <= 0) return "—";
  if (EUR_MODES.includes(mode)) {
    return value >= 1000
      ? `€${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`
      : `€${Math.round(value)}`;
  }
  return `${Math.round(value)}h`;
}

interface TrendTableProps {
  rows: TrendTableRow[];
  monthLabels: string[];
  mode: TrendTableMode;
  entityLabel: string; // "Employee" or "Client"
  topN?: number;
  emptyMessage?: string;
}

export function TrendTable({
  rows,
  monthLabels,
  mode,
  entityLabel,
  topN,
  emptyMessage,
}: TrendTableProps) {
  const { displayRows, topPerMonth, totals } = useMemo(() => {
    // Sort by most-recent-month value (descending), alphabetical tie-break.
    // Prioritizes "who's leading right now" over 12-month lifetime totals.
    const lastIdx = monthLabels.length - 1;
    const sorted = [...rows].sort((a, b) => {
      const aLast = a.monthlyValues[lastIdx] ?? 0;
      const bLast = b.monthlyValues[lastIdx] ?? 0;
      return bLast - aLast || a.name.localeCompare(b.name);
    });

    // Collapse tail rows into a single "Others" row when topN is set.
    let withOthers: TrendTableRow[] = sorted;
    if (typeof topN === "number" && sorted.length > topN) {
      const kept = sorted.slice(0, topN);
      const tail = sorted.slice(topN);
      const othersMonthly = monthLabels.map((_, i) =>
        tail.reduce((sum, row) => sum + (row.monthlyValues[i] ?? 0), 0),
      );
      withOthers = [
        ...kept,
        {
          id: OTHERS_ROW_ID,
          name: OTHERS_ROW_NAME,
          monthlyValues: othersMonthly,
        },
      ];
    }

    // Max per month. For WARN_MODES this gets a red tint; for others, green.
    // Others row is NEVER highlighted, even when its value is the max.
    const tops: (string | null)[] = monthLabels.map((_, monthIdx) => {
      let maxValue = 0;
      let topId: string | null = null;
      for (const row of withOthers) {
        if (row.id === OTHERS_ROW_ID) continue;
        const v = row.monthlyValues[monthIdx] ?? 0;
        if (v > maxValue) {
          maxValue = v;
          topId = row.id;
        }
      }
      return maxValue > 0 ? topId : null;
    });

    // Per-month sum across all rows (including Others when present — it
    // already represents the collapsed tail, so summing it into Total
    // reconciles with firm-level without double-counting).
    const totalsArr: number[] = monthLabels.map((_, monthIdx) =>
      withOthers.reduce(
        (sum, row) => sum + (row.monthlyValues[monthIdx] ?? 0),
        0,
      ),
    );

    return { displayRows: withOthers, topPerMonth: tops, totals: totalsArr };
  }, [rows, monthLabels, topN]);

  const highlightBg = WARN_MODES.includes(mode)
    ? "rgba(239, 68, 68, 0.30)" // red-500 @ 30%
    : "rgba(74, 157, 110, 0.35)"; // existing green

  if (rows.length === 0) {
    const msg = emptyMessage ?? `No ${entityLabel.toLowerCase()} data`;
    return (
      <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-[13px]">
        {msg}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            <th className="text-left py-2 pr-2 font-normal sticky left-0 bg-[var(--bg-elevated)] z-10">
              {entityLabel}
            </th>
            {monthLabels.map((label) => (
              <th
                key={label}
                className="text-right py-2 px-1.5 font-normal whitespace-nowrap"
              >
                {label.split(" ")[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row) => {
            const isOthers = row.id === OTHERS_ROW_ID;
            return (
              <tr
                key={row.id}
                className="border-t border-[var(--border-subtle)]"
              >
                <td className="py-2 pr-2 whitespace-nowrap sticky left-0 bg-[var(--bg-elevated)] z-10">
                  {isOthers ? (
                    <span className="italic text-[var(--text-muted)]">
                      {row.name}
                    </span>
                  ) : (
                    <span className="text-[var(--text-primary)]">{row.name}</span>
                  )}
                </td>
                {row.monthlyValues.map((value, i) => {
                  const isTop = !isOthers && topPerMonth[i] === row.id;
                  return (
                    <td
                      key={i}
                      className="text-right py-2 px-1.5 tabular-nums"
                      style={{
                        backgroundColor: isTop ? highlightBg : "transparent",
                        color: isOthers
                          ? "var(--text-muted)"
                          : value > 0
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                        fontStyle: isOthers ? "italic" : undefined,
                      }}
                    >
                      {formatValue(value, mode)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
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
