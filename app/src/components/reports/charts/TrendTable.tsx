"use client";

import { useMemo } from "react";

export type TrendTableMode =
  | "billableHours"
  | "billedHours"
  | "unbillableHours"
  | "billableRevenue"
  | "billedRevenue"
  | "lostRevenue"
  | "realization"
  | "utilization"
  | "effectiveRate";

export interface TrendTableCell {
  numerator: number;
  denominator: number; // use 1 for absolute modes
}

export interface TrendTableRow {
  id: string;
  name: string;
  monthlyCells: TrendTableCell[]; // one per month, matches monthLabels length
}

const EUR_MODES: readonly TrendTableMode[] = [
  "billableRevenue",
  "billedRevenue",
  "lostRevenue",
];
const PERCENT_MODES: readonly TrendTableMode[] = ["realization", "utilization"];
const EUR_PER_HOUR_MODES: readonly TrendTableMode[] = ["effectiveRate"];
const RATIO_MODES: readonly TrendTableMode[] = [
  ...PERCENT_MODES,
  ...EUR_PER_HOUR_MODES,
];
// Modes where high value = bad (red highlight). Ratio modes are all
// higher-is-better and stay out of this list.
const WARN_MODES: readonly TrendTableMode[] = ["unbillableHours", "lostRevenue"];

export const OTHERS_ROW_ID = "__others__";
const OTHERS_ROW_NAME = "Others";

/**
 * Resolves a cell's display value independent of mode-specific formatting.
 * Returns `null` to signal "no data" (→ "—") for ratio cells with denom=0.
 * For absolute modes, denominator is 1, so value = numerator.
 */
function cellValue(
  cell: TrendTableCell,
  mode: TrendTableMode,
): number | null {
  if (RATIO_MODES.includes(mode)) {
    return cell.denominator > 0 ? cell.numerator / cell.denominator : null;
  }
  // Absolute modes: denominator is always 1 (defensive: treat <=0 as null).
  if (cell.denominator <= 0) return null;
  return cell.numerator / cell.denominator;
}

function formatValue(value: number | null, mode: TrendTableMode): string {
  if (value === null) return "—";
  // For absolute modes, <=0 keeps prior "—" semantics (entity with no activity).
  // For ratio modes, 0 means numerator was 0 (e.g., zero billed revenue despite
  // nonzero denominator) — treat as "—" ("no activity" intuition).
  if (value <= 0) return "—";
  if (PERCENT_MODES.includes(mode)) {
    return `${Math.round(value * 100)}%`;
  }
  if (EUR_PER_HOUR_MODES.includes(mode)) {
    return `€${Math.round(value)}`;
  }
  if (EUR_MODES.includes(mode)) {
    return value >= 1000
      ? `€${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`
      : `€${Math.round(value)}`;
  }
  return `${Math.round(value)}h`;
}

/**
 * Aggregate cells for Total/Others rows. Ratio modes sum both numerator and
 * denominator (weighted average). Absolute modes sum numerators and keep
 * denominator at 1 so cellValue returns the raw sum.
 */
function aggregateCells(
  cells: TrendTableCell[],
  mode: TrendTableMode,
): TrendTableCell {
  if (RATIO_MODES.includes(mode)) {
    let num = 0;
    let denom = 0;
    for (const c of cells) {
      num += c.numerator;
      denom += c.denominator;
    }
    return { numerator: num, denominator: denom };
  }
  let num = 0;
  for (const c of cells) num += c.numerator;
  return { numerator: num, denominator: 1 };
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
    // `null` (zero-denom for ratio modes) sorts to the bottom.
    const lastIdx = monthLabels.length - 1;
    const sorted = [...rows].sort((a, b) => {
      const aCell = a.monthlyCells[lastIdx];
      const bCell = b.monthlyCells[lastIdx];
      const aVal = aCell ? cellValue(aCell, mode) : null;
      const bVal = bCell ? cellValue(bCell, mode) : null;
      const aSort = aVal ?? -Infinity;
      const bSort = bVal ?? -Infinity;
      return bSort - aSort || a.name.localeCompare(b.name);
    });

    // Collapse tail rows into a single "Others" row when topN is set.
    let withOthers: TrendTableRow[] = sorted;
    if (typeof topN === "number" && sorted.length > topN) {
      const kept = sorted.slice(0, topN);
      const tail = sorted.slice(topN);
      const othersCells: TrendTableCell[] = monthLabels.map((_, i) => {
        const monthCells = tail
          .map((r) => r.monthlyCells[i])
          .filter((c): c is TrendTableCell => c !== undefined);
        return aggregateCells(monthCells, mode);
      });
      withOthers = [
        ...kept,
        {
          id: OTHERS_ROW_ID,
          name: OTHERS_ROW_NAME,
          monthlyCells: othersCells,
        },
      ];
    }

    // Max per month. WARN_MODES → red tint; others → green.
    // Others row is NEVER highlighted, even when its value is the max.
    // Ratio cells with null value (denom=0) are not eligible for highlight.
    const tops: (string | null)[] = monthLabels.map((_, monthIdx) => {
      let maxValue = -Infinity;
      let topId: string | null = null;
      for (const row of withOthers) {
        if (row.id === OTHERS_ROW_ID) continue;
        const cell = row.monthlyCells[monthIdx];
        if (!cell) continue;
        const v = cellValue(cell, mode);
        if (v === null || v <= 0) continue;
        if (v > maxValue) {
          maxValue = v;
          topId = row.id;
        }
      }
      return topId;
    });

    // Per-month totals across all visible rows (including Others when present).
    // For ratio modes this yields the correct weighted aggregate via
    // aggregateCells; for absolute modes it yields the raw sum.
    const totalsArr: TrendTableCell[] = monthLabels.map((_, monthIdx) => {
      const monthCells = withOthers
        .map((r) => r.monthlyCells[monthIdx])
        .filter((c): c is TrendTableCell => c !== undefined);
      return aggregateCells(monthCells, mode);
    });

    return { displayRows: withOthers, topPerMonth: tops, totals: totalsArr };
  }, [rows, monthLabels, mode, topN]);

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
                {row.monthlyCells.map((cell, i) => {
                  const value = cellValue(cell, mode);
                  const hasValue = value !== null && value > 0;
                  const isTop = !isOthers && topPerMonth[i] === row.id;
                  return (
                    <td
                      key={i}
                      className="text-right py-2 px-1.5 tabular-nums"
                      style={{
                        backgroundColor: isTop ? highlightBg : "transparent",
                        color: isOthers
                          ? "var(--text-muted)"
                          : hasValue
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
            {totals.map((cell, i) => {
              const value = cellValue(cell, mode);
              const hasValue = value !== null && value > 0;
              return (
                <td
                  key={i}
                  className="text-right py-2 px-1.5 tabular-nums font-medium"
                  style={{
                    color: hasValue
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                  }}
                >
                  {formatValue(value, mode)}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
