import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatPeriod,
  generateReference,
  calculateTopicTotal,
  calculateTopicHours,
} from "./billing-pdf";
import { ServiceDescription } from "@/types";

describe("billing-pdf utilities", () => {
  describe("formatCurrency", () => {
    it("formats whole numbers with two decimal places", () => {
      expect(formatCurrency(100)).toBe("€ 100.00");
    });

    it("formats decimals correctly", () => {
      expect(formatCurrency(1234.56)).toBe("€ 1,234.56");
    });

    it("formats zero", () => {
      expect(formatCurrency(0)).toBe("€ 0.00");
    });

    it("formats large numbers with thousand separators", () => {
      expect(formatCurrency(56607)).toBe("€ 56,607.00");
    });

    it("rounds to two decimal places", () => {
      expect(formatCurrency(100.999)).toBe("€ 101.00");
    });

    it("handles negative numbers", () => {
      expect(formatCurrency(-50)).toBe("€ -50.00");
    });
  });

  describe("formatDate", () => {
    it("formats a valid date string", () => {
      expect(formatDate("2025-12-18")).toBe("18/12/25");
    });

    it("returns empty string for null", () => {
      expect(formatDate(null)).toBe("");
    });

    it("formats date at start of year", () => {
      expect(formatDate("2026-01-01")).toBe("01/01/26");
    });

    it("formats date at end of year", () => {
      expect(formatDate("2025-12-31")).toBe("31/12/25");
    });
  });

  describe("formatPeriod", () => {
    it("formats period as month and year", () => {
      expect(formatPeriod("2026-02-01")).toBe("February 2026");
    });

    it("formats different months correctly", () => {
      expect(formatPeriod("2025-12-01")).toBe("December 2025");
      expect(formatPeriod("2026-01-15")).toBe("January 2026");
    });
  });

  describe("generateReference", () => {
    it("generates reference from service description", () => {
      const data = {
        id: "abc123def456",
        periodStart: "2026-02-01",
      } as ServiceDescription;

      expect(generateReference(data)).toBe("SD-202602-ABC123");
    });

    it("uses first 6 characters of ID", () => {
      const data = {
        id: "xyz789longer",
        periodStart: "2025-12-01",
      } as ServiceDescription;

      expect(generateReference(data)).toBe("SD-202512-XYZ789");
    });

    it("pads single digit months", () => {
      const data = {
        id: "testid123456",
        periodStart: "2026-01-01",
      } as ServiceDescription;

      expect(generateReference(data)).toBe("SD-202601-TESTID");
    });
  });

  describe("calculateTopicTotal", () => {
    it("calculates hourly total correctly", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1",
        topicName: "Test",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: 100,
        fixedFee: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 2, fixedAmount: null, displayOrder: 1 },
          { id: "b", timeEntryId: null, date: "2026-02-02", description: "More work", hours: 3.5, fixedAmount: null, displayOrder: 2 },
        ],
      };

      expect(calculateTopicTotal(topic)).toBe(550); // 5.5 hours * 100
    });

    it("calculates fixed fee correctly", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1",
        topicName: "Test",
        displayOrder: 1,
        pricingMode: "FIXED",
        hourlyRate: null,
        fixedFee: 1500,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 10, fixedAmount: null, displayOrder: 1 },
        ],
      };

      expect(calculateTopicTotal(topic)).toBe(1500);
    });

    it("includes fixed amounts in hourly mode", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1",
        topicName: "Test",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: 100,
        fixedFee: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 2, fixedAmount: null, displayOrder: 1 },
          { id: "b", timeEntryId: null, date: "2026-02-02", description: "Expense", hours: null, fixedAmount: 50, displayOrder: 2 },
        ],
      };

      expect(calculateTopicTotal(topic)).toBe(250); // (2 * 100) + 50
    });

    it("returns zero for empty line items", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1",
        topicName: "Test",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: 100,
        fixedFee: null,
        lineItems: [],
      };

      expect(calculateTopicTotal(topic)).toBe(0);
    });

    it("handles null hourly rate", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1",
        topicName: "Test",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: null,
        fixedFee: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 5, fixedAmount: null, displayOrder: 1 },
        ],
      };

      expect(calculateTopicTotal(topic)).toBe(0);
    });
  });

  describe("calculateTopicHours", () => {
    it("sums all hours in line items", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1",
        topicName: "Test",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: 100,
        fixedFee: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 2, fixedAmount: null, displayOrder: 1 },
          { id: "b", timeEntryId: null, date: "2026-02-02", description: "More work", hours: 3.5, fixedAmount: null, displayOrder: 2 },
        ],
      };

      expect(calculateTopicHours(topic)).toBe(5.5);
    });

    it("handles null hours", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1",
        topicName: "Test",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: 100,
        fixedFee: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 2, fixedAmount: null, displayOrder: 1 },
          { id: "b", timeEntryId: null, date: "2026-02-02", description: "Fixed item", hours: null, fixedAmount: 100, displayOrder: 2 },
        ],
      };

      expect(calculateTopicHours(topic)).toBe(2);
    });

    it("returns zero for empty line items", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1",
        topicName: "Test",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: 100,
        fixedFee: null,
        lineItems: [],
      };

      expect(calculateTopicHours(topic)).toBe(0);
    });
  });
});
