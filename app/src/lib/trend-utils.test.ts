import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {},
}));

import {
  generateLast12Months,
  formatMonthLabel,
  calculateUtilization,
  buildSdLineItems,
  pickFallbackDate,
  pickDominantMonth,
  splitRetainerGrandTotal,
  allocateSdToBuckets,
  buildByClientForMonth,
  type LineItemForAllocation,
} from "./trend-utils";
import type { ServiceDescription } from "@/types";

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
      const expectedMonth = prev.getUTCMonth() + 1;
      const expectedYear =
        expectedMonth > 11
          ? prev.getUTCFullYear() + 1
          : prev.getUTCFullYear();
      expect(curr.getUTCFullYear()).toBe(expectedYear);
      expect(curr.getUTCMonth()).toBe(expectedMonth % 12);
    }
  });

  it("truncates to the floor month when provided", () => {
    // now = April 2026, floor = 2026-02-01 → Feb, Mar, Apr
    const result = generateLast12Months(new Date(2026, 3, 6), "2026-02-01");
    expect(result).toEqual(["2026-02-01", "2026-03-01", "2026-04-01"]);
  });

  it("ignores a floor older than the 12-month window", () => {
    // now = April 2026, floor way in the past → full 12 months
    const result = generateLast12Months(new Date(2026, 3, 6), "2020-01-01");
    expect(result).toHaveLength(12);
    expect(result[0]).toBe("2025-05-01");
  });

  it("floor day granularity still includes the floor month", () => {
    // Floor = 2026-02-15 should still include February.
    const result = generateLast12Months(new Date(2026, 3, 6), "2026-02-15");
    expect(result[0]).toBe("2026-02-01");
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

describe("buildSdLineItems", () => {
  it("extracts HOURLY line items using topic.hourlyRate", () => {
    const items = buildSdLineItems({
      topics: [
        {
          pricingMode: "HOURLY",
          hourlyRate: 200,
          lineItems: [
            {
              timeEntryId: "te1",
              originalHours: 3,
              hours: 3,
              date: "2026-03-10",
              waiveMode: null,
              employeeName: "Alice",
            },
          ],
        },
      ],
      client: { hourlyRate: 150 },
    });
    expect(items).toHaveLength(1);
    expect(items[0].hours).toBe(3);
    expect(items[0].standardValue).toBe(600);
    expect(items[0].isWaived).toBe(false);
    expect(items[0].employeeName).toBe("Alice");
  });

  it("extracts FIXED line items using client.hourlyRate", () => {
    const items = buildSdLineItems({
      topics: [
        {
          pricingMode: "FIXED",
          hourlyRate: null,
          lineItems: [
            {
              timeEntryId: "te1",
              originalHours: 4,
              hours: 4,
              date: "2026-03-10",
              waiveMode: null,
            },
          ],
        },
      ],
      client: { hourlyRate: 150 },
    });
    expect(items[0].standardValue).toBe(600);
  });

  it("prefers originalHours over hours for TE-linked items", () => {
    const items = buildSdLineItems({
      topics: [
        {
          pricingMode: "HOURLY",
          hourlyRate: 100,
          lineItems: [
            {
              timeEntryId: "te1",
              originalHours: 5,
              hours: 3,
              date: null,
              waiveMode: null,
            },
          ],
        },
      ],
      client: { hourlyRate: 150 },
    });
    expect(items[0].hours).toBe(5);
    expect(items[0].standardValue).toBe(500);
  });

  it("falls back to hours for manual line items (no timeEntryId)", () => {
    const items = buildSdLineItems({
      topics: [
        {
          pricingMode: "HOURLY",
          hourlyRate: 100,
          lineItems: [
            {
              timeEntryId: null,
              hours: 2.5,
              date: null,
              waiveMode: null,
            },
          ],
        },
      ],
      client: { hourlyRate: 150 },
    });
    expect(items[0].hours).toBe(2.5);
    expect(items[0].standardValue).toBe(250);
  });

  it("skips items with zero or negative hours", () => {
    const items = buildSdLineItems({
      topics: [
        {
          pricingMode: "HOURLY",
          hourlyRate: 100,
          lineItems: [
            { timeEntryId: "te1", originalHours: 0, hours: 0, date: null, waiveMode: null },
            { timeEntryId: "te2", originalHours: -1, hours: -1, date: null, waiveMode: null },
            { timeEntryId: "te3", originalHours: 1, hours: 1, date: null, waiveMode: null },
          ],
        },
      ],
      client: { hourlyRate: 150 },
    });
    expect(items).toHaveLength(1);
    expect(items[0].hours).toBe(1);
  });

  it("flags waived items via EXCLUDED and ZERO waiveModes", () => {
    const items = buildSdLineItems({
      topics: [
        {
          pricingMode: "HOURLY",
          hourlyRate: 100,
          lineItems: [
            { timeEntryId: "te1", originalHours: 1, hours: 1, date: null, waiveMode: "EXCLUDED" },
            { timeEntryId: "te2", originalHours: 1, hours: 1, date: null, waiveMode: "ZERO" },
            { timeEntryId: "te3", originalHours: 1, hours: 1, date: null, waiveMode: null },
          ],
        },
      ],
      client: { hourlyRate: 150 },
    });
    expect(items[0].isWaived).toBe(true);
    expect(items[1].isWaived).toBe(true);
    expect(items[2].isWaived).toBe(false);
  });
});

describe("pickFallbackDate", () => {
  const mk = (hours: number, date: string | null, isWaived = false): LineItemForAllocation => ({
    date,
    hours,
    standardValue: hours * 100,
    isWaived,
    employeeId: null,
    employeeName: null,
  });

  it("returns the date of the largest non-waived item with a date", () => {
    const items = [mk(2, "2026-03-05"), mk(5, "2026-04-10"), mk(3, "2026-02-20")];
    expect(pickFallbackDate(items, "2026-05-31")).toBe("2026-04-10");
  });

  it("ignores waived items even if they are larger", () => {
    const items = [mk(10, "2026-03-05", true), mk(2, "2026-04-10")];
    expect(pickFallbackDate(items, "2026-05-31")).toBe("2026-04-10");
  });

  it("falls back to periodEnd when no non-waived dated items exist", () => {
    const items = [mk(5, null), mk(3, "2026-03-05", true)];
    expect(pickFallbackDate(items, "2026-05-31")).toBe("2026-05-31");
  });
});

describe("pickDominantMonth", () => {
  const mk = (hours: number, bucketMonth: string, isWaived = false) => ({
    date: null,
    hours,
    standardValue: hours * 100,
    isWaived,
    employeeId: null,
    employeeName: null,
    bucketMonth,
  });

  it("returns the month with the most non-waived hours", () => {
    const items = [mk(10, "2026-03-01"), mk(100, "2026-04-01"), mk(5, "2026-05-01")];
    expect(pickDominantMonth(items, "2026-05-31")).toBe("2026-04-01");
  });

  it("breaks ties by the latest month", () => {
    const items = [mk(50, "2026-03-01"), mk(50, "2026-04-01")];
    expect(pickDominantMonth(items, "2026-05-31")).toBe("2026-04-01");
  });

  it("falls back to periodEnd bucket when no non-waived items", () => {
    const items = [mk(10, "2026-03-01", true)];
    expect(pickDominantMonth(items, "2026-05-31")).toBe("2026-05-01");
  });
});

describe("splitRetainerGrandTotal", () => {
  const baseTopics: ServiceDescription["topics"] = [];

  it("splits proportionally under a PERCENTAGE discount", () => {
    // retainerFee 1000, no overage, no fixed → preDiscount = 1000
    // 10% discount → grandTotal = 900
    // retainerPortion / grandTotal = 1000/1000 * 900 = 900
    const { retainerPortion, nonRetainerGrandTotal } = splitRetainerGrandTotal(
      {
        topics: baseTopics,
        retainerFee: 1000,
        retainerHours: 10,
        retainerOverageRate: 100,
        discountType: "PERCENTAGE",
        discountValue: 10,
      },
      900,
    );
    expect(retainerPortion).toBeCloseTo(900, 2);
    expect(nonRetainerGrandTotal).toBeCloseTo(0, 2);
  });

  it("splits proportionally under an AMOUNT discount", () => {
    // retainerFee 1000, preDiscount = 1000, AMOUNT discount 100 → grandTotal = 900
    // discountFactor = 900/1000 = 0.9; retainerPortion = 1000 * 0.9 = 900
    const { retainerPortion, nonRetainerGrandTotal } = splitRetainerGrandTotal(
      {
        topics: baseTopics,
        retainerFee: 1000,
        retainerHours: 10,
        retainerOverageRate: 100,
        discountType: "AMOUNT",
        discountValue: 100,
      },
      900,
    );
    expect(retainerPortion).toBeCloseTo(900, 2);
    expect(nonRetainerGrandTotal).toBeCloseTo(0, 2);
  });
});

describe("allocateSdToBuckets", () => {
  // Small helper to build a minimal SD for testing. Only fills fields the
  // allocator touches; other ServiceDescription fields are narrowed via cast.
  function buildSd(overrides: Partial<ServiceDescription> & {
    topics: ServiceDescription["topics"];
  }): ServiceDescription {
    return {
      id: "sd1",
      clientId: "c1",
      client: {
        id: "c1",
        name: "Acme",
        invoicedName: null,
        invoiceAttn: null,
        hourlyRate: 200,
        notes: null,
        retainerFee: null,
        retainerHours: null,
      },
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      status: "FINALIZED",
      finalizedAt: "2026-04-05T10:00:00Z",
      discountType: null,
      discountValue: null,
      retainerFee: null,
      retainerHours: null,
      retainerOverageRate: null,
      createdAt: "2026-03-01T00:00:00Z",
      updatedAt: "2026-04-05T10:00:00Z",
      ...overrides,
    };
  }

  it("distributes non-retainer SD revenue per line-item date (pro-rata by standard value)", () => {
    // SD with 2 items, both HOURLY at €100/h:
    //   - 6h on 2026-02-20 (March belongs to Feb) → standardValue €600
    //   - 2h on 2026-03-15                         → standardValue €200
    // grandTotal (no discounts) = 6*100 + 2*100 = €800
    // Pro-rata: Feb gets 600/800 * 800 = €600, March gets €200.
    const sd = buildSd({
      topics: [
        {
          id: "t1",
          topicName: "Advisory",
          displayOrder: 0,
          pricingMode: "HOURLY",
          hourlyRate: 100,
          fixedFee: null,
          capHours: null,
          discountType: null,
          discountValue: null,
          lineItems: [
            {
              id: "li1",
              timeEntryId: "te1",
              date: "2026-02-20",
              description: "Feb work",
              hours: 6,
              originalHours: 6,
              displayOrder: 0,
              waiveMode: null,
              employeeId: "u-alice",
              employeeName: "Alice",
            },
            {
              id: "li2",
              timeEntryId: "te2",
              date: "2026-03-15",
              description: "March work",
              hours: 2,
              originalHours: 2,
              displayOrder: 1,
              waiveMode: null,
              employeeId: "u-bob",
              employeeName: "Bob",
            },
          ],
        },
      ],
    });

    const {
      byMonth,
      empBilledByMonth,
      empBilledHoursByMonth,
      clientBilledByMonth,
      clientBilledHoursByMonth,
      clientStandardByMonth,
      clientNames,
    } = allocateSdToBuckets(sd, "2026-03-31");

    expect(byMonth.get("2026-02-01")?.billedRevenue).toBeCloseTo(600, 2);
    expect(byMonth.get("2026-03-01")?.billedRevenue).toBeCloseTo(200, 2);
    expect(byMonth.get("2026-02-01")?.billedHours).toBe(6);
    expect(byMonth.get("2026-03-01")?.billedHours).toBe(2);
    expect(empBilledByMonth.get("2026-02-01:u-alice")).toBeCloseTo(600, 2);
    expect(empBilledByMonth.get("2026-03-01:u-bob")).toBeCloseTo(200, 2);
    expect(empBilledHoursByMonth.get("2026-02-01:u-alice")).toBe(6);
    expect(empBilledHoursByMonth.get("2026-03-01:u-bob")).toBe(2);

    // Per-client assertions (clientId "c1" from buildSd defaults)
    expect(clientBilledByMonth.get("2026-02-01:c1")).toBeCloseTo(600, 2);
    expect(clientBilledByMonth.get("2026-03-01:c1")).toBeCloseTo(200, 2);
    expect(clientBilledHoursByMonth.get("2026-02-01:c1")).toBe(6);
    expect(clientBilledHoursByMonth.get("2026-03-01:c1")).toBe(2);
    expect(clientStandardByMonth.get("2026-02-01:c1")).toBe(600);
    expect(clientStandardByMonth.get("2026-03-01:c1")).toBe(200);
    expect(clientNames.get("c1")).toBe("Acme");
  });

  it("places the retainer portion in the dominant month; rest pro-rata per item date", () => {
    // Retainer SD: retainerFee €5000, 20h allowance, overage rate €150
    // Items: 10h on 2026-02-15 (Feb), 15h on 2026-03-20 (March)
    // All HOURLY at €200/h (client rate) but topic uses its own rate €200
    // Total hourly = 25h; 5h overage at €150 = €750
    // grandTotal (no SD discount) = 5000 + 750 = €5750
    // splitRetainer: preDiscount = 5750; factor = 1; retainerPortion = 5000; nonRetainer = 750
    // Dominant month = March (15h > 10h)
    // Non-waived standard total = 10*200 + 15*200 = 5000
    // Per-item rev share of nonRetainer 750:
    //   Feb: (2000/5000) * 750 = 300
    //   March: (3000/5000) * 750 = 450
    // Retainer 5000 → March
    // Firm: Feb billedRevenue = 300, March billedRevenue = 450 + 5000 = 5450
    const sd = buildSd({
      retainerFee: 5000,
      retainerHours: 20,
      retainerOverageRate: 150,
      topics: [
        {
          id: "t1",
          topicName: "Advisory",
          displayOrder: 0,
          pricingMode: "HOURLY",
          hourlyRate: 200,
          fixedFee: null,
          capHours: null,
          discountType: null,
          discountValue: null,
          lineItems: [
            {
              id: "li1",
              timeEntryId: "te1",
              date: "2026-02-15",
              description: "Feb",
              hours: 10,
              originalHours: 10,
              displayOrder: 0,
              waiveMode: null,
              employeeId: "u-alice",
              employeeName: "Alice",
            },
            {
              id: "li2",
              timeEntryId: "te2",
              date: "2026-03-20",
              description: "Mar",
              hours: 15,
              originalHours: 15,
              displayOrder: 1,
              waiveMode: null,
              employeeId: "u-bob",
              employeeName: "Bob",
            },
          ],
        },
      ],
    });

    const {
      byMonth,
      clientBilledByMonth,
      clientBilledHoursByMonth,
      clientStandardByMonth,
      empBilledByMonth,
      empBilledHoursByMonth,
    } = allocateSdToBuckets(sd, "2026-03-31");

    expect(byMonth.get("2026-02-01")?.billedRevenue).toBeCloseTo(300, 2);
    expect(byMonth.get("2026-03-01")?.billedRevenue).toBeCloseTo(5450, 2);
    // Both months have hours = billed hours (non-waived)
    expect(byMonth.get("2026-02-01")?.billedHours).toBe(10);
    expect(byMonth.get("2026-03-01")?.billedHours).toBe(15);

    // Per-client retainer allocation mirrors firm-level (one client per SD)
    expect(clientBilledByMonth.get("2026-02-01:c1")).toBeCloseTo(300, 2);
    expect(clientBilledByMonth.get("2026-03-01:c1")).toBeCloseTo(5450, 2);
    expect(clientBilledHoursByMonth.get("2026-02-01:c1")).toBe(10);
    expect(clientBilledHoursByMonth.get("2026-03-01:c1")).toBe(15);
    expect(clientStandardByMonth.get("2026-02-01:c1")).toBe(2000);
    expect(clientStandardByMonth.get("2026-03-01:c1")).toBe(3000);

    // Per-employee: the retainer fee (€5000) splits by non-waived standard
    // share and lands entirely in the dominant month (March). The non-retainer
    // €750 stays per-item.
    //   Alice: 300 (Feb non-retainer) + 2000 (March retainer, 2000/5000 * 5000)
    //   Bob:   450 (March non-retainer) + 3000 (March retainer, 3000/5000 * 5000)
    expect(empBilledByMonth.get("2026-02-01:u-alice")).toBeCloseTo(300, 2);
    expect(empBilledByMonth.get("2026-03-01:u-alice")).toBeCloseTo(2000, 2);
    expect(empBilledByMonth.get("2026-03-01:u-bob")).toBeCloseTo(450 + 3000, 2);
    // Retainer loop does not write hours — only the non-retainer per-item loop does.
    expect(empBilledHoursByMonth.get("2026-02-01:u-alice")).toBe(10);
    expect(empBilledHoursByMonth.get("2026-03-01:u-bob")).toBe(15);
    // Alice has no March hours because her only item was in Feb.
    expect(empBilledHoursByMonth.get("2026-03-01:u-alice")).toBeUndefined();

    // Reconciliation: per-employee sum equals firm-level total.
    const empTotal =
      (empBilledByMonth.get("2026-02-01:u-alice") ?? 0) +
      (empBilledByMonth.get("2026-03-01:u-alice") ?? 0) +
      (empBilledByMonth.get("2026-03-01:u-bob") ?? 0);
    expect(empTotal).toBeCloseTo(5750, 2);
  });

  it("waived items contribute to standardRateValue only (not billedHours or billedRevenue share)", () => {
    // Two items in March, one waived
    //   - 4h on 2026-03-10 non-waived → standardValue €400
    //   - 2h on 2026-03-20 EXCLUDED   → standardValue €200
    // grandTotal = calculateGrandTotal([...]) — waived items drop out → €400
    // Non-waived total = €400. Each non-waived item gets its full share.
    // billedHours only counts the non-waived 4h.
    // standardRateValue includes both = €600 (lost revenue = €200).
    const sd = buildSd({
      topics: [
        {
          id: "t1",
          topicName: "Advisory",
          displayOrder: 0,
          pricingMode: "HOURLY",
          hourlyRate: 100,
          fixedFee: null,
          capHours: null,
          discountType: null,
          discountValue: null,
          lineItems: [
            {
              id: "li1",
              timeEntryId: "te1",
              date: "2026-03-10",
              description: "kept",
              hours: 4,
              originalHours: 4,
              displayOrder: 0,
              waiveMode: null,
            },
            {
              id: "li2",
              timeEntryId: "te2",
              date: "2026-03-20",
              description: "waived",
              hours: 2,
              originalHours: 2,
              displayOrder: 1,
              waiveMode: "EXCLUDED",
            },
          ],
        },
      ],
    });

    const { byMonth, clientBilledByMonth, clientBilledHoursByMonth, clientStandardByMonth } =
      allocateSdToBuckets(sd, "2026-03-31");
    const march = byMonth.get("2026-03-01")!;
    expect(march.billedHours).toBe(4); // waived 2h excluded
    expect(march.standardRateValue).toBe(600); // 400 + 200 (waived still counted)
    expect(march.billedRevenue).toBeCloseTo(400, 2); // waived contributes 0

    // Per-client: waived items contribute to standard but not to billed maps
    expect(clientBilledByMonth.get("2026-03-01:c1")).toBeCloseTo(400, 2);
    expect(clientBilledHoursByMonth.get("2026-03-01:c1")).toBe(4);
    expect(clientStandardByMonth.get("2026-03-01:c1")).toBe(600);
  });

  it("manual line items without a date use the fallback (largest non-waived dated item)", () => {
    // One dated item (5h, 2026-02-10), one undated manual item (1h)
    // Fallback date = 2026-02-10 (largest non-waived dated)
    // So the undated item is bucketed into Feb.
    const sd = buildSd({
      topics: [
        {
          id: "t1",
          topicName: "Advisory",
          displayOrder: 0,
          pricingMode: "HOURLY",
          hourlyRate: 100,
          fixedFee: null,
          capHours: null,
          discountType: null,
          discountValue: null,
          lineItems: [
            {
              id: "li1",
              timeEntryId: "te1",
              date: "2026-02-10",
              description: "dated",
              hours: 5,
              originalHours: 5,
              displayOrder: 0,
              waiveMode: null,
            },
            {
              id: "li2",
              timeEntryId: null,
              date: null,
              description: "manual undated",
              hours: 1,
              displayOrder: 1,
              waiveMode: null,
            },
          ],
        },
      ],
    });

    const { byMonth } = allocateSdToBuckets(sd, "2026-03-31");
    // Both items should land in Feb
    expect(byMonth.has("2026-02-01")).toBe(true);
    expect(byMonth.has("2026-03-01")).toBe(false);
    expect(byMonth.get("2026-02-01")?.billedHours).toBe(6);
  });

  it("reconciles fully-waived SD with surviving FIXED fee across firm/client/employee maps", () => {
    // FIXED topic €500 fee whose only line items are all EXCLUDED. The non-
    // retainer grand total still includes the fee (€500). All underlying
    // items are waived, so billedHours must stay 0, but the €500 must flow
    // through per-employee and per-client maps so firm-level and per-entity
    // totals reconcile.
    const sd = buildSd({
      topics: [
        {
          id: "t1",
          topicName: "Flat-fee advisory",
          displayOrder: 0,
          pricingMode: "FIXED",
          hourlyRate: null,
          fixedFee: 500,
          capHours: null,
          discountType: null,
          discountValue: null,
          lineItems: [
            {
              id: "li1",
              timeEntryId: "te1",
              date: "2026-02-10",
              description: "waived Feb",
              hours: 4,
              originalHours: 4,
              displayOrder: 0,
              waiveMode: "EXCLUDED",
              employeeId: "u-alice",
              employeeName: "Alice",
            },
            {
              id: "li2",
              timeEntryId: "te2",
              date: "2026-03-05",
              description: "waived Mar",
              hours: 2,
              originalHours: 2,
              displayOrder: 1,
              waiveMode: "EXCLUDED",
              employeeId: "u-bob",
              employeeName: "Bob",
            },
          ],
        },
      ],
    });

    const {
      byMonth,
      empBilledByMonth,
      empBilledHoursByMonth,
      clientBilledByMonth,
    } = allocateSdToBuckets(sd, "2026-03-31");

    // Standard values at client.hourlyRate=200: Alice=800, Bob=400, total=1200.
    // Fee €500 distributed pro-rata: Alice=500*800/1200=333.33, Bob=166.67.
    const feeAlice = (500 * 800) / 1200;
    const feeBob = (500 * 400) / 1200;

    // Firm-level: Feb and Mar both see revenue, zero billedHours (all waived).
    expect(byMonth.get("2026-02-01")?.billedRevenue).toBeCloseTo(feeAlice, 2);
    expect(byMonth.get("2026-03-01")?.billedRevenue).toBeCloseTo(feeBob, 2);
    expect(byMonth.get("2026-02-01")?.billedHours).toBe(0);
    expect(byMonth.get("2026-03-01")?.billedHours).toBe(0);

    // Per-employee: each gets their pro-rata share, NO billed hours.
    expect(empBilledByMonth.get("2026-02-01:u-alice")).toBeCloseTo(feeAlice, 2);
    expect(empBilledByMonth.get("2026-03-01:u-bob")).toBeCloseTo(feeBob, 2);
    expect(empBilledHoursByMonth.get("2026-02-01:u-alice")).toBeUndefined();
    expect(empBilledHoursByMonth.get("2026-03-01:u-bob")).toBeUndefined();

    // Per-client: same reconciliation — firm-level total matches sum of client
    // buckets AND sum of employee buckets.
    expect(clientBilledByMonth.get("2026-02-01:c1")).toBeCloseTo(feeAlice, 2);
    expect(clientBilledByMonth.get("2026-03-01:c1")).toBeCloseTo(feeBob, 2);

    const firmTotal =
      (byMonth.get("2026-02-01")?.billedRevenue ?? 0) +
      (byMonth.get("2026-03-01")?.billedRevenue ?? 0);
    const clientTotal =
      (clientBilledByMonth.get("2026-02-01:c1") ?? 0) +
      (clientBilledByMonth.get("2026-03-01:c1") ?? 0);
    const empTotal =
      (empBilledByMonth.get("2026-02-01:u-alice") ?? 0) +
      (empBilledByMonth.get("2026-03-01:u-bob") ?? 0);
    expect(firmTotal).toBeCloseTo(500, 2);
    expect(clientTotal).toBeCloseTo(500, 2);
    expect(empTotal).toBeCloseTo(500, 2);
  });
});

describe("buildByClientForMonth", () => {
  it("includes clients from the TE clientMap with SD allocations merged in", () => {
    const monthStart = "2026-03-01";
    // clientMap = TE-aggregation result for March. Alpha is billable, Beta is not.
    const clientMap = new Map<
      string,
      { id: string; name: string; hours: number; billableHours: number; billableRevenue: number }[]
    >([
      [
        monthStart,
        [
          {
            id: "alpha",
            name: "Alpha Corp",
            hours: 20,
            billableHours: 15,
            billableRevenue: 3000,
          },
        ],
      ],
    ]);
    const clientBilledMap = new Map<string, number>([
      [`${monthStart}:alpha`, 2500],
    ]);
    const clientBilledHoursMap = new Map<string, number>([
      [`${monthStart}:alpha`, 12],
    ]);
    const clientStandardMap = new Map<string, number>([
      [`${monthStart}:alpha`, 3000],
    ]);
    const clientNamesMap = new Map<string, string>([["alpha", "Alpha Corp"]]);

    const result = buildByClientForMonth(
      monthStart,
      clientMap,
      clientBilledMap,
      clientBilledHoursMap,
      clientStandardMap,
      clientNamesMap,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "alpha",
      name: "Alpha Corp",
      hours: 20,
      billableHours: 15,
      billableRevenue: 3000,
      billedRevenue: 2500,
      billedHours: 12,
      standardRateValue: 3000,
    });
  });

  it("sweeps in extra clients that have SD allocations but no time entries in the month", () => {
    // This covers the catch-up-billing case: an SD finalized this month whose
    // line items were dated in an earlier month (or all manual/undated) ends
    // up with client allocations in clientBilledMap that never appear in
    // clientMap (since clientMap is driven by time-entry aggregation).
    const monthStart = "2026-03-01";
    const clientMap = new Map<
      string,
      { id: string; name: string; hours: number; billableHours: number; billableRevenue: number }[]
    >([
      [
        monthStart,
        [
          {
            id: "alpha",
            name: "Alpha Corp",
            hours: 20,
            billableHours: 15,
            billableRevenue: 3000,
          },
        ],
      ],
    ]);
    const clientBilledMap = new Map<string, number>([
      [`${monthStart}:alpha`, 2500],
      [`${monthStart}:ghost`, 1500], // ghost has no TEs this month
    ]);
    const clientBilledHoursMap = new Map<string, number>([
      [`${monthStart}:alpha`, 12],
      [`${monthStart}:ghost`, 8],
    ]);
    const clientStandardMap = new Map<string, number>([
      [`${monthStart}:alpha`, 3000],
      [`${monthStart}:ghost`, 1800],
    ]);
    const clientNamesMap = new Map<string, string>([
      ["alpha", "Alpha Corp"],
      ["ghost", "Ghost Ltd"],
    ]);

    const result = buildByClientForMonth(
      monthStart,
      clientMap,
      clientBilledMap,
      clientBilledHoursMap,
      clientStandardMap,
      clientNamesMap,
    );

    // Both clients appear in the result; ghost is added by the sweep with
    // hours=0/billable=0 (no TE data) but its SD-side values are preserved.
    const ids = result.map((r) => r.id).sort();
    expect(ids).toEqual(["alpha", "ghost"]);

    const ghost = result.find((r) => r.id === "ghost")!;
    expect(ghost).toMatchObject({
      id: "ghost",
      name: "Ghost Ltd",
      hours: 0,
      billableHours: 0,
      billableRevenue: 0,
      billedRevenue: 1500,
      billedHours: 8,
      standardRateValue: 1800,
    });
  });

  it("falls back to 'Unknown' when a swept client id has no name in clientNamesMap", () => {
    const monthStart = "2026-03-01";
    const clientMap = new Map<
      string,
      { id: string; name: string; hours: number; billableHours: number; billableRevenue: number }[]
    >();
    const clientBilledMap = new Map<string, number>([
      [`${monthStart}:orphan`, 100],
    ]);
    const result = buildByClientForMonth(
      monthStart,
      clientMap,
      clientBilledMap,
      new Map(),
      new Map(),
      new Map(), // empty names map
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Unknown");
  });
});
