"use client";

import { useState, useRef } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  formatMonthShort,
  getMonthRange,
  formatDateISO,
} from "@/lib/date-utils";

export type Preset = "this-month" | "last-month" | "custom";

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date, preset: Preset) => void;
}

/**
 * Detect which preset matches the current date range
 */
function detectPreset(startDate: Date, endDate: Date): Preset {
  const today = new Date();

  // Check if matches this month
  const thisMonth = getMonthRange(today);
  if (
    formatDateISO(startDate) === formatDateISO(thisMonth.start) &&
    formatDateISO(endDate) === formatDateISO(thisMonth.end)
  ) {
    return "this-month";
  }

  // Check if matches last month
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonth = getMonthRange(lastMonthDate);
  if (
    formatDateISO(startDate) === formatDateISO(lastMonth.start) &&
    formatDateISO(endDate) === formatDateISO(lastMonth.end)
  ) {
    return "last-month";
  }

  return "custom";
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(formatDateISO(startDate));
  const [customEnd, setCustomEnd] = useState(formatDateISO(endDate));
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentPreset = detectPreset(startDate, endDate);

  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  // Reset custom inputs to current props when opening dropdown
  const handleToggle = () => {
    if (!isOpen) {
      setCustomStart(formatDateISO(startDate));
      setCustomEnd(formatDateISO(endDate));
    }
    setIsOpen(!isOpen);
  };

  const handlePresetClick = (preset: "this-month" | "last-month") => {
    const today = new Date();
    let range: { start: Date; end: Date };

    if (preset === "this-month") {
      range = getMonthRange(today);
    } else {
      const lastMonthDate = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1
      );
      range = getMonthRange(lastMonthDate);
    }

    onChange(range.start, range.end, preset);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    const start = new Date(customStart);
    const end = new Date(customEnd);

    // Validate dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return;
    }

    // Validate: start must be <= end
    if (start > end) {
      return;
    }

    onChange(start, end, "custom");
    setIsOpen(false);
  };

  // Format display text
  const formatDisplayText = () => {
    const startMonth = formatMonthShort(startDate);
    const endMonth = formatMonthShort(endDate);

    if (startMonth === endMonth) {
      return startMonth;
    }
    return `${startMonth} - ${endMonth}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] hover:border-[var(--border-accent)] transition-colors"
        style={{ fontSize: "13px" }}
      >
        {/* Calendar Icon */}
        <svg
          className="w-4 h-4 text-[var(--text-secondary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span>{formatDisplayText()}</span>
        {/* Chevron Icon */}
        <svg
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-lg z-50 animate-fade-up">
          {/* Presets Section */}
          <div className="p-3 border-b border-[var(--border-subtle)]">
            <div
              className="text-[var(--text-muted)] uppercase tracking-wide mb-2"
              style={{ fontSize: "10px" }}
            >
              Presets
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handlePresetClick("this-month")}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  currentPreset === "this-month"
                    ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                }`}
                style={{ fontSize: "13px" }}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick("last-month")}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  currentPreset === "last-month"
                    ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                }`}
                style={{ fontSize: "13px" }}
              >
                Last Month
              </button>
            </div>
          </div>

          {/* Custom Range Section */}
          <div className="p-3">
            <div
              className="text-[var(--text-muted)] uppercase tracking-wide mb-2"
              style={{ fontSize: "10px" }}
            >
              Custom Range
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:border-[var(--border-accent)] focus:outline-none"
                  style={{ fontSize: "12px" }}
                />
                <span
                  className="text-[var(--text-muted)]"
                  style={{ fontSize: "12px" }}
                >
                  to
                </span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:border-[var(--border-accent)] focus:outline-none"
                  style={{ fontSize: "12px" }}
                />
              </div>
              <button
                type="button"
                onClick={handleApplyCustom}
                className="w-full px-3 py-2 bg-[var(--accent-pink)] text-[var(--bg-deep)] rounded-md font-medium hover:opacity-90 transition-opacity"
                style={{ fontSize: "12px" }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
