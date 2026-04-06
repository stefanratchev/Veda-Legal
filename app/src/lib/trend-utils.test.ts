import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {},
}));

import {
  generateLast12Months,
  formatMonthLabel,
  calculateUtilization,
} from "./trend-utils";

describe("generateLast12Months", () => {
  it("returns 12 months ending at the current month", () => {
    const result = generateLast12Months(new Date(2026, 3, 6)); // April 2026
    expect(result).toHaveLength(12);
    expect(result[0]).toBe("2025-05-01");
    expect(result[11]).toBe("2026-04-01");
  });

  it("handles year boundary correctly", () => {
    const result = generateLast12Months(new Date(2026, 0, 15)); // January 2026
    expect(result).toHaveLength(12);
    expect(result[0]).toBe("2025-02-01");
    expect(result[11]).toBe("2026-01-01");
  });

  it("returns consecutive months without gaps", () => {
    const result = generateLast12Months(new Date(2026, 3, 6));
    for (let i = 1; i < result.length; i++) {
      const prev = new Date(result[i - 1] + "T12:00:00Z");
      const curr = new Date(result[i] + "T12:00:00Z");
      // Each month should be exactly 1 month after the previous
      const expectedMonth = prev.getUTCMonth() + 1;
      const expectedYear =
        expectedMonth > 11
          ? prev.getUTCFullYear() + 1
          : prev.getUTCFullYear();
      expect(curr.getUTCFullYear()).toBe(expectedYear);
      expect(curr.getUTCMonth()).toBe(expectedMonth % 12);
    }
  });
});

describe("formatMonthLabel", () => {
  it("formats May 2025 correctly", () => {
    expect(formatMonthLabel("2025-05-01")).toBe("May '25");
  });

  it("formats January 2026 correctly", () => {
    expect(formatMonthLabel("2026-01-01")).toBe("Jan '26");
  });

  it("formats December correctly", () => {
    expect(formatMonthLabel("2025-12-01")).toBe("Dec '25");
  });
});

describe("calculateUtilization", () => {
  it("returns correct percentage for normal values", () => {
    expect(calculateUtilization(80, 100)).toBe(80);
  });

  it("returns 0 when total hours is 0 (avoids NaN)", () => {
    expect(calculateUtilization(0, 0)).toBe(0);
  });

  it("returns correct percentage for fractional values", () => {
    expect(calculateUtilization(50, 200)).toBe(25);
  });

  it("rounds to nearest integer", () => {
    expect(calculateUtilization(1, 3)).toBe(33);
  });

  it("returns 100 when all hours are regular", () => {
    expect(calculateUtilization(100, 100)).toBe(100);
  });
});
