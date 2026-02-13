import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatPeriod,
  generateReference,
  calculateTopicBaseTotal,
  calculateTopicTotal,
  calculateTopicHours,
  calculateGrandTotal,
} from "./billing-pdf";
import { ServiceDescription, WaiveMode } from "@/types";

describe("billing-pdf utilities", () => {
  const makeItem = (
    hours: number,
    waiveMode: WaiveMode | null = null,
  ): ServiceDescription["topics"][0]["lineItems"][0] => ({
    id: Math.random().toString(36).slice(2),
    timeEntryId: null,
    date: "2026-02-01",
    description: "Work",
    hours,
    fixedAmount: null,
    displayOrder: 1,
    waiveMode,
  });

  const makeTopic = (
    overrides: Partial<ServiceDescription["topics"][0]> = {},
  ): ServiceDescription["topics"][0] => ({
    id: "1",
    topicName: "Test",
    displayOrder: 1,
    pricingMode: "HOURLY",
    hourlyRate: 100,
    fixedFee: null,
    capHours: null,
    discountType: null,
    discountValue: null,
    lineItems: [],
    ...overrides,
  });

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
        capHours: null,
        discountType: null,
        discountValue: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 2, fixedAmount: null, displayOrder: 1, waiveMode: null },
          { id: "b", timeEntryId: null, date: "2026-02-02", description: "More work", hours: 3.5, fixedAmount: null, displayOrder: 2, waiveMode: null },
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
        capHours: null,
        discountType: null,
        discountValue: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 10, fixedAmount: null, displayOrder: 1, waiveMode: null },
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
        capHours: null,
        discountType: null,
        discountValue: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 2, fixedAmount: null, displayOrder: 1, waiveMode: null },
          { id: "b", timeEntryId: null, date: "2026-02-02", description: "Expense", hours: null, fixedAmount: 50, displayOrder: 2, waiveMode: null },
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
        capHours: null,
        discountType: null,
        discountValue: null,
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
        capHours: null,
        discountType: null,
        discountValue: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 5, fixedAmount: null, displayOrder: 1, waiveMode: null },
        ],
      };

      expect(calculateTopicTotal(topic)).toBe(0);
    });

    it("caps hours when rawHours exceeds capHours", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1", topicName: "Test", displayOrder: 1,
        pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
        capHours: 20, discountType: null, discountValue: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 30, fixedAmount: null, displayOrder: 1, waiveMode: null },
        ],
      };
      expect(calculateTopicTotal(topic)).toBe(2000);
    });

    it("does not cap when rawHours is below capHours", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1", topicName: "Test", displayOrder: 1,
        pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
        capHours: 50, discountType: null, discountValue: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 10, fixedAmount: null, displayOrder: 1, waiveMode: null },
        ],
      };
      expect(calculateTopicTotal(topic)).toBe(1000);
    });

    it("applies percentage discount to hourly topic", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1", topicName: "Test", displayOrder: 1,
        pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
        capHours: null, discountType: "PERCENTAGE", discountValue: 10,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 10, fixedAmount: null, displayOrder: 1, waiveMode: null },
        ],
      };
      expect(calculateTopicTotal(topic)).toBe(900);
    });

    it("applies amount discount to hourly topic", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1", topicName: "Test", displayOrder: 1,
        pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
        capHours: null, discountType: "AMOUNT", discountValue: 250,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 10, fixedAmount: null, displayOrder: 1, waiveMode: null },
        ],
      };
      expect(calculateTopicTotal(topic)).toBe(750);
    });

    it("applies cap AND discount together (cap first, then discount)", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1", topicName: "Test", displayOrder: 1,
        pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
        capHours: 20, discountType: "PERCENTAGE", discountValue: 10,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 30, fixedAmount: null, displayOrder: 1, waiveMode: null },
        ],
      };
      expect(calculateTopicTotal(topic)).toBe(1800);
    });

    it("applies percentage discount to fixed topic", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1", topicName: "Test", displayOrder: 1,
        pricingMode: "FIXED", hourlyRate: null, fixedFee: 5000,
        capHours: null, discountType: "PERCENTAGE", discountValue: 20,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 10, fixedAmount: null, displayOrder: 1, waiveMode: null },
        ],
      };
      expect(calculateTopicTotal(topic)).toBe(4000);
    });

    it("applies amount discount to fixed topic", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1", topicName: "Test", displayOrder: 1,
        pricingMode: "FIXED", hourlyRate: null, fixedFee: 5000,
        capHours: null, discountType: "AMOUNT", discountValue: 500,
        lineItems: [],
      };
      expect(calculateTopicTotal(topic)).toBe(4500);
    });

    it("floors discount result at zero", () => {
      const topic: ServiceDescription["topics"][0] = {
        id: "1", topicName: "Test", displayOrder: 1,
        pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
        capHours: null, discountType: "AMOUNT", discountValue: 5000,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 2, fixedAmount: null, displayOrder: 1, waiveMode: null },
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
        capHours: null,
        discountType: null,
        discountValue: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 2, fixedAmount: null, displayOrder: 1, waiveMode: null },
          { id: "b", timeEntryId: null, date: "2026-02-02", description: "More work", hours: 3.5, fixedAmount: null, displayOrder: 2, waiveMode: null },
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
        capHours: null,
        discountType: null,
        discountValue: null,
        lineItems: [
          { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 2, fixedAmount: null, displayOrder: 1, waiveMode: null },
          { id: "b", timeEntryId: null, date: "2026-02-02", description: "Fixed item", hours: null, fixedAmount: 100, displayOrder: 2, waiveMode: null },
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
        capHours: null,
        discountType: null,
        discountValue: null,
        lineItems: [],
      };

      expect(calculateTopicHours(topic)).toBe(0);
    });
  });

  describe("calculateGrandTotal", () => {
    it("sums topic totals with no overall discount", () => {
      const topics = [
        makeTopic({ id: "1", lineItems: [{ id: "a", timeEntryId: null, date: null, description: "W", hours: 10, fixedAmount: null, displayOrder: 1, waiveMode: null }] }),
        makeTopic({ id: "2", lineItems: [{ id: "b", timeEntryId: null, date: null, description: "W", hours: 5, fixedAmount: null, displayOrder: 1, waiveMode: null }] }),
      ];
      expect(calculateGrandTotal(topics, null, null)).toBe(1500);
    });

    it("applies overall percentage discount", () => {
      const topics = [
        makeTopic({ lineItems: [{ id: "a", timeEntryId: null, date: null, description: "W", hours: 10, fixedAmount: null, displayOrder: 1, waiveMode: null }] }),
      ];
      expect(calculateGrandTotal(topics, "PERCENTAGE", 10)).toBe(900);
    });

    it("applies overall amount discount", () => {
      const topics = [
        makeTopic({ lineItems: [{ id: "a", timeEntryId: null, date: null, description: "W", hours: 10, fixedAmount: null, displayOrder: 1, waiveMode: null }] }),
      ];
      expect(calculateGrandTotal(topics, "AMOUNT", 300)).toBe(700);
    });

    it("stacks topic discount and overall discount sequentially", () => {
      const topics = [
        makeTopic({
          discountType: "PERCENTAGE", discountValue: 10,
          lineItems: [{ id: "a", timeEntryId: null, date: null, description: "W", hours: 10, fixedAmount: null, displayOrder: 1, waiveMode: null }],
        }),
      ];
      expect(calculateGrandTotal(topics, "PERCENTAGE", 5)).toBe(855);
    });

    it("floors overall discount at zero", () => {
      const topics = [
        makeTopic({ lineItems: [{ id: "a", timeEntryId: null, date: null, description: "W", hours: 1, fixedAmount: null, displayOrder: 1, waiveMode: null }] }),
      ];
      expect(calculateGrandTotal(topics, "AMOUNT", 5000)).toBe(0);
    });
  });

  describe("calculateTopicBaseTotal with waived items", () => {
    it("excludes EXCLUDED items from hourly total", () => {
      const topic = makeTopic({
        lineItems: [
          makeItem(2, null),
          makeItem(3, "EXCLUDED"),
          makeItem(1, null),
        ],
      });
      expect(calculateTopicBaseTotal(topic)).toBe(300);
    });

    it("treats ZERO items as 0 hours in total", () => {
      const topic = makeTopic({
        lineItems: [
          makeItem(2, null),
          makeItem(3, "ZERO"),
        ],
      });
      expect(calculateTopicBaseTotal(topic)).toBe(200);
    });

    it("handles all items waived", () => {
      const topic = makeTopic({
        lineItems: [
          makeItem(2, "EXCLUDED"),
          makeItem(3, "ZERO"),
        ],
      });
      expect(calculateTopicBaseTotal(topic)).toBe(0);
    });

    it("does not affect FIXED pricing mode", () => {
      const topic = makeTopic({
        pricingMode: "FIXED",
        fixedFee: 500,
        lineItems: [
          makeItem(2, "EXCLUDED"),
          makeItem(3, null),
        ],
      });
      expect(calculateTopicBaseTotal(topic)).toBe(500);
    });

    it("applies capHours only to non-waived hours", () => {
      const topic = makeTopic({
        capHours: 5,
        lineItems: [
          makeItem(3, null),
          makeItem(4, "EXCLUDED"),
          makeItem(2, null),
        ],
      });
      expect(calculateTopicBaseTotal(topic)).toBe(500);
    });

    it("excludes EXCLUDED fixedAmount items", () => {
      const topic = makeTopic({
        lineItems: [
          { ...makeItem(0), fixedAmount: 50, waiveMode: null },
          { ...makeItem(0), fixedAmount: 100, waiveMode: "EXCLUDED" },
        ],
      });
      expect(calculateTopicBaseTotal(topic)).toBe(50);
    });
  });

  describe("calculateTopicHours with waived items", () => {
    it("excludes EXCLUDED items from hours count", () => {
      const topic = makeTopic({
        lineItems: [
          makeItem(2, null),
          makeItem(3, "EXCLUDED"),
          makeItem(1, "ZERO"),
        ],
      });
      expect(calculateTopicHours(topic)).toBe(2);
    });
  });

  describe("calculateTopicTotal with waived items and discounts", () => {
    it("applies discount only to non-waived total", () => {
      const topic = makeTopic({
        discountType: "PERCENTAGE",
        discountValue: 10,
        lineItems: [
          makeItem(10, null),
          makeItem(5, "EXCLUDED"),
        ],
      });
      expect(calculateTopicTotal(topic)).toBe(900);
    });
  });
});
