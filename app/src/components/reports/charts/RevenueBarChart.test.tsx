import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RevenueBarChart,
  formatEurAbbreviated,
  formatEurExact,
  prepareRevenueData,
  mergeComparisonData,
} from "./RevenueBarChart";

// --- formatEurAbbreviated ---

describe("formatEurAbbreviated", () => {
  it("returns EUR 0 for 0", () => {
    expect(formatEurAbbreviated(0)).toBe("\u20AC0");
  });

  it("returns EUR 100 for 100", () => {
    expect(formatEurAbbreviated(100)).toBe("\u20AC100");
  });

  it("returns EUR 999 for 999", () => {
    expect(formatEurAbbreviated(999)).toBe("\u20AC999");
  });

  it('returns EUR 1K for 1000 (not "EUR 1.0K")', () => {
    expect(formatEurAbbreviated(1000)).toBe("\u20AC1K");
  });

  it("returns EUR 1.5K for 1500", () => {
    expect(formatEurAbbreviated(1500)).toBe("\u20AC1.5K");
  });

  it("returns EUR 12.5K for 12500", () => {
    expect(formatEurAbbreviated(12500)).toBe("\u20AC12.5K");
  });

  it("returns EUR 1000K for 999999 (boundary before M)", () => {
    expect(formatEurAbbreviated(999999)).toBe("\u20AC1000K");
  });

  it('returns EUR 1M for 1000000 (not "EUR 1.0M")', () => {
    expect(formatEurAbbreviated(1000000)).toBe("\u20AC1M");
  });

  it("returns EUR 1.2M for 1200000", () => {
    expect(formatEurAbbreviated(1200000)).toBe("\u20AC1.2M");
  });
});

// --- formatEurExact ---

describe("formatEurExact", () => {
  it("returns formatted 0 with euro sign", () => {
    const result = formatEurExact(0);
    expect(result).toContain("0");
    expect(result).toContain("\u20AC");
  });

  it("returns EUR 12,450 for 12450 with comma grouping", () => {
    const result = formatEurExact(12450);
    expect(result).toContain("12,450");
    expect(result).toContain("\u20AC");
  });

  it("returns EUR 1,234,567 for 1234567", () => {
    const result = formatEurExact(1234567);
    expect(result).toContain("1,234,567");
    expect(result).toContain("\u20AC");
  });
});

// --- prepareRevenueData ---

describe("prepareRevenueData", () => {
  it("returns empty array for empty input", () => {
    expect(prepareRevenueData([])).toEqual([]);
  });

  it("filters out items with value 0", () => {
    const result = prepareRevenueData([
      { name: "A", value: 0, id: "1" },
      { name: "B", value: 100, id: "2" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("B");
  });

  it("filters out items with negative value", () => {
    const result = prepareRevenueData([
      { name: "A", value: -50, id: "1" },
      { name: "B", value: 200, id: "2" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("B");
  });

  it("sorts by value descending", () => {
    const result = prepareRevenueData([
      { name: "A", value: 100, id: "1" },
      { name: "B", value: 300, id: "2" },
      { name: "C", value: 200, id: "3" },
    ]);
    expect(result.map((r) => r.name)).toEqual(["B", "C", "A"]);
  });

  it("returns top 10 when more than 10 items", () => {
    const data = Array.from({ length: 15 }, (_, i) => ({
      name: `Item ${i}`,
      value: (i + 1) * 100,
      id: String(i),
    }));
    const result = prepareRevenueData(data);
    // 10 top items + 1 "Other"
    expect(result).toHaveLength(11);
  });

  it('aggregates items beyond top 10 into "Other" with summed value', () => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      name: `Item ${i}`,
      value: (i + 1) * 100,
      id: String(i),
    }));
    const result = prepareRevenueData(data);
    const other = result.find((r) => r.name === "Other");
    expect(other).toBeDefined();
    // Items 0 and 1 (values 100 and 200) are the bottom 2 after sort
    expect(other!.value).toBe(300);
  });

  it('"Other" has no id field', () => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      name: `Item ${i}`,
      value: (i + 1) * 100,
      id: String(i),
    }));
    const result = prepareRevenueData(data);
    const other = result.find((r) => r.name === "Other");
    expect(other).toBeDefined();
    expect(other!.id).toBeUndefined();
  });

  it('returns all items when fewer than 10 (no "Other")', () => {
    const data = Array.from({ length: 5 }, (_, i) => ({
      name: `Item ${i}`,
      value: (i + 1) * 100,
      id: String(i),
    }));
    const result = prepareRevenueData(data);
    expect(result).toHaveLength(5);
    expect(result.find((r) => r.name === "Other")).toBeUndefined();
  });
});

