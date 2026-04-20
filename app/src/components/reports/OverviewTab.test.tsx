import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { TrendResponse } from "@/types/reports";

// Mock Recharts components to avoid jsdom SVG issues
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="composed-chart">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  Cell: () => <div data-testid="cell" />,
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
}));

const mockTrendResponse: TrendResponse = {
  months: [
    {
      month: "2025-05",
      label: "May '25",
      totalHours: 280,
      billableHours: 190,
      revenue: 42000,
      billedRevenue: 38000,
      standardRateValue: 42000,
      realization: 90,
      billedHours: 190,
      activeClients: 14,
      utilization: 68,
      byEmployee: [
        { id: "u1", name: "Alice", hours: 140, billableHours: 95, billableRevenue: 19000, billedRevenue: 19000, billedHours: 95 },
        { id: "u2", name: "Bob", hours: 140, billableHours: 95, billableRevenue: 19000, billedRevenue: 19000, billedHours: 95 },
      ],
    },
    {
      month: "2025-06",
      label: "Jun '25",
      totalHours: 300,
      billableHours: 210,
      revenue: 45000,
      billedRevenue: 40000,
      standardRateValue: 45000,
      realization: 89,
      billedHours: 210,
      activeClients: 15,
      utilization: 70,
      byEmployee: [
        { id: "u1", name: "Alice", hours: 150, billableHours: 105, billableRevenue: 20000, billedRevenue: 20000, billedHours: 105 },
        { id: "u2", name: "Bob", hours: 150, billableHours: 105, billableRevenue: 20000, billedRevenue: 20000, billedHours: 105 },
      ],
    },
    {
      month: "2025-07",
      label: "Jul '25",
      totalHours: 0,
      billableHours: 0,
      revenue: 0,
      billedRevenue: 0,
      standardRateValue: 0,
      realization: 0,
      billedHours: 0,
      activeClients: 0,
      utilization: 0,
      byEmployee: [],
    },
    {
      month: "2025-08",
      label: "Aug '25",
      totalHours: 0,
      billableHours: 0,
      revenue: 0,
      billedRevenue: 0,
      standardRateValue: 0,
      realization: 0,
      billedHours: 0,
      activeClients: 0,
      utilization: 0,
      byEmployee: [],
    },
    {
      month: "2025-09",
      label: "Sep '25",
      totalHours: 0,
      billableHours: 0,
      revenue: 0,
      billedRevenue: 0,
      standardRateValue: 0,
      realization: 0,
      billedHours: 0,
      activeClients: 0,
      utilization: 0,
      byEmployee: [],
    },
    {
      month: "2025-10",
      label: "Oct '25",
      totalHours: 0,
      billableHours: 0,
      revenue: 0,
      billedRevenue: 0,
      standardRateValue: 0,
      realization: 0,
      billedHours: 0,
      activeClients: 0,
      utilization: 0,
      byEmployee: [],
    },
    {
      month: "2025-11",
      label: "Nov '25",
      totalHours: 0,
      billableHours: 0,
      revenue: 0,
      billedRevenue: 0,
      standardRateValue: 0,
      realization: 0,
      billedHours: 0,
      activeClients: 0,
      utilization: 0,
      byEmployee: [],
    },
    {
      month: "2025-12",
      label: "Dec '25",
      totalHours: 0,
      billableHours: 0,
      revenue: 0,
      billedRevenue: 0,
      standardRateValue: 0,
      realization: 0,
      billedHours: 0,
      activeClients: 0,
      utilization: 0,
      byEmployee: [],
    },
    {
      month: "2026-01",
      label: "Jan '26",
      totalHours: 0,
      billableHours: 0,
      revenue: 0,
      billedRevenue: 0,
      standardRateValue: 0,
      realization: 0,
      billedHours: 0,
      activeClients: 0,
      utilization: 0,
      byEmployee: [],
    },
    {
      month: "2026-02",
      label: "Feb '26",
      totalHours: 310,
      billableHours: 220,
      revenue: 46500,
      billedRevenue: 42000,
      standardRateValue: 46500,
      realization: 90,
      billedHours: 220,
      activeClients: 16,
      utilization: 71,
      byEmployee: [
        { id: "u1", name: "Alice", hours: 160, billableHours: 110, billableRevenue: 21000, billedRevenue: 21000, billedHours: 110 },
        { id: "u2", name: "Bob", hours: 150, billableHours: 110, billableRevenue: 21000, billedRevenue: 21000, billedHours: 110 },
      ],
    },
    {
      month: "2026-03",
      label: "Mar '26",
      totalHours: 350,
      billableHours: 262,
      revenue: 52500,
      billedRevenue: 48000,
      standardRateValue: 52500,
      realization: 91,
      billedHours: 262,
      activeClients: 17,
      utilization: 75,
      byEmployee: [
        { id: "u1", name: "Alice", hours: 180, billableHours: 131, billableRevenue: 24000, billedRevenue: 24000, billedHours: 131 },
        { id: "u2", name: "Bob", hours: 170, billableHours: 131, billableRevenue: 24000, billedRevenue: 24000, billedHours: 131 },
      ],
    },
    {
      month: "2026-04",
      label: "Apr '26",
      totalHours: 342.5,
      billableHours: 246.5,
      revenue: 48200,
      billedRevenue: 44000,
      standardRateValue: 48200,
      realization: 91,
      billedHours: 246.5,
      activeClients: 18,
      utilization: 72,
      byEmployee: [
        { id: "u1", name: "Alice", hours: 172.5, billableHours: 123, billableRevenue: 22000, billedRevenue: 22000, billedHours: 123 },
        { id: "u2", name: "Bob", hours: 170, billableHours: 123, billableRevenue: 22000, billedRevenue: 22000, billedHours: 123 },
      ],
    },
  ],
  latest: {
    totalHours: 342.5,
    revenue: 48200,
    activeClients: 18,
    utilization: 72,
  },
  previous: {
    totalHours: 350,
    revenue: 52500,
    activeClients: 17,
    utilization: 75,
  },
};

