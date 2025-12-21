import { describe, it, expect } from "vitest";
import {
  formatDateISO,
  formatHours,
  parseHoursToComponents,
  toDecimalHours,
  getWeekDays,
  isSameDay,
  isFutureDate,
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
    it("returns 5 weekdays (Mon-Fri)", () => {
      const date = new Date("2024-12-18"); // Wednesday
      const days = getWeekDays(date);
      expect(days).toHaveLength(5);
    });

    it("starts on Monday", () => {
      const date = new Date("2024-12-18"); // Wednesday
      const days = getWeekDays(date);
      expect(days[0].getDay()).toBe(1); // Monday
    });

    it("ends on Friday", () => {
      const date = new Date("2024-12-18"); // Wednesday
      const days = getWeekDays(date);
      expect(days[4].getDay()).toBe(5); // Friday
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
});
