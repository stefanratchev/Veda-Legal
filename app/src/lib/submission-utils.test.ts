import { describe, it, expect } from "vitest";
import {
  getSubmissionDeadline,
  isOverdue,
  getOverdueDates,
  isWeekday,
} from "./submission-utils";

describe("isWeekday", () => {
  it("returns true for Monday", () => {
    const monday = new Date("2026-01-26"); // Monday
    expect(isWeekday(monday)).toBe(true);
  });

  it("returns true for Friday", () => {
    const friday = new Date("2026-01-30"); // Friday
    expect(isWeekday(friday)).toBe(true);
  });

  it("returns false for Saturday", () => {
    const saturday = new Date("2026-01-31"); // Saturday
    expect(isWeekday(saturday)).toBe(false);
  });

  it("returns false for Sunday", () => {
    const sunday = new Date("2026-02-01"); // Sunday
    expect(isWeekday(sunday)).toBe(false);
  });
});

describe("getSubmissionDeadline", () => {
  it("returns next day 10am for Monday", () => {
    const monday = new Date("2026-01-26"); // Monday
    const deadline = getSubmissionDeadline(monday);
    expect(deadline.toISOString()).toBe("2026-01-27T10:00:00.000Z");
  });

  it("returns next day 10am for Thursday", () => {
    const thursday = new Date("2026-01-29"); // Thursday
    const deadline = getSubmissionDeadline(thursday);
    expect(deadline.toISOString()).toBe("2026-01-30T10:00:00.000Z");
  });

  it("returns Monday 10am for Friday", () => {
    const friday = new Date("2026-01-30"); // Friday
    const deadline = getSubmissionDeadline(friday);
    expect(deadline.toISOString()).toBe("2026-02-02T10:00:00.000Z"); // Monday
  });
});

describe("isOverdue", () => {
  it("returns false if before deadline", () => {
    const workday = new Date("2026-01-26"); // Monday
    const now = new Date("2026-01-27T09:00:00.000Z"); // Tuesday 9am
    expect(isOverdue(workday, now)).toBe(false);
  });

  it("returns true if after deadline", () => {
    const workday = new Date("2026-01-26"); // Monday
    const now = new Date("2026-01-27T11:00:00.000Z"); // Tuesday 11am
    expect(isOverdue(workday, now)).toBe(true);
  });

  it("returns true exactly at deadline", () => {
    const workday = new Date("2026-01-26"); // Monday
    const now = new Date("2026-01-27T10:00:00.000Z"); // Tuesday 10am exactly
    expect(isOverdue(workday, now)).toBe(true);
  });

  it("returns false for weekend days", () => {
    const saturday = new Date("2026-01-31"); // Saturday
    const now = new Date("2026-02-03T11:00:00.000Z"); // Tuesday after
    expect(isOverdue(saturday, now)).toBe(false);
  });

  it("returns false for future dates", () => {
    const futureDate = new Date("2026-02-05"); // Future Thursday
    const now = new Date("2026-01-27T11:00:00.000Z");
    expect(isOverdue(futureDate, now)).toBe(false);
  });
});

describe("getOverdueDates", () => {
  it("returns empty array when all dates are submitted", () => {
    const now = new Date("2026-01-28T11:00:00.000Z"); // Wednesday 11am
    // All overdue weekdays in the 7-day lookback window
    const submittedDates = new Set([
      "2026-01-21", // Wed
      "2026-01-22", // Thu
      "2026-01-23", // Fri
      "2026-01-26", // Mon
      "2026-01-27", // Tue
    ]);
    const result = getOverdueDates(now, submittedDates, 7);
    expect(result).toEqual([]);
  });

  it("returns overdue dates not in submitted set", () => {
    const now = new Date("2026-01-28T11:00:00.000Z"); // Wednesday 11am
    const submittedDates = new Set(["2026-01-26"]); // Only Monday
    const result = getOverdueDates(now, submittedDates, 7);
    expect(result).toContain("2026-01-27"); // Tuesday is overdue
  });

  it("excludes weekends", () => {
    const now = new Date("2026-02-02T11:00:00.000Z"); // Monday 11am
    const submittedDates = new Set<string>([]);
    const result = getOverdueDates(now, submittedDates, 10);
    expect(result).not.toContain("2026-01-31"); // Saturday
    expect(result).not.toContain("2026-02-01"); // Sunday
  });

  it("respects lookback limit", () => {
    const now = new Date("2026-01-28T11:00:00.000Z");
    const submittedDates = new Set<string>([]);
    const result = getOverdueDates(now, submittedDates, 2);
    // Should only look back 2 days, not find older overdue dates
    expect(result.length).toBeLessThanOrEqual(2);
  });
});
