import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BillingContent } from "./BillingContent";

// Mock next/navigation
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock child components to isolate tab behavior
vi.mock("./UnbilledClientsSection", () => ({
  UnbilledClientsSection: () => (
    <div data-testid="unbilled-clients-section">UnbilledClientsSection</div>
  ),
}));

vi.mock("@/components/ui/DataTable", () => ({
  DataTable: ({ data }: { data: unknown[] }) => (
    <div data-testid="data-table" data-count={data.length}>
      DataTable
    </div>
  ),
}));

// Mock DateRangePicker — capture props for testing
let capturedDateRangeProps: { value: unknown; onChange: (range: unknown) => void } | null = null;

vi.mock("./DateRangePicker", () => ({
  DateRangePicker: (props: { value: unknown; onChange: (range: unknown) => void }) => {
    capturedDateRangeProps = props;
    return <div data-testid="date-range-picker">DateRangePicker</div>;
  },
  getDateRange: (preset: string) => {
    if (preset === "this-month") return { from: "2026-02-01", to: "2026-02-28" };
    if (preset === "last-month") return { from: "2026-01-01", to: "2026-01-31" };
    if (preset === "all-time") return { from: null, to: null };
    return { from: null, to: null };
  },
  DateRange: {} as never,
}));

vi.mock("./CreateServiceDescriptionModal", () => ({
  CreateServiceDescriptionModal: () => <div data-testid="create-modal" />,
}));

vi.mock("@/components/ui/ConfirmModal", () => ({
  ConfirmModal: () => <div data-testid="confirm-modal" />,
}));

const defaultProps = {
  initialServiceDescriptions: [],
  clients: [],
};

const mockSDs = [
  {
    id: "sd-1",
    clientId: "c1",
    clientName: "Alpha Corp",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
    status: "DRAFT" as const,
    totalAmount: 1000,
    updatedAt: "2026-02-15T00:00:00Z",
  },
  {
    id: "sd-2",
    clientId: "c2",
    clientName: "Beta LLC",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
    status: "FINALIZED" as const,
    totalAmount: 2000,
    updatedAt: "2026-02-14T00:00:00Z",
  },
];

