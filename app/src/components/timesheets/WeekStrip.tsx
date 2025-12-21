"use client";

import { useRef, useState, useMemo } from "react";
import { formatDateISO, getWeekDays, getDayName, getMonthName } from "@/lib/date-utils";
import { useClickOutside } from "@/hooks/useClickOutside";

interface WeekStripProps {
  selectedDate: Date;
  today: Date;
  datesWithEntries: Set<string>;
  onSelectDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
}

export function WeekStrip({
  selectedDate,
  today,
  datesWithEntries,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
}: WeekStripProps) {
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  // Close month picker on outside click
  useClickOutside(monthPickerRef, () => setIsMonthPickerOpen(false), isMonthPickerOpen);

  // Generate recent months for picker
  const recentMonths = useMemo(() => {
    const months = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      months.push({
        label: date.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        monthsAgo: i,
      });
    }
    return months;
  }, [today]);

  const jumpToMonth = (monthsAgo: number) => {
    const newDate = new Date(today);
    newDate.setMonth(newDate.getMonth() - monthsAgo);
    newDate.setDate(1);
    onSelectDate(newDate);
    setIsMonthPickerOpen(false);
  };

  const isToday = (date: Date): boolean => formatDateISO(date) === formatDateISO(today);
  const isSelected = (date: Date): boolean => formatDateISO(date) === formatDateISO(selectedDate);
  const isFuture = (date: Date): boolean => formatDateISO(date) > formatDateISO(today);
  const hasEntries = (date: Date): boolean => datesWithEntries.has(formatDateISO(date));

  const canGoNext = formatDateISO(weekDays[4]) < formatDateISO(today);

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-3">
      <div className="flex items-center gap-3">
        {/* Prev Week */}
        <button
          onClick={onPrevWeek}
          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all duration-200"
          title="Previous week"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Days */}
        <div className="flex-1 flex items-center gap-2">
          {weekDays.map((day) => {
            const disabled = isFuture(day);
            const selected = isSelected(day);
            const todayDay = isToday(day);
            const hasEntry = hasEntries(day);

            return (
              <button
                key={formatDateISO(day)}
                disabled={disabled}
                onClick={() => !disabled && onSelectDate(day)}
                className={`
                  relative flex flex-col items-center gap-0.5 px-3 py-2 rounded
                  transition-all duration-200 flex-1
                  ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                  ${selected
                    ? "bg-[var(--accent-pink)] text-[var(--bg-deep)] shadow-lg shadow-[var(--accent-pink-glow)]"
                    : "hover:bg-[var(--bg-surface)]"
                  }
                  ${todayDay && !selected ? "ring-1 ring-[var(--accent-pink)] ring-offset-1 ring-offset-[var(--bg-elevated)]" : ""}
                `}
              >
                <span className={`text-[10px] font-medium uppercase tracking-wider ${selected ? "text-[var(--bg-deep)]/70" : "text-[var(--text-muted)]"}`}>
                  {getDayName(day)}
                </span>
                <span className={`text-base font-heading font-semibold ${selected ? "text-[var(--bg-deep)]" : "text-[var(--text-primary)]"}`}>
                  {day.getDate()}
                </span>
                {/* Entry indicator dot */}
                {hasEntry && (
                  <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${selected ? "bg-[var(--bg-deep)]" : "bg-[var(--accent-pink)]"}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Next Week */}
        <button
          onClick={onNextWeek}
          disabled={!canGoNext}
          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next week"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-[var(--border-subtle)]" />

        {/* Month Picker & Today */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={monthPickerRef}>
            <button
              onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
              className="px-2.5 py-1.5 rounded text-[13px] font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] transition-all duration-200 flex items-center gap-1.5"
            >
              <span>{getMonthName(selectedDate)}</span>
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isMonthPickerOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isMonthPickerOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-xl overflow-hidden animate-fade-up min-w-[160px]">
                {recentMonths.map((month) => (
                  <button
                    key={month.monthsAgo}
                    onClick={() => jumpToMonth(month.monthsAgo)}
                    className="w-full px-3 py-2 text-left text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {month.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onGoToToday}
            className="px-2.5 py-1.5 rounded text-[13px] font-medium text-[var(--accent-pink)] bg-[var(--accent-pink-glow)] border border-[var(--border-accent)] hover:bg-[var(--accent-pink)] hover:text-[var(--bg-deep)] transition-all duration-200"
          >
            Today
          </button>
        </div>
      </div>
    </div>
  );
}
