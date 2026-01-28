import { describe, it, expect } from "vitest";
import {
  getSubmissionDeadline,
  getTimezoneOffsetHours,
  isOverdue,
  getOverdueDates,
  isWeekday,
  isOnLeave,
  DEADLINE_TIMEZONE,
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

describe("getTimezoneOffsetHours", () => {
  it("returns +2 for EET (winter time)", () => {
    const winterDate = new Date("2026-01-15T12:00:00.000Z");
    expect(getTimezoneOffsetHours(winterDate, DEADLINE_TIMEZONE)).toBe(2);
  });

  it("returns +3 for EEST (summer time)", () => {
    const summerDate = new Date("2026-07-15T12:00:00.000Z");
    expect(getTimezoneOffsetHours(summerDate, DEADLINE_TIMEZONE)).toBe(3);
  });
});

describe("getSubmissionDeadline", () => {
  // In January 2026, EET is UTC+2, so 10:00 EET = 08:00 UTC

  it("returns next day 10am EET for Monday (winter)", () => {
    const monday = new Date("2026-01-26"); // Monday
    const deadline = getSubmissionDeadline(monday);
    // Tuesday 10:00 EET = 08:00 UTC
    expect(deadline.toISOString()).toBe("2026-01-27T08:00:00.000Z");
  });

  it("returns next day 10am EET for Thursday (winter)", () => {
    const thursday = new Date("2026-01-29"); // Thursday
    const deadline = getSubmissionDeadline(thursday);
    // Friday 10:00 EET = 08:00 UTC
    expect(deadline.toISOString()).toBe("2026-01-30T08:00:00.000Z");
  });

  it("returns Monday 10am EET for Friday (winter)", () => {
    const friday = new Date("2026-01-30"); // Friday
    const deadline = getSubmissionDeadline(friday);
    // Monday 10:00 EET = 08:00 UTC
    expect(deadline.toISOString()).toBe("2026-02-02T08:00:00.000Z");
  });

  // In July 2026, EEST is UTC+3, so 10:00 EEST = 07:00 UTC

  it("returns next day 10am EEST for Monday (summer)", () => {
    const monday = new Date("2026-07-20"); // Monday in summer
    const deadline = getSubmissionDeadline(monday);
    // Tuesday 10:00 EEST = 07:00 UTC
    expect(deadline.toISOString()).toBe("2026-07-21T07:00:00.000Z");
  });

  it("returns Monday 10am EEST for Friday (summer)", () => {
    const friday = new Date("2026-07-24"); // Friday in summer
    const deadline = getSubmissionDeadline(friday);
    // Monday 10:00 EEST = 07:00 UTC
    expect(deadline.toISOString()).toBe("2026-07-27T07:00:00.000Z");
  });
});

describe("isOverdue", () => {
  // Deadline for Monday Jan 26 is Tuesday Jan 27 at 10:00 EET = 08:00 UTC

  it("returns false if before deadline", () => {
    const workday = new Date("2026-01-26"); // Monday
    const now = new Date("2026-01-27T07:00:00.000Z"); // Tuesday 7am UTC = 9am EET (before 10am)
    expect(isOverdue(workday, now)).toBe(false);
  });

  it("returns true if after deadline", () => {
    const workday = new Date("2026-01-26"); // Monday
    const now = new Date("2026-01-27T09:00:00.000Z"); // Tuesday 9am UTC = 11am EET (after 10am)
    expect(isOverdue(workday, now)).toBe(true);
  });

  it("returns true exactly at deadline", () => {
    const workday = new Date("2026-01-26"); // Monday
    const now = new Date("2026-01-27T08:00:00.000Z"); // Tuesday 8am UTC = 10am EET exactly
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
    const now = new Date("2026-01-28T09:00:00.000Z"); // Wednesday 11am EET (after deadline)
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
    const now = new Date("2026-01-28T09:00:00.000Z"); // Wednesday 11am EET (after deadline)
    const submittedDates = new Set(["2026-01-26"]); // Only Monday
    const result = getOverdueDates(now, submittedDates, 7);
    expect(result).toContain("2026-01-27"); // Tuesday is overdue
  });

  it("excludes weekends", () => {
    const now = new Date("2026-02-02T09:00:00.000Z"); // Monday 11am EET (after deadline)
    const submittedDates = new Set<string>([]);
    const result = getOverdueDates(now, submittedDates, 10);
    expect(result).not.toContain("2026-01-31"); // Saturday
    expect(result).not.toContain("2026-02-01"); // Sunday
  });

  it("respects lookback limit", () => {
    const now = new Date("2026-01-28T09:00:00.000Z");
    const submittedDates = new Set<string>([]);
    const result = getOverdueDates(now, submittedDates, 2);
    // Should only look back 2 days, not find older overdue dates
    expect(result.length).toBeLessThanOrEqual(2);
  });
});

describe("getOverdueDates with leave periods", () => {
  it("excludes dates within approved leave periods", () => {
    // Monday Dec 23 2024 through Friday Dec 27 2024
    const now = new Date("2025-01-06T12:00:00Z"); // Well past deadlines
    const submittedDates = new Set<string>();
    const approvedLeave = [
      { startDate: "2024-12-23", endDate: "2024-12-27" },
    ];

    const overdue = getOverdueDates(now, submittedDates, 30, approvedLeave);

    // Dec 23-27 should NOT be in overdue (on leave)
    expect(overdue).not.toContain("2024-12-23");
    expect(overdue).not.toContain("2024-12-24");
    expect(overdue).not.toContain("2024-12-25");
    expect(overdue).not.toContain("2024-12-26");
    expect(overdue).not.toContain("2024-12-27");
  });

  it("includes dates outside leave periods", () => {
    const now = new Date("2025-01-06T12:00:00Z");
    const submittedDates = new Set<string>();
    const approvedLeave = [
      { startDate: "2024-12-23", endDate: "2024-12-24" },
    ];

    const overdue = getOverdueDates(now, submittedDates, 30, approvedLeave);

    // Dec 23-24 should NOT be overdue (on leave)
    expect(overdue).not.toContain("2024-12-23");
    expect(overdue).not.toContain("2024-12-24");

    // Dec 26-27 SHOULD be overdue (not on leave, not submitted, weekdays)
    expect(overdue).toContain("2024-12-26");
    expect(overdue).toContain("2024-12-27");
  });

  it("handles multiple leave periods", () => {
    const now = new Date("2025-01-10T12:00:00Z");
    const submittedDates = new Set<string>();
    const approvedLeave = [
      { startDate: "2024-12-23", endDate: "2024-12-24" },
      { startDate: "2025-01-02", endDate: "2025-01-03" },
    ];

    const overdue = getOverdueDates(now, submittedDates, 30, approvedLeave);

    // Both leave periods should be excluded
    expect(overdue).not.toContain("2024-12-23");
    expect(overdue).not.toContain("2024-12-24");
    expect(overdue).not.toContain("2025-01-02");
    expect(overdue).not.toContain("2025-01-03");
  });
});

describe("isOnLeave", () => {
  it("returns true for date within leave period", () => {
    const leavePeriods = [{ startDate: "2024-12-23", endDate: "2024-12-27" }];
    expect(isOnLeave("2024-12-25", leavePeriods)).toBe(true);
  });

  it("returns false for date outside leave period", () => {
    const leavePeriods = [{ startDate: "2024-12-23", endDate: "2024-12-27" }];
    expect(isOnLeave("2024-12-20", leavePeriods)).toBe(false);
  });

  it("returns true for date on boundary", () => {
    const leavePeriods = [{ startDate: "2024-12-23", endDate: "2024-12-27" }];
    expect(isOnLeave("2024-12-23", leavePeriods)).toBe(true);
    expect(isOnLeave("2024-12-27", leavePeriods)).toBe(true);
  });

  it("returns false for empty leave periods", () => {
    expect(isOnLeave("2024-12-25", [])).toBe(false);
  });
});
