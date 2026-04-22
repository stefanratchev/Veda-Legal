import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PricingHealthChart, prepareChartData } from "./PricingHealthChart";
import type { MonthlyTrendPoint } from "@/types/reports";

function makePoint(overrides: Partial<MonthlyTrendPoint>): MonthlyTrendPoint {
  return {
    month: "2026-01",
    label: "Jan '26",
    totalHours: 0,
    billableHours: 0,
    revenue: 0,
    activeClients: 0,
    utilization: 0,
    billedRevenue: 0,
    standardRateValue: 0,
    billedHours: 0,
    realization: 0,
    byEmployee: [],
    byClient: [],
    ...overrides,
  };
}

describe("prepareChartData", () => {
  it("computes lostRevenue as standardRateValue - billedRevenue", () => {
    const result = prepareChartData([
      makePoint({ standardRateValue: 1000, billedRevenue: 750 }),
    ]);
    expect(result[0].lostRevenue).toBe(250);
  });

  it("clamps negative lostRevenue to 0 (rounding artefacts)", () => {
    const result = prepareChartData([
      makePoint({ standardRateValue: 100, billedRevenue: 100.01 }),
    ]);
    expect(result[0].lostRevenue).toBe(0);
  });

  it("computes effectiveRate as billedRevenue / billedHours when billedHours > 0", () => {
    const result = prepareChartData([
      makePoint({ billedRevenue: 1000, billedHours: 5 }),
    ]);
    expect(result[0].effectiveRate).toBe(200);
  });

  it("returns null effectiveRate when billedHours is 0 (no gap-bridging)", () => {
    const result = prepareChartData([
      makePoint({ billedRevenue: 0, billedHours: 0 }),
    ]);
    expect(result[0].effectiveRate).toBeNull();
  });

  it("returns null effectiveRate when billedHours is 0 even if billedRevenue > 0 (defensive)", () => {
    const result = prepareChartData([
      makePoint({ billedRevenue: 500, billedHours: 0 }),
    ]);
    expect(result[0].effectiveRate).toBeNull();
  });

  it("preserves all original MonthlyTrendPoint fields on each point", () => {
    const point = makePoint({ label: "Mar '26", billedRevenue: 1000, billedHours: 5 });
    const result = prepareChartData([point]);
    expect(result[0].label).toBe("Mar '26");
    expect(result[0].billedRevenue).toBe(1000);
    expect(result[0].billedHours).toBe(5);
  });
});

// Mock ResizeObserver for Recharts ResponsiveContainer (matches RevenueBarChart.test.tsx pattern)
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

describe("PricingHealthChart component", () => {
  it("renders without crashing with realistic data", () => {
    const data: MonthlyTrendPoint[] = [
      makePoint({ month: "2026-01", label: "Jan '26", billedRevenue: 5000, standardRateValue: 6000, billedHours: 25 }),
      makePoint({ month: "2026-02", label: "Feb '26", billedRevenue: 4000, standardRateValue: 5500, billedHours: 22 }),
    ];
    const { container } = render(<PricingHealthChart data={data} />);
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("renders without crashing when all months have zero data (empty state)", () => {
    const data: MonthlyTrendPoint[] = Array.from({ length: 12 }, (_, i) =>
      makePoint({ month: `2026-${String(i + 1).padStart(2, "0")}`, label: `M${i}` })
    );
    const { container } = render(<PricingHealthChart data={data} />);
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("renders without crashing when some months have zero billedHours (line gaps)", () => {
    const data: MonthlyTrendPoint[] = [
      makePoint({ month: "2026-01", label: "Jan '26", billedRevenue: 5000, billedHours: 25 }),
      makePoint({ month: "2026-02", label: "Feb '26", billedRevenue: 0, billedHours: 0 }),
      makePoint({ month: "2026-03", label: "Mar '26", billedRevenue: 4000, billedHours: 22 }),
    ];
    const { container } = render(<PricingHealthChart data={data} />);
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
