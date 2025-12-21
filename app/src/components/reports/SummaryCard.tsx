"use client";

interface SummaryCardProps {
  label: string;
  value: string;
  comparison?: {
    value: number;
    label: string;
    type: "percentage" | "absolute";
  } | null;
}

export function SummaryCard({ label, value, comparison }: SummaryCardProps) {
  const getComparisonDisplay = () => {
    if (!comparison) return null;

    const { value: compValue, label: compLabel, type } = comparison;

    if (compValue === 0) {
      return (
        <span className="text-[var(--text-muted)]">
          — vs {compLabel}
        </span>
      );
    }

    const isPositive = compValue > 0;
    const color = isPositive ? "text-green-400" : "text-red-400";
    const arrow = isPositive ? "↑" : "↓";
    const displayValue = type === "percentage"
      ? `${Math.abs(compValue).toFixed(0)}%`
      : `${Math.abs(compValue).toFixed(0)}`;

    return (
      <span className={color}>
        {arrow} {displayValue} vs {compLabel}
      </span>
    );
  };

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
        {label}
      </div>
      <div className="text-2xl font-semibold text-[var(--text-primary)] mb-1">
        {value}
      </div>
      {comparison !== undefined && (
        <div className="text-[11px]">
          {getComparisonDisplay()}
        </div>
      )}
    </div>
  );
}