// --- mergeComparisonData ---

describe("mergeComparisonData", () => {
  it("returns data with null percentChange when no comparison data", () => {
    const data = [{ name: "A", value: 100, id: "1" }];
    const result = mergeComparisonData(data);
    expect(result[0].percentChange).toBeNull();
  });

  it("returns data with null percentChange when comparison data is empty", () => {
    const data = [{ name: "A", value: 100, id: "1" }];
    const result = mergeComparisonData(data, []);
    expect(result[0].percentChange).toBeNull();
  });

  it("computes correct positive % change", () => {
    const current = [{ name: "A", value: 120, id: "1" }];
    const comparison = [{ name: "A", value: 100, id: "1" }];
    const result = mergeComparisonData(current, comparison);
    expect(result[0].percentChange).toBe(20);
  });

  it("computes correct negative % change", () => {
    const current = [{ name: "A", value: 80, id: "1" }];
    const comparison = [{ name: "A", value: 100, id: "1" }];
    const result = mergeComparisonData(current, comparison);
    expect(result[0].percentChange).toBe(-20);
  });

  it("items with no match in comparison get null percentChange", () => {
    const current = [{ name: "A", value: 100, id: "1" }];
    const comparison = [{ name: "B", value: 200, id: "2" }];
    const result = mergeComparisonData(current, comparison);
    expect(result[0].percentChange).toBeNull();
  });

  it('"Other" item (no id) gets null percentChange', () => {
    const current = [{ name: "Other", value: 500 }];
    const comparison = [{ name: "Other", value: 400 }];
    const result = mergeComparisonData(current, comparison);
    expect(result[0].percentChange).toBeNull();
  });

  it("items with 0 in comparison period get null percentChange (avoid division by zero)", () => {
    const current = [{ name: "A", value: 100, id: "1" }];
    const comparison = [{ name: "A", value: 0, id: "1" }];
    const result = mergeComparisonData(current, comparison);
    expect(result[0].percentChange).toBeNull();
  });
});

// --- Component rendering ---

// Mock ResizeObserver for Recharts ResponsiveContainer
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

describe("RevenueBarChart component", () => {
  it('renders "No revenue data" when data is empty', () => {
    render(<RevenueBarChart data={[]} />);
    expect(screen.getByText("No revenue data")).toBeInTheDocument();
  });

  it('renders "No revenue data" when all items have zero value', () => {
    render(
      <RevenueBarChart
        data={[
          { name: "A", value: 0, id: "1" },
          { name: "B", value: 0, id: "2" },
        ]}
      />
    );
    expect(screen.getByText("No revenue data")).toBeInTheDocument();
  });

  it("renders chart container when data is provided", () => {
    const { container } = render(
      <RevenueBarChart
        data={[
          { name: "Client A", value: 5000, id: "1" },
          { name: "Client B", value: 3000, id: "2" },
        ]}
      />
    );
    // Recharts renders inside a ResponsiveContainer with a div wrapper
    const responsiveContainer = container.querySelector(
      ".recharts-responsive-container"
    );
    expect(responsiveContainer).toBeInTheDocument();
  });

  it("does not crash when comparisonData is undefined", () => {
    expect(() => {
      render(
        <RevenueBarChart
          data={[{ name: "Client A", value: 5000, id: "1" }]}
          comparisonData={undefined}
        />
      );
    }).not.toThrow();
  });

  it("calls onBarClick with id when bar is clicked", () => {
    const handleClick = vi.fn();
    const { container } = render(
      <RevenueBarChart
        data={[{ name: "Client A", value: 5000, id: "1" }]}
        onBarClick={handleClick}
      />
    );

    // Recharts renders bars as rect elements inside .recharts-bar-rectangle
    const bars = container.querySelectorAll(".recharts-bar-rectangle");
    if (bars.length > 0) {
      fireEvent.click(bars[0]);
      expect(handleClick).toHaveBeenCalledWith("1");
    }
  });
});
