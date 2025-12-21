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
 * Format date as ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
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
