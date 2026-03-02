"use client";

import { useState, useRef, useCallback } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

export type DateRangePreset = "this-month" | "last-month" | "all-time" | "custom";

export interface DateRange {
  preset: DateRangePreset;
  from: string | null; // "YYYY-MM-DD" or null for all-time
  to: string | null; // "YYYY-MM-DD" or null for all-time
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

/**
 * Compute the from/to dates for a given preset.
 * "this-month" → first/last day of current month
 * "last-month" → first/last day of previous month
 * "all-time" → null/null (no constraint)
 */
export function getDateRange(
  preset: Exclude<DateRangePreset, "custom">
): { from: string; to: string } | { from: null; to: null } {
  if (preset === "all-time") {
    return { from: null, to: null };
  }

  const now = new Date();
  let year: number;
  let month: number;

  if (preset === "this-month") {
    year = now.getFullYear();
    month = now.getMonth(); // 0-indexed
  } else {
    // last-month
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    year = d.getFullYear();
    month = d.getMonth();
  }

  const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDayNum = new Date(year, month + 1, 0).getDate();
  const lastDay = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;

  return { from: firstDay, to: lastDay };
}

const presets: { id: Exclude<DateRangePreset, "custom">; label: string }[] = [
  { id: "this-month", label: "This Month" },
  { id: "last-month", label: "Last Month" },
  { id: "all-time", label: "All Time" },
];

function formatTriggerLabel(value: DateRange): string {
  if (value.preset === "this-month") return "This Month";
  if (value.preset === "last-month") return "Last Month";
  if (value.preset === "all-time") return "All Time";

  // Custom range
  if (!value.from || !value.to) return "Custom Range";

  const currentYear = new Date().getFullYear();
  const fromDate = new Date(value.from + "T00:00:00");
  const toDate = new Date(value.to + "T00:00:00");

  const formatDate = (d: Date) => {
    const day = d.getDate();
    const month = d.toLocaleDateString("en-GB", { month: "short" });
    const year = d.getFullYear();
    return year !== currentYear ? `${day} ${month} ${year}` : `${day} ${month}`;
  };

  return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  const handlePresetClick = useCallback(
    (presetId: Exclude<DateRangePreset, "custom">) => {
      const range = getDateRange(presetId);
      onChange({ preset: presetId, from: range.from, to: range.to });
      setIsOpen(false);
    },
    [onChange]
  );

  const handleCustomClick = useCallback(() => {
    // If not already custom, initialize with current value's dates or this month
    if (value.preset !== "custom") {
      const thisMonth = getDateRange("this-month");
      onChange({
        preset: "custom",
        from: value.from ?? (thisMonth.from as string),
        to: value.to ?? (thisMonth.to as string),
      });
    }
  }, [value, onChange]);

  const handleCustomDateChange = useCallback(
    (field: "from" | "to", dateValue: string) => {
      onChange({
        preset: "custom",
        from: field === "from" ? dateValue : value.from,
        to: field === "to" ? dateValue : value.to,
      });
    },
    [value, onChange]
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 px-3 py-2 rounded text-[13px]
          bg-[var(--bg-surface)] border border-[var(--border-subtle)]
          text-[var(--text-primary)]
          hover:border-[var(--border-accent)] transition-all duration-200
          cursor-pointer whitespace-nowrap
        "
      >
        <svg
          className="w-4 h-4 text-[var(--text-muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        {formatTriggerLabel(value)}
        <svg
          className={`w-3 h-3 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen ? (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-lg animate-fade-up">
          <div className="py-1">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetClick(preset.id)}
                className={`
                  w-full text-left px-4 py-2 text-[13px] transition-colors
                  ${
                    value.preset === preset.id
                      ? "text-[var(--accent-pink)] bg-[var(--accent-pink)]/5 border-l-2 border-l-[var(--accent-pink)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border-l-2 border-l-transparent"
                  }
                `}
              >
                {preset.label}
              </button>
            ))}

            {/* Custom Range option */}
            <button
              type="button"
              onClick={handleCustomClick}
              className={`
                w-full text-left px-4 py-2 text-[13px] transition-colors
                ${
                  value.preset === "custom"
                    ? "text-[var(--accent-pink)] bg-[var(--accent-pink)]/5 border-l-2 border-l-[var(--accent-pink)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border-l-2 border-l-transparent"
                }
              `}
            >
              Custom Range
            </button>

            {/* Custom date inputs */}
            {value.preset === "custom" ? (
              <div className="px-4 py-3 border-t border-[var(--border-subtle)] space-y-2">
                <div>
                  <label htmlFor="date-range-from" className="block text-[11px] text-[var(--text-muted)] mb-1">From</label>
                  <input
                    id="date-range-from"
                    type="date"
                    value={value.from ?? ""}
                    onChange={(e) => handleCustomDateChange("from", e.target.value)}
                    className="
                      w-full px-2 py-1.5 rounded text-[13px]
                      bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                      text-[var(--text-primary)]
                      focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                      focus:outline-none transition-all duration-200
                    "
                  />
                </div>
                <div>
                  <label htmlFor="date-range-to" className="block text-[11px] text-[var(--text-muted)] mb-1">To</label>
                  <input
                    id="date-range-to"
                    type="date"
                    value={value.to ?? ""}
                    onChange={(e) => handleCustomDateChange("to", e.target.value)}
                    className="
                      w-full px-2 py-1.5 rounded text-[13px]
                      bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                      text-[var(--text-primary)]
                      focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                      focus:outline-none transition-all duration-200
                    "
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
