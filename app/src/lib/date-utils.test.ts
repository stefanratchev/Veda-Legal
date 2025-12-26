import { describe, it, expect } from "vitest";
import {
  formatDateISO,
  formatHours,
  parseHoursToComponents,
  toDecimalHours,
  getWeekDays,
  isSameDay,
  isFutureDate,
  getMonthRange,
  getPreviousPeriod,
  getPreviousYear,
  formatMonthShort,
} from "./date-utils";

describe("date-utils", () => {
  describe("formatDateISO", () => {
    it("formats date as YYYY-MM-DD", () => {
      const date = new Date("2024-12-20T12:00:00Z");
      expect(formatDateISO(date)).toBe("2024-12-20");
    });
  });

  describe("formatHours", () => {
    it("formats whole hours", () => {
      expect(formatHours(3)).toBe("3h");
    });

    it("formats hours with minutes", () => {
      expect(formatHours(2.5)).toBe("2h 30m");
    });

    it("formats minutes only", () => {
      expect(formatHours(0.75)).toBe("45m");
    });
  });

  describe("parseHoursToComponents", () => {
    it("parses whole hours", () => {
      expect(parseHoursToComponents(3)).toEqual({ hours: 3, minutes: 0 });
    });

    it("parses hours with half hour", () => {
      expect(parseHoursToComponents(2.5)).toEqual({ hours: 2, minutes: 30 });
    });

    it("rounds minutes to nearest 15", () => {
      expect(parseHoursToComponents(1.4)).toEqual({ hours: 1, minutes: 30 });
    });
  });

  describe("toDecimalHours", () => {
    it("converts hours and minutes to decimal", () => {
      expect(toDecimalHours(2, 30)).toBe(2.5);
      expect(toDecimalHours(1, 15)).toBe(1.25);
      expect(toDecimalHours(0, 45)).toBe(0.75);
    });
  });

  describe("getWeekDays", () => {
    it("returns 7 days (Mon-Sun)", () => {
      const date = new Date("2024-12-18"); // Wednesday
      const days = getWeekDays(date);
      expect(days).toHaveLength(7);
    });

    it("starts on Monday", () => {
      const date = new Date("2024-12-18"); // Wednesday
      const days = getWeekDays(date);
      expect(days[0].getDay()).toBe(1); // Monday
    });

    it("ends on Sunday", () => {
      const date = new Date("2024-12-18"); // Wednesday
      const days = getWeekDays(date);
      expect(days[6].getDay()).toBe(0); // Sunday
    });
  });

  describe("isSameDay", () => {
    it("returns true for same day", () => {
      const date1 = new Date("2024-12-20T10:00:00");
      const date2 = new Date("2024-12-20T15:30:00");
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it("returns false for different days", () => {
      const date1 = new Date("2024-12-20");
      const date2 = new Date("2024-12-21");
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe("isFutureDate", () => {
    it("returns true for future date", () => {
      const future = new Date("2025-01-01");
      const today = new Date("2024-12-20");
      expect(isFutureDate(future, today)).toBe(true);
    });

    it("returns false for past date", () => {
      const past = new Date("2024-01-01");
      const today = new Date("2024-12-20");
      expect(isFutureDate(past, today)).toBe(false);
    });

    it("returns false for same day", () => {
      const date = new Date("2024-12-20");
      const today = new Date("2024-12-20");
      expect(isFutureDate(date, today)).toBe(false);
    });
  });

  describe("getMonthRange", () => {
    it("returns first and last day of month", () => {
      const date = new Date(2025, 11, 15); // December 15, 2025 (month is 0-indexed)
      const { start, end } = getMonthRange(date);
      expect(formatDateISO(start)).toBe("2025-12-01");
      expect(formatDateISO(end)).toBe("2025-12-31");
    });
  });

  describe("getPreviousPeriod", () => {
    it("returns previous month for monthly range", () => {
      const start = new Date(2025, 11, 1); // December 1, 2025
      const end = new Date(2025, 11, 31); // December 31, 2025
      const { start: prevStart, end: prevEnd } = getPreviousPeriod(start, end);
      expect(formatDateISO(prevStart)).toBe("2025-11-01");
      expect(formatDateISO(prevEnd)).toBe("2025-11-30");
    });

    it("returns same-length period for custom range", () => {
      const start = new Date(2025, 11, 10); // December 10, 2025
      const end = new Date(2025, 11, 20); // December 20, 2025
      const { start: prevStart, end: prevEnd } = getPreviousPeriod(start, end);
      expect(formatDateISO(prevStart)).toBe("2025-11-29");
      expect(formatDateISO(prevEnd)).toBe("2025-12-09");
    });
  });

  describe("getPreviousYear", () => {
    it("returns same dates one year ago", () => {
      const start = new Date(2025, 11, 1); // December 1, 2025
      const end = new Date(2025, 11, 31); // December 31, 2025
      const { start: prevStart, end: prevEnd } = getPreviousYear(start, end);
      expect(formatDateISO(prevStart)).toBe("2024-12-01");
      expect(formatDateISO(prevEnd)).toBe("2024-12-31");
    });
  });

  describe("formatMonthShort", () => {
    it("formats date as short month and year", () => {
      const date = new Date(2025, 11, 15); // December 15, 2025
      expect(formatMonthShort(date)).toBe("Dec 2025");
    });
  });
});
