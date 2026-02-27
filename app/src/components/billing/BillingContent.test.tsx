import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  DataTable: () => <div data-testid="data-table">DataTable</div>,
}));

vi.mock("@/components/ui/TableFilters", () => ({
  TableFilters: () => <div data-testid="table-filters">TableFilters</div>,
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

describe("BillingContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  describe("TABS-01: Tab bar renders both tabs", () => {
    it("renders Ready to Bill and Service Descriptions tab buttons", () => {
      render(<BillingContent {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: "Ready to Bill" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Service Descriptions" })
      ).toBeInTheDocument();
    });
  });

  describe("TABS-02: Ready to Bill tab shows UnbilledClientsSection", () => {
    it("shows UnbilledClientsSection when no tab param is set", () => {
      render(<BillingContent {...defaultProps} />);

      expect(
        screen.getByTestId("unbilled-clients-section")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("data-table")).not.toBeInTheDocument();
    });
  });

  describe("TABS-03: Service Descriptions tab shows SD table", () => {
    it("shows DataTable and TableFilters when tab=service-descriptions", () => {
      mockSearchParams = new URLSearchParams("tab=service-descriptions");

      render(<BillingContent {...defaultProps} />);

      expect(screen.getByTestId("data-table")).toBeInTheDocument();
      expect(screen.getByTestId("table-filters")).toBeInTheDocument();
      expect(
        screen.queryByTestId("unbilled-clients-section")
      ).not.toBeInTheDocument();
    });
  });

  describe("TABS-04: Tab state persisted in URL", () => {
    it("updates URL when clicking Service Descriptions tab", () => {
      render(<BillingContent {...defaultProps} />);

      fireEvent.click(
        screen.getByRole("button", { name: "Service Descriptions" })
      );

      expect(mockReplace).toHaveBeenCalledWith(
        "/billing?tab=service-descriptions",
        { scroll: false }
      );
    });

    it("updates URL when clicking Ready to Bill tab", () => {
      mockSearchParams = new URLSearchParams("tab=service-descriptions");

      render(<BillingContent {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: "Ready to Bill" }));

      expect(mockReplace).toHaveBeenCalledWith("/billing", { scroll: false });
    });
  });

  describe("TABS-05: Default tab is Ready to Bill", () => {
    it("shows Ready to Bill tab as active by default", () => {
      render(<BillingContent {...defaultProps} />);

      const readyTab = screen.getByRole("button", { name: "Ready to Bill" });
      expect(readyTab.className).toContain("text-[var(--accent-pink)]");

      // Verify the underline indicator is present within the active tab
      const underline = readyTab.querySelector("span");
      expect(underline).toBeInTheDocument();
    });

    it("shows UnbilledClientsSection by default", () => {
      render(<BillingContent {...defaultProps} />);

      expect(
        screen.getByTestId("unbilled-clients-section")
      ).toBeInTheDocument();
    });
  });

  describe("Edge case: Unknown tab value defaults to Ready to Bill", () => {
    it("defaults to Ready to Bill for unknown tab values", () => {
      mockSearchParams = new URLSearchParams("tab=invalid-value");

      render(<BillingContent {...defaultProps} />);

      expect(
        screen.getByTestId("unbilled-clients-section")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("data-table")).not.toBeInTheDocument();

      const readyTab = screen.getByRole("button", { name: "Ready to Bill" });
      expect(readyTab.className).toContain("text-[var(--accent-pink)]");
    });
  });
});
