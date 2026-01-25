/**
 * Utility functions for timesheet submission deadlines.
 */

import { formatDateISO } from "./date-utils";

/** Minimum hours required for a valid submission */
export const MIN_SUBMISSION_HOURS = 8;

/** Default number of days to look back for overdue dates */
export const DEFAULT_LOOKBACK_DAYS = 30;

/**
 * Check if a date is a weekday (Monday-Friday)
 */
export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

/**
 * Get the submission deadline for a given workday.
 * - For Monday-Thursday: next day at 10:00 UTC
 * - For Friday: following Monday at 10:00 UTC
 */
export function getSubmissionDeadline(workday: Date): Date {
  const deadline = new Date(workday);
  const dayOfWeek = workday.getDay();

  if (dayOfWeek === 5) {
    // Friday -> Monday (add 3 days)
    deadline.setDate(deadline.getDate() + 3);
  } else {
    // Mon-Thu -> next day
    deadline.setDate(deadline.getDate() + 1);
  }

  // Set time to 10:00 UTC
  deadline.setUTCHours(10, 0, 0, 0);

  return deadline;
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
 * @returns Array of overdue date strings in ISO format
 */
export function getOverdueDates(
  now: Date,
  submittedDates: Set<string>,
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS
): string[] {
  const overdueDates: string[] = [];

  // Start from lookbackDays ago and check each day
  for (let i = lookbackDays; i >= 0; i--) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - i);

    const dateISO = formatDateISO(checkDate);

    // Skip if already submitted or not a weekday
    if (submittedDates.has(dateISO)) {
      continue;
    }

    if (!isWeekday(checkDate)) {
      continue;
    }

    // Check if overdue
    if (isOverdue(checkDate, now)) {
      overdueDates.push(dateISO);
    }
  }

  return overdueDates;
}
