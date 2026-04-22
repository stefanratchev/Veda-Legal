"use client";

import { useMemo, useState } from "react";

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

export const OTHERS_ROW_ID = "__others__";
const OTHERS_ROW_NAME = "Others";

type MonthSort = { columnIdx: number; direction: "asc" | "desc" } | null;

/**
 * 3-state click cycle per column: desc → asc → reset-to-default (null).
 * Clicking a different column resets to fresh desc on that column.
 */
function nextSort(prev: MonthSort, clickedIdx: number): MonthSort {
  if (!prev || prev.columnIdx !== clickedIdx) {
    return { columnIdx: clickedIdx, direction: "desc" };
  }
  if (prev.direction === "desc") {
    return { columnIdx: clickedIdx, direction: "asc" };
  }
  return null;
}

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
  const [sort, setSort] = useState<MonthSort>(null);

  // Guard against `sort` being anchored to a column that has since scrolled
  // out of range (e.g. if monthLabels shrinks between renders). Without this,
  // `sortIdx` would read `monthlyCells[outOfRange]` → undefined → every row
  // appears null and the table silently collapses to an alpha tiebreak while
  // aria-sort still advertises a stale direction on a header that no longer
  // maps to the intended month.
  const effectiveSort: MonthSort =
    sort && sort.columnIdx < monthLabels.length ? sort : null;

  const { displayRows, totals } = useMemo(() => {
    // Active column: explicit sort column, or default to the last visible month.
    // Direction: user-selected, or default to desc.
    const lastIdx = monthLabels.length - 1;
    const sortIdx = effectiveSort?.columnIdx ?? lastIdx;
    const sortFactor = effectiveSort?.direction === "asc" ? -1 : 1;

    const sorted = [...rows].sort((a, b) => {
      const aCell = a.monthlyCells[sortIdx];
      const bCell = b.monthlyCells[sortIdx];
      const aVal = aCell ? cellValue(aCell, mode) : null;
      const bVal = bCell ? cellValue(bCell, mode) : null;
      // Null-at-bottom invariant: treat null AND value<=0 as "no data" (matches
      // `formatValue`'s "—" rule) and pin them at the bottom in BOTH directions.
      // Using `value ?? -Infinity` would float null to the TOP in asc mode —
      // that's the trap we are avoiding.
      const aIsNull = aVal === null || aVal <= 0;
      const bIsNull = bVal === null || bVal <= 0;
      if (aIsNull && bIsNull) return a.name.localeCompare(b.name);
      if (aIsNull) return 1;
      if (bIsNull) return -1;
      const cmp = (bVal! - aVal!) * sortFactor;
      return cmp || a.name.localeCompare(b.name);
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

    // Per-month totals across all visible rows (including Others when present).
    // For ratio modes this yields the correct weighted aggregate via
    // aggregateCells; for absolute modes it yields the raw sum.
    const totalsArr: TrendTableCell[] = monthLabels.map((_, monthIdx) => {
      const monthCells = withOthers
        .map((r) => r.monthlyCells[monthIdx])
        .filter((c): c is TrendTableCell => c !== undefined);
      return aggregateCells(monthCells, mode);
    });

    return { displayRows: withOthers, totals: totalsArr };
  }, [rows, monthLabels, mode, topN, effectiveSort]);

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
            <th
              scope="col"
              className="text-left py-2 pr-2 font-normal sticky left-0 bg-[var(--bg-elevated)] z-10"
            >
              {entityLabel}
            </th>
            {monthLabels.map((label, idx) => {
              const activeDirection =
                effectiveSort?.columnIdx === idx ? effectiveSort.direction : null;
              const ariaSort: "ascending" | "descending" | "none" =
                activeDirection === "asc"
                  ? "ascending"
                  : activeDirection === "desc"
                    ? "descending"
                    : "none";
              return (
                <th
                  key={label}
                  scope="col"
                  aria-sort={ariaSort}
                  className="text-right py-2 px-1.5 font-normal whitespace-nowrap"
                >
                  <button
                    type="button"
                    onClick={() => setSort((prev) => nextSort(prev, idx))}
                    className="inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                  >
                    <span>{label.split(" ")[0]}</span>
                    {activeDirection && (
                      <span
                        aria-hidden="true"
                        className="text-[var(--text-primary)]"
                      >
                        {activeDirection === "desc" ? "▼" : "▲"}
                      </span>
                    )}
                  </button>
                </th>
              );
            })}
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
                  return (
                    <td
                      key={i}
                      className="text-right py-2 px-1.5 tabular-nums"
                      style={{
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
