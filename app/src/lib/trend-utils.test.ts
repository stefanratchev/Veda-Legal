import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {},
}));

import {
  generateLast12Months,
  formatMonthLabel,
  calculateUtilization,
  accumulateBilledHoursForSd,
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

describe("accumulateBilledHoursForSd", () => {
  it("counts HOURLY line item hours and computes standardValue using topic.hourlyRate", () => {
    const result = accumulateBilledHoursForSd(
      [
        {
          pricingMode: "HOURLY",
          hourlyRate: 200,
          lineItems: [
            { timeEntryId: "te1", originalHours: 2, hours: 2 },
            { timeEntryId: "te2", originalHours: 3, hours: 3 },
          ],
        },
      ],
      150 // client.hourlyRate (unused for HOURLY topics)
    );
    expect(result.billedHours).toBe(5);
    expect(result.standardValue).toBe(5 * 200);
  });

  it("counts FIXED line item hours and computes standardValue using client.hourlyRate", () => {
    const result = accumulateBilledHoursForSd(
      [
        {
          pricingMode: "FIXED",
          hourlyRate: null, // FIXED topics don't carry an hourly rate
          lineItems: [{ timeEntryId: "te1", originalHours: 4, hours: 4 }],
        },
      ],
      150 // client.hourlyRate
    );
    expect(result.billedHours).toBe(4);
    expect(result.standardValue).toBe(4 * 150);
  });

  it("counts billedHours for FIXED topics even when client.hourlyRate is missing (no standardValue contribution)", () => {
    const result = accumulateBilledHoursForSd(
      [
        {
          pricingMode: "FIXED",
          hourlyRate: null,
          lineItems: [{ timeEntryId: "te1", originalHours: 2, hours: 2 }],
        },
      ],
      null // no client rate
    );
    expect(result.billedHours).toBe(2); // hours still counted
    expect(result.standardValue).toBe(0); // no rate -> no standard value
  });

  it("skips line items with hours <= 0", () => {
    const result = accumulateBilledHoursForSd(
      [
        {
          pricingMode: "HOURLY",
          hourlyRate: 200,
          lineItems: [
            { timeEntryId: "te1", originalHours: 0, hours: 0 },
            { timeEntryId: "te2", originalHours: -1, hours: -1 },
            { timeEntryId: "te3", originalHours: 1, hours: 1 },
          ],
        },
      ],
      150
    );
    expect(result.billedHours).toBe(1);
    expect(result.standardValue).toBe(200);
  });

  it("prefers originalHours over hours when both are present (TE-linked items)", () => {
    const result = accumulateBilledHoursForSd(
      [
        {
          pricingMode: "HOURLY",
          hourlyRate: 100,
          lineItems: [
            // TE was 5h, billed at 3h after edit — originalHours wins
            { timeEntryId: "te1", originalHours: 5, hours: 3 },
          ],
        },
      ],
      150
    );
    expect(result.billedHours).toBe(5);
    expect(result.standardValue).toBe(500);
  });

  it("falls back to hours when timeEntryId is null (manual line items)", () => {
    const result = accumulateBilledHoursForSd(
      [
        {
          pricingMode: "HOURLY",
          hourlyRate: 100,
          lineItems: [
            { timeEntryId: null, originalHours: undefined, hours: 2.5 },
          ],
        },
      ],
      150
    );
    expect(result.billedHours).toBe(2.5);
    expect(result.standardValue).toBe(250);
  });

  it("aggregates across multiple topics", () => {
    const result = accumulateBilledHoursForSd(
      [
        {
          pricingMode: "HOURLY",
          hourlyRate: 200,
          lineItems: [{ timeEntryId: "te1", originalHours: 2, hours: 2 }],
        },
        {
          pricingMode: "FIXED",
          hourlyRate: null,
          lineItems: [{ timeEntryId: "te2", originalHours: 3, hours: 3 }],
        },
      ],
      150
    );
    expect(result.billedHours).toBe(5);
    expect(result.standardValue).toBe(2 * 200 + 3 * 150);
  });
});
