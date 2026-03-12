import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
        json: () => Promise.resolve([]),
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
        json: () => Promise.resolve(mockClients),
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
      expect(screen.getByText("€3,500.00")).toBeInTheDocument();
      expect(screen.getByText("€1,600.00")).toBeInTheDocument();
    });

    it("shows section heading with count badge", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockClients),
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

  describe("Bulk Waive", () => {
    function setupWithClients() {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockClients),
      });
      global.fetch = mockFetch;
      return mockFetch;
    }

    async function openWriteOffModal(mockFetch: ReturnType<typeof vi.fn>) {
      render(
        <UnbilledClientsSection
          onCreateServiceDescription={mockOnCreateServiceDescription}
        />
      );

      // Wait for clients to load
      await waitFor(() => {
        expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
      });

      // Open three-dot menu on first card
      const optionsButtons = screen.getAllByRole("button", { name: "Options" });
      fireEvent.click(optionsButtons[0]);

      // Click Write Off All
      const writeOffButton = screen.getByText("Write Off All");
      fireEvent.click(writeOffButton);

      return mockFetch;
    }

    it("opens ConfirmModal when Write Off All is clicked", async () => {
      const mockFetch = setupWithClients();
      await openWriteOffModal(mockFetch);

      expect(screen.getByText("Write Off Unbilled Entries")).toBeInTheDocument();
    });

    it("shows correct message with client name and hours", async () => {
      const mockFetch = setupWithClients();
      await openWriteOffModal(mockFetch);

      expect(
        screen.getByText(/All unbilled entries for Acme Corporation will be written off \(17\.5 hours\)/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/This action cannot be undone from this page/)
      ).toBeInTheDocument();
    });

    it("calls PATCH /api/timesheets/bulk-waive with correct payload on confirm", async () => {
      const mockFetch = setupWithClients();
      await openWriteOffModal(mockFetch);

      // Mock the bulk-waive response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, updatedCount: 5 }),
      });
      // Mock the refetch after waive
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockClients[1]]),
      });

      // Click Write Off button in the modal
      const confirmButton = screen.getByRole("button", { name: /Write Off/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        // Find the bulk-waive call among all fetch calls
        const bulkWaiveCall = mockFetch.mock.calls.find(
          (call: [string, RequestInit?]) => call[0] === "/api/timesheets/bulk-waive"
        );
        expect(bulkWaiveCall).toBeDefined();
        const body = JSON.parse(bulkWaiveCall![1]?.body as string);
        expect(body.clientId).toBe("client-1");
      });
    });

    it("closes modal and refetches list after successful waive", async () => {
      const mockFetch = setupWithClients();
      await openWriteOffModal(mockFetch);

      // Mock the bulk-waive response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, updatedCount: 5 }),
      });
      // Mock the refetch — return only second client (first was waived)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockClients[1]]),
      });

      // Click Write Off
      const confirmButton = screen.getByRole("button", { name: /Write Off/i });
      fireEvent.click(confirmButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText("Write Off Unbilled Entries")).not.toBeInTheDocument();
      });

      // First client should be gone after refetch
      await waitFor(() => {
        expect(screen.queryByText("Acme Corporation")).not.toBeInTheDocument();
      });
      expect(screen.getByText("TechStart Ltd")).toBeInTheDocument();
    });

    it("does not call API when cancelling the modal", async () => {
      const mockFetch = setupWithClients();
      await openWriteOffModal(mockFetch);

      // Track call count before cancel
      const callCountBefore = mockFetch.mock.calls.length;

      // Click Cancel
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      // Modal should close
      expect(screen.queryByText("Write Off Unbilled Entries")).not.toBeInTheDocument();

      // No additional fetch calls should have been made
      expect(mockFetch.mock.calls.length).toBe(callCountBefore);
    });
  });
});
