/**
 * Utility functions for timesheet submission deadlines.
 */

import { formatDateISO } from "./date-utils";

/** Minimum hours required for a valid submission */
export const MIN_SUBMISSION_HOURS = 8;

/** Default number of days to look back for overdue dates */
export const DEFAULT_LOOKBACK_DAYS = 30;

/** Timezone for deadline calculations (Eastern European Time) */
export const DEADLINE_TIMEZONE = "Europe/Sofia";

/** Hour of day for submission deadline (10:00 AM) */
export const DEADLINE_HOUR = 10;

/**
 * Check if a date is a weekday (Monday-Friday)
 */
export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

/**
 * Get timezone offset in hours for a given date and timezone.
 * Handles DST automatically.
 * Example: Europe/Sofia returns 2 for EET (winter) or 3 for EEST (summer).
 */
export function getTimezoneOffsetHours(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  });

  const parts = formatter.formatToParts(date);
  const offsetPart = parts.find((p) => p.type === "timeZoneName");

  if (offsetPart?.value) {
    // Value is like "GMT+2" or "GMT+3"
    const match = offsetPart.value.match(/GMT([+-]?\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  // Fallback to EET (UTC+2)
  return 2;
}

/**
 * Get the submission deadline for a given workday.
 * - For Monday-Thursday: next day at 10:00 EET/EEST
 * - For Friday: following Monday at 10:00 EET/EEST
 *
 * Automatically handles DST transitions.
 */
export function getSubmissionDeadline(workday: Date): Date {
  // Get date components in local time (we need the logical date)
  const year = workday.getFullYear();
  const month = workday.getMonth();
  const day = workday.getDate();
  const dayOfWeek = workday.getDay();

  // Calculate the deadline day
  const daysToAdd = dayOfWeek === 5 ? 3 : 1; // Friday -> Monday, else next day
  const deadlineDay = day + daysToAdd;

  // Create a temp date at noon on the deadline day to get the correct EET offset
  // (using noon avoids edge cases around DST transitions at midnight)
  const tempDate = new Date(year, month, deadlineDay, 12, 0, 0, 0);

  // Get EET/EEST offset for this date (handles DST automatically)
  const eetOffsetHours = getTimezoneOffsetHours(tempDate, DEADLINE_TIMEZONE);

  // Calculate the UTC timestamp for 10:00 AM EET on the deadline day
  // 10:00 EET (UTC+2) = 08:00 UTC
  // 10:00 EEST (UTC+3) = 07:00 UTC
  return new Date(Date.UTC(year, month, deadlineDay, DEADLINE_HOUR - eetOffsetHours, 0, 0, 0));
}

/**
 * Leave period for overdue calculation.
 */
export interface LeavePeriodForOverdue {
  startDate: string;
  endDate: string;
}

/**
 * Check if a date falls within any approved leave period.
 */
export function isOnLeave(dateISO: string, leavePeriods: LeavePeriodForOverdue[]): boolean {
  for (const leave of leavePeriods) {
    if (dateISO >= leave.startDate && dateISO <= leave.endDate) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a workday's submission is overdue.
 * Returns false for:
 * - Weekend days (no submission required)
 * - Future dates
 * - Dates where the deadline hasn't passed yet
 */
export function isOverdue(workday: Date, now: Date): boolean {
  // Weekend days are never overdue
  if (!isWeekday(workday)) {
    return false;
  }

  // Future dates are not overdue
  const workdayISO = formatDateISO(workday);
  const nowISO = formatDateISO(now);
  if (workdayISO > nowISO) {
    return false;
  }

  // Check if we're past the deadline
  const deadline = getSubmissionDeadline(workday);
  return now >= deadline;
}

/**
 * Get all overdue dates that haven't been submitted.
 * @param now Current date/time
 * @param submittedDates Set of already-submitted dates in ISO format (YYYY-MM-DD)
 * @param lookbackDays Number of days to look back (default: 30)
 * @param approvedLeave Array of approved leave periods to exclude
 * @returns Array of overdue date strings in ISO format
 */
export function getOverdueDates(
  now: Date,
  submittedDates: Set<string>,
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
  approvedLeave: LeavePeriodForOverdue[] = []
): string[] {
  const overdueDates: string[] = [];

  // Start from lookbackDays ago and check each day
  for (let i = lookbackDays; i >= 0; i--) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - i);

    const dateISO = formatDateISO(checkDate);

    // Skip if already submitted
    if (submittedDates.has(dateISO)) {
      continue;
    }

    // Skip if not a weekday
    if (!isWeekday(checkDate)) {
      continue;
    }

    // Skip if on approved leave
    if (isOnLeave(dateISO, approvedLeave)) {
      continue;
    }

    // Check if overdue
    if (isOverdue(checkDate, now)) {
      overdueDates.push(dateISO);
    }
  }

  return overdueDates;
}