// Helper to flush microtasks (promises) without fake timers interfering
async function flushPromises() {
  await act(async () => {
    // Allow microtask queue to drain
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("BillingContent", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    capturedDateRangeProps = null;

    // Mock global fetch
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("TABS-01: Tab bar renders both tabs", () => {
    it("renders Ready to Bill and Service Descriptions tab buttons", async () => {
      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      expect(
        screen.getByRole("button", { name: "Ready to Bill" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Service Descriptions" })
      ).toBeInTheDocument();
    });
  });

  describe("TABS-02: Ready to Bill tab shows UnbilledClientsSection", () => {
    it("shows UnbilledClientsSection when no tab param is set", async () => {
      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      expect(
        screen.getByTestId("unbilled-clients-section")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("data-table")).not.toBeInTheDocument();
    });
  });

  describe("TABS-03: Service Descriptions tab shows SD table", () => {
    it("shows DataTable and DateRangePicker when tab=service-descriptions", async () => {
      mockSearchParams = new URLSearchParams("tab=service-descriptions");

      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      expect(screen.getByTestId("data-table")).toBeInTheDocument();
      expect(screen.getByTestId("date-range-picker")).toBeInTheDocument();
      expect(
        screen.queryByTestId("unbilled-clients-section")
      ).not.toBeInTheDocument();
    });
  });

  describe("TABS-04: Tab state persisted in URL", () => {
    it("updates URL when clicking Service Descriptions tab", async () => {
      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      fireEvent.click(
        screen.getByRole("button", { name: "Service Descriptions" })
      );

      expect(mockReplace).toHaveBeenCalledWith(
        "/billing?tab=service-descriptions",
        { scroll: false }
      );
    });

    it("updates URL when clicking Ready to Bill tab", async () => {
      mockSearchParams = new URLSearchParams("tab=service-descriptions");

      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      fireEvent.click(screen.getByRole("button", { name: "Ready to Bill" }));

      expect(mockReplace).toHaveBeenCalledWith("/billing", { scroll: false });
    });
  });

  describe("TABS-05: Default tab is Ready to Bill", () => {
    it("shows Ready to Bill tab as active by default", async () => {
      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      const readyTab = screen.getByRole("button", { name: "Ready to Bill" });
      expect(readyTab.className).toContain("text-[var(--accent-pink)]");

      // Verify the underline indicator is present within the active tab
      const underline = readyTab.querySelector("span");
      expect(underline).toBeInTheDocument();
    });

    it("shows UnbilledClientsSection by default", async () => {
      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      expect(
        screen.getByTestId("unbilled-clients-section")
      ).toBeInTheDocument();
    });
  });

  describe("Edge case: Unknown tab value defaults to Ready to Bill", () => {
    it("defaults to Ready to Bill for unknown tab values", async () => {
      mockSearchParams = new URLSearchParams("tab=invalid-value");

      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      expect(
        screen.getByTestId("unbilled-clients-section")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("data-table")).not.toBeInTheDocument();

      const readyTab = screen.getByRole("button", { name: "Ready to Bill" });
      expect(readyTab.className).toContain("text-[var(--accent-pink)]");
    });
  });

  describe("FILT-01: DateRangePicker is rendered on SD tab", () => {
    it("renders DateRangePicker when Service Descriptions tab is active", async () => {
      mockSearchParams = new URLSearchParams("tab=service-descriptions");

      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      expect(screen.getByTestId("date-range-picker")).toBeInTheDocument();
    });

    it("does not render DateRangePicker on Ready to Bill tab", async () => {
      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      expect(screen.queryByTestId("date-range-picker")).not.toBeInTheDocument();
    });
  });

  describe("FILT-02: Default date range is this-month", () => {
    it("fetches SDs with this-month date range on initial render", async () => {
      mockSearchParams = new URLSearchParams("tab=service-descriptions");

      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/billing?periodStartFrom=2026-02-01&periodStartTo=2026-02-28"
      );
    });
  });

  describe("FILT-03: Changing date range triggers API fetch", () => {
    it("fetches SDs with new date range when DateRangePicker onChange fires", async () => {
      mockSearchParams = new URLSearchParams("tab=service-descriptions");

      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      mockFetch.mockClear();

      // Simulate DateRangePicker onChange — change to last-month
      await act(async () => {
        capturedDateRangeProps!.onChange({
          preset: "last-month",
          from: "2026-01-01",
          to: "2026-01-31",
        });
      });
      await flushPromises();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/billing?periodStartFrom=2026-01-01&periodStartTo=2026-01-31"
      );
    });

    it("fetches all SDs when date range is set to all-time (no params)", async () => {
      mockSearchParams = new URLSearchParams("tab=service-descriptions");

      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      mockFetch.mockClear();

      // Set to all-time
      await act(async () => {
        capturedDateRangeProps!.onChange({
          preset: "all-time",
          from: null,
          to: null,
        });
      });
      await flushPromises();

      expect(mockFetch).toHaveBeenCalledWith("/api/billing");
    });
  });

  describe("FILT-04: Status filter and date range work together", () => {
    it("applies status filter client-side on date-range-filtered SDs", async () => {
      mockSearchParams = new URLSearchParams("tab=service-descriptions");

      // Mock fetch to return mixed-status SDs
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSDs),
      });

      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      // Data should be loaded — 2 items
      const table = screen.getByTestId("data-table");
      expect(table.getAttribute("data-count")).toBe("2");

      // Filter by status — select DRAFT
      await act(async () => {
        fireEvent.change(screen.getByRole("combobox"), { target: { value: "DRAFT" } });
      });

      // Should show only 1 result (Alpha Corp is DRAFT)
      const updatedTable = screen.getByTestId("data-table");
      expect(updatedTable.getAttribute("data-count")).toBe("1");
    });

    it("shows search input and status filter alongside DateRangePicker", async () => {
      mockSearchParams = new URLSearchParams("tab=service-descriptions");

      render(<BillingContent {...defaultProps} />);
      await flushPromises();

      expect(screen.getByTestId("date-range-picker")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Search by client name...")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });
});