const emptyTrendResponse: TrendResponse = {
  months: Array.from({ length: 12 }, (_, i) => ({
    month: `2025-${String(i + 1).padStart(2, "0")}`,
    label: `Month ${i + 1}`,
    totalHours: 0,
    billableHours: 0,
    revenue: 0,
    billedRevenue: 0,
    standardRateValue: 0,
    realization: 0,
    billedHours: 0,
    activeClients: 0,
    utilization: 0,
    byEmployee: [],
  })),
  latest: { totalHours: 0, revenue: 0, activeClients: 0, utilization: 0 },
  previous: { totalHours: 0, revenue: 0, activeClients: 0, utilization: 0 },
};

// Reset module-level cache between tests
async function resetOverviewCache() {
  // Re-import the module to reset the module-level cachedTrendData
  vi.resetModules();
}

let mockFetch: ReturnType<typeof vi.fn>;

describe("OverviewTab", () => {
  beforeEach(async () => {
    await resetOverviewCache();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", async () => {
    // Never resolve so we stay in loading
    mockFetch.mockReturnValue(new Promise(() => {}));

    // Dynamic import after resetModules so cache is cleared
    const { OverviewTab: FreshOverviewTab } = await import("./OverviewTab");
    render(<FreshOverviewTab />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders chart sections on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrendResponse),
    });

    const { OverviewTab: FreshOverviewTab } = await import("./OverviewTab");
    render(<FreshOverviewTab />);

    await waitFor(() => {
      expect(
        screen.getByText("Billable Hours (12 Months)")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/By Employee/)
    ).toBeInTheDocument();
  });

  it("shows empty state when no data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyTrendResponse),
    });

    const { OverviewTab: FreshOverviewTab } = await import("./OverviewTab");
    render(<FreshOverviewTab />);

    await waitFor(() => {
      expect(
        screen.getByText("No hours logged in the last 12 months")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "Time entries will appear here once team members start logging hours."
      )
    ).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    const { OverviewTab: FreshOverviewTab } = await import("./OverviewTab");
    render(<FreshOverviewTab />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Failed to load trend data. Check your connection and try refreshing the page."
        )
      ).toBeInTheDocument();
    });
  });

});
