import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UnbilledClientsSection } from "./UnbilledClientsSection";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("UnbilledClientsSection", () => {
  const mockOnCreateServiceDescription = vi.fn();

  const mockClients = [
    {
      clientId: "client-1",
      clientName: "Acme Corporation",
      totalUnbilledHours: 17.5,
      estimatedValue: 3500,
      oldestEntryDate: "2024-10-15",
      newestEntryDate: "2024-12-20",
      existingDraftId: null,
    },
    {
      clientId: "client-2",
      clientName: "TechStart Ltd",
      totalUnbilledHours: 8,
      estimatedValue: 1600,
      oldestEntryDate: "2024-11-01",
      newestEntryDate: "2024-11-30",
      existingDraftId: "draft-456",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Loading State", () => {
    it("shows 'Loading...' initially while fetching", () => {
      // Create a promise that never resolves to keep loading state
      global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

      render(
        <UnbilledClientsSection
          onCreateServiceDescription={mockOnCreateServiceDescription}
        />
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows empty message when no clients have unbilled hours", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ clients: [] }),
      });

      render(
        <UnbilledClientsSection
          onCreateServiceDescription={mockOnCreateServiceDescription}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("All caught up!")).toBeInTheDocument();
      });

      expect(screen.getByText("No unbilled hours to bill.")).toBeInTheDocument();

      const link = screen.getByRole("link", { name: /Log time/i });
      expect(link).toHaveAttribute("href", "/timesheets");
    });
  });

  describe("Rendering Clients", () => {
    it("renders cards for each client", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ clients: mockClients }),
      });

      render(
        <UnbilledClientsSection
          onCreateServiceDescription={mockOnCreateServiceDescription}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
      });

      expect(screen.getByText("TechStart Ltd")).toBeInTheDocument();
      expect(screen.getByText("3,500.00 BGN")).toBeInTheDocument();
      expect(screen.getByText("1,600.00 BGN")).toBeInTheDocument();
    });

    it("shows section heading with count badge", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ clients: mockClients }),
      });

      render(
        <UnbilledClientsSection
          onCreateServiceDescription={mockOnCreateServiceDescription}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Clients Ready to Bill")).toBeInTheDocument();
      });

      // Count badge should show number of clients
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error message when fetch fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      render(
        <UnbilledClientsSection
          onCreateServiceDescription={mockOnCreateServiceDescription}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load unbilled clients")
        ).toBeInTheDocument();
      });
    });

    it("shows error message when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      render(
        <UnbilledClientsSection
          onCreateServiceDescription={mockOnCreateServiceDescription}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load unbilled clients")
        ).toBeInTheDocument();
      });
    });
  });
});
