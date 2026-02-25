"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import { formatDateISO, getWeekDays, getDayName, getMonthName } from "@/lib/date-utils";
import { useClickOutside } from "@/hooks/useClickOutside";

interface WeekStripProps {
  selectedDate: Date;
  today: Date;
  submittedDates?: Set<string>;
  overdueDates?: Set<string>;
  onSelectDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
  // M365 Activity
  onFetchM365Activity: () => void;
  isM365Loading: boolean;
  isM365PanelOpen: boolean;
}

/**
 * Returns the appropriate status icon for a date based on submission status.
 * Priority: submitted > overdue > null
 *
 * Design: Pill badges with filled icons for clear visual hierarchy
 */
function getStatusIcon(dateStr: string, submittedDates: Set<string>, overdueDates: Set<string>, compact = false) {
  if (submittedDates.has(dateStr)) {
    // Green pill badge with checkmark
    return (
      <span
        className={`
          inline-flex items-center justify-center rounded-full
          ${compact ? "w-4 h-4" : "w-5 h-5"}
          bg-[var(--success)] text-white shadow-sm shadow-[var(--success)]/30
        `}
      >
        <svg
          className={compact ? "w-2.5 h-2.5" : "w-3 h-3"}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="3"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }

  if (overdueDates.has(dateStr)) {
    // Red pill badge with clock - subtle pulse animation for urgency
    return (
      <span
        className={`
          inline-flex items-center justify-center rounded-full animate-pulse
          ${compact ? "w-4 h-4" : "w-5 h-5"}
          bg-[var(--danger)] text-white shadow-sm shadow-[var(--danger)]/40
        `}
      >
        <svg
          className={compact ? "w-2.5 h-2.5" : "w-3 h-3"}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }

  return null;
}

// Default empty sets for optional props
const EMPTY_SET = new Set<string>();

export function WeekStrip({
  selectedDate,
  today,
  submittedDates = EMPTY_SET,
  overdueDates = EMPTY_SET,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
  onFetchM365Activity,
  isM365Loading,
  isM365PanelOpen,
}: WeekStripProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(selectedDate));
  const calendarRef = useRef<HTMLDivElement>(null);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  // Close calendar on outside click
  useClickOutside(calendarRef, () => setIsCalendarOpen(false), isCalendarOpen);

  // Generate calendar grid for displayed month
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);

    // Get day of week for first day (0 = Sunday, convert to Monday = 0)
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days: (Date | null)[] = [];

    // Add empty slots for days before first of month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  }, [calendarMonth]);

  const handleCalendarOpen = useCallback(() => {
    setCalendarMonth(new Date(selectedDate));
    setIsCalendarOpen(true);
  }, [selectedDate]);

  const handlePrevMonth = useCallback(() => {
    setCalendarMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setCalendarMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  }, []);

  const handleSelectCalendarDay = useCallback((date: Date) => {
    onSelectDate(date);
    setIsCalendarOpen(false);
  }, [onSelectDate]);

  const isToday = (date: Date): boolean => formatDateISO(date) === formatDateISO(today);
  const isSelected = (date: Date): boolean => formatDateISO(date) === formatDateISO(selectedDate);
  const isWeekend = (date: Date): boolean => date.getDay() === 0 || date.getDay() === 6;

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-3" data-testid="week-strip">
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

        {/* Days - scrollable on mobile */}
        <div className="flex-1 overflow-x-auto lg:overflow-visible scrollbar-hide">
          <div className="flex items-center gap-1 min-w-max lg:min-w-0">
            {weekDays.map((day) => {
            const dateStr = formatDateISO(day);
            const selected = isSelected(day);
            const todayDay = isToday(day);
            const weekend = isWeekend(day);
            const statusIcon = getStatusIcon(dateStr, submittedDates, overdueDates, false);

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(day)}
                className={`
                  relative flex flex-col items-center gap-0.5 px-2 py-2 rounded
                  transition-all duration-200 flex-1 cursor-pointer
                  ${selected
                    ? "ring-2 ring-[var(--accent-pink)] bg-[var(--bg-surface)]"
                    : "hover:bg-[var(--bg-surface)]"
                  }
                `}
              >
                <span className={`text-[10px] font-medium uppercase tracking-wider ${weekend ? "text-[var(--text-muted)]/60" : "text-[var(--text-muted)]"}`}>
                  {getDayName(day)}
                </span>
                <span className={`text-base font-heading font-semibold ${todayDay ? "text-[var(--accent-pink)]" : weekend ? "text-[var(--text-primary)]/70" : "text-[var(--text-primary)]"}`}>
                  {day.getDate()}
                </span>
                {/* Status badge (submitted/overdue) */}
                <span className="h-5 flex items-center justify-center">
                  {statusIcon}
                </span>
              </button>
            );
            })}
          </div>
        </div>

        {/* Next Week */}
        <button
          onClick={onNextWeek}
          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all duration-200"
          title="Next week"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-[var(--border-subtle)]" />

        {/* Right-side controls: 2-row layout */}
        <div className="flex flex-col gap-1">
          {/* Top row: Calendar + Today */}
          <div className="flex items-center gap-1.5">
            <div className="relative" ref={calendarRef}>
              {/* Calendar Icon Button */}
              <button
                onClick={handleCalendarOpen}
                className="p-1.5 rounded text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] transition-all duration-200"
                title="Open calendar"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>

              {/* Mini Calendar Popup */}
              {isCalendarOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-xl animate-fade-up p-3 w-[280px]">
                  {/* Month Header with Navigation */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">
                      {getMonthName(calendarMonth)}
                    </span>
                    <button
                      onClick={handleNextMonth}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
                      <div
                        key={day}
                        className="text-[10px] font-medium text-[var(--text-muted)] text-center py-1"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, index) => {
                      if (!day) {
                        return <div key={`empty-${index}`} className="w-8 h-8" />;
                      }

                      const dateStr = formatDateISO(day);
                      const selected = isSelected(day);
                      const todayDay = isToday(day);
                      const weekend = isWeekend(day);
                      const statusIcon = getStatusIcon(dateStr, submittedDates, overdueDates, true);

                      return (
                        <button
                          key={dateStr}
                          onClick={() => handleSelectCalendarDay(day)}
                          className={`
                            relative w-8 h-8 rounded text-[12px] font-medium
                            transition-all duration-200 cursor-pointer flex flex-col items-center justify-center
                            ${selected
                              ? "ring-2 ring-[var(--accent-pink)] bg-[var(--bg-surface)]"
                              : "hover:bg-[var(--bg-surface)]"
                            }
                            ${todayDay ? "text-[var(--accent-pink)]" : weekend ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"}
                          `}
                        >
                          <span className={statusIcon ? "-mt-0.5" : ""}>{day.getDate()}</span>
                          {/* Status badge (submitted/overdue) */}
                          {statusIcon && (
                            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2">{statusIcon}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onGoToToday}
              className="px-2 py-1 rounded text-[11px] font-medium text-[var(--accent-pink)] bg-[var(--accent-pink-glow)] border border-[var(--border-accent)] hover:bg-[var(--accent-pink)] hover:text-[var(--bg-deep)] transition-all duration-200"
            >
              Today
            </button>
          </div>

          {/* Bottom row: M365 Activity button */}
          <button
            onClick={onFetchM365Activity}
            disabled={isM365Loading}
            className={`
              flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium
              transition-all duration-200
              ${isM365PanelOpen
                ? "bg-[var(--info)] text-white border border-[var(--info)]"
                : "text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
              }
              ${isM365Loading ? "opacity-70 cursor-not-allowed" : ""}
            `}
            title="Fetch Microsoft 365 activity (emails & calendar)"
          >
            {isM365Loading ? (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            )}
            <span>M365</span>
          </button>
        </div>
      </div>
    </div>
  );
}
