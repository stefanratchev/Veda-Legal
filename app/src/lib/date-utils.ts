/**
 * Date and time utility functions for the timesheets application.
 */

/**
 * Format date for display (e.g., "Friday, 20 December 2024")
 */
export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format date as ISO string (YYYY-MM-DD) in local time
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format hours for display (e.g., "2h 30m", "45m", "3h")
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * Parse hours into separate hours and minutes components.
 * Minutes are rounded to nearest 15-minute increment.
 */
export function parseHoursToComponents(hours: number): { hours: number; minutes: number } {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const roundedMinutes = Math.round(m / 15) * 15;
  return {
    hours: h,
    minutes: roundedMinutes >= 60 ? 0 : roundedMinutes,
  };
}

/**
 * Convert hours and minutes to decimal hours
 */
export function toDecimalHours(hours: number, minutes: number): number {
  return hours + minutes / 60;
}

/**
 * Get weekdays (Mon-Fri) for a given date's week
 */
export function getWeekDays(centerDate: Date): Date[] {
  const days: Date[] = [];
  const dayOfWeek = (centerDate.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(centerDate);
  monday.setDate(centerDate.getDate() - dayOfWeek);

  for (let i = 0; i < 5; i++) {
    // Mon-Fri only
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }
  return days;
}

/**
 * Get short day name (e.g., "Mon", "Tue")
 */
export function getDayName(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short" });
}

/**
 * Get month and year (e.g., "December 2024")
 */
export function getMonthName(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return formatDateISO(date1) === formatDateISO(date2);
}

/**
 * Check if a date is in the future (compared to today)
 */
export function isFutureDate(date: Date, today: Date = new Date()): boolean {
  return formatDateISO(date) > formatDateISO(today);
}

/**
 * Get first and last day of a month
 */
export function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

/**
 * Get previous period of same length.
 * If the period is exactly a calendar month, returns the previous calendar month.
 */
export function getPreviousPeriod(
  start: Date,
  end: Date
): { start: Date; end: Date } {
  // Check if this is a full calendar month
  const isFirstOfMonth = start.getDate() === 1;
  const lastDayOfMonth = new Date(
    end.getFullYear(),
    end.getMonth() + 1,
    0
  ).getDate();
  const isLastOfMonth = end.getDate() === lastDayOfMonth;
  const isSameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();

  if (isFirstOfMonth && isLastOfMonth && isSameMonth) {
    // Return previous calendar month
    const prevMonth = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    return getMonthRange(prevMonth);
  }

  // For custom ranges, return same-length period
  // Use UTC-based arithmetic to avoid DST off-by-one errors
  const days =
    Math.round(
      (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
        Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
        (1000 * 60 * 60 * 24)
    ) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  return { start: prevStart, end: prevEnd };
}

/**
 * Get same period one year ago
 */
export function getPreviousYear(
  start: Date,
  end: Date
): { start: Date; end: Date } {
  // Use Date constructor to handle leap year edge cases properly
  // (e.g., Feb 29 2024 -> Feb 29 2023 becomes Mar 1 with setFullYear)
  const prevStart = new Date(
    start.getFullYear() - 1,
    start.getMonth(),
    start.getDate()
  );
  const prevEnd = new Date(
    end.getFullYear() - 1,
    end.getMonth(),
    end.getDate()
  );
  return { start: prevStart, end: prevEnd };
}

/**
 * Format date as short month and year (e.g., "Dec 2025")
 */
export function formatMonthShort(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
