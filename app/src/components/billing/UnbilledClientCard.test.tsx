import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { UnbilledClientCard } from "./UnbilledClientCard";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("UnbilledClientCard", () => {
  const mockOnCreateServiceDescription = vi.fn();

  const defaultProps = {
    clientId: "client-1",
    clientName: "Acme Corporation",
    totalUnbilledHours: 17.5,
    estimatedValue: 3500,
    oldestEntryDate: "2024-10-15",
    newestEntryDate: "2024-12-20",
    existingDraftId: null,
    onCreateServiceDescription: mockOnCreateServiceDescription,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders client name", () => {
      render(<UnbilledClientCard {...defaultProps} />);

      expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
    });

    it("renders estimated value formatted as currency", () => {
      render(<UnbilledClientCard {...defaultProps} />);

      expect(screen.getByText("€3,500.00")).toBeInTheDocument();
      expect(screen.getByText("estimated unbilled")).toBeInTheDocument();
    });

    it("renders total hours", () => {
      render(<UnbilledClientCard {...defaultProps} />);

      expect(screen.getByText("17.5 hours")).toBeInTheDocument();
    });

    it("renders date range formatted correctly", () => {
      render(<UnbilledClientCard {...defaultProps} />);

      expect(screen.getByText("Oct 15 – Dec 20, 2024")).toBeInTheDocument();
    });

    it("shows 'Rate not set' when hourlyRate is null", () => {
      render(
        <UnbilledClientCard
          {...defaultProps}
          hourlyRate={null}
          estimatedValue={null}
        />
      );

      expect(screen.getByText("Rate not set")).toBeInTheDocument();
      expect(screen.queryByText(/€/)).not.toBeInTheDocument();
    });
  });

  describe("Draft Badge", () => {
    it("shows DRAFT badge when existingDraftId is set", () => {
      render(
        <UnbilledClientCard
          {...defaultProps}
          existingDraftId="draft-123"
        />
      );

      expect(screen.getByText("DRAFT")).toBeInTheDocument();
    });

    it("hides DRAFT badge when existingDraftId is null", () => {
      render(<UnbilledClientCard {...defaultProps} />);

      expect(screen.queryByText("DRAFT")).not.toBeInTheDocument();
    });
  });

  describe("Button Text", () => {
    it("shows 'Create Service Description' when no draft exists", () => {
      render(<UnbilledClientCard {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /Create Service Description/i })
      ).toBeInTheDocument();
    });

    it("shows 'Continue Draft' when draft exists", () => {
      render(
        <UnbilledClientCard
          {...defaultProps}
          existingDraftId="draft-123"
        />
      );

      expect(
        screen.getByRole("button", { name: /Continue Draft/i })
      ).toBeInTheDocument();
    });
  });

  describe("Click Behavior - Draft Navigation", () => {
    it("navigates to draft when clicking Continue Draft button", () => {
      render(
        <UnbilledClientCard
          {...defaultProps}
          existingDraftId="draft-123"
        />
      );

      const button = screen.getByRole("button", { name: /Continue Draft/i });
      fireEvent.click(button);

      expect(mockPush).toHaveBeenCalledWith("/billing/draft-123");
      expect(mockOnCreateServiceDescription).not.toHaveBeenCalled();
    });
  });

  describe("Click Behavior - Create Service Description", () => {
    it("calls onCreateServiceDescription when clicking Create button", async () => {
      mockOnCreateServiceDescription.mockResolvedValue(undefined);

      render(<UnbilledClientCard {...defaultProps} />);

      const button = screen.getByRole("button", {
        name: /Create Service Description/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockOnCreateServiceDescription).toHaveBeenCalledWith(
          "client-1",
          "2024-10-15",
          "2024-12-20"
        );
      });
    });
  });

  describe("Loading State", () => {
    it("shows 'Creating...' while creating service description", async () => {
      // Create a promise that we control
      let resolvePromise: () => void;
      const slowPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockOnCreateServiceDescription.mockReturnValue(slowPromise);

      render(<UnbilledClientCard {...defaultProps} />);

      const button = screen.getByRole("button", {
        name: /Create Service Description/i,
      });
      fireEvent.click(button);

      // Check loading state
      await waitFor(() => {
        expect(screen.getByText("Creating...")).toBeInTheDocument();
      });

      // Resolve the promise
      resolvePromise!();

      // Check it returns to normal state
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Create Service Description/i })
        ).toBeInTheDocument();
      });
    });

    it("disables button while creating", async () => {
      let resolvePromise: () => void;
      const slowPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockOnCreateServiceDescription.mockReturnValue(slowPromise);

      render(<UnbilledClientCard {...defaultProps} />);

      const button = screen.getByRole("button", {
        name: /Create Service Description/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        const loadingButton = screen.getByRole("button", { name: "Creating..." });
        expect(loadingButton).toBeDisabled();
      });

      // Wrap state update in act
      await act(async () => {
        resolvePromise!();
        await slowPromise;
      });
    });
  });

  describe("Edge Cases", () => {
    it("formats large estimated values with commas", () => {
      render(
        <UnbilledClientCard
          {...defaultProps}
          estimatedValue={125000.5}
        />
      );

      expect(screen.getByText("€125,000.50")).toBeInTheDocument();
    });

    it("formats zero hours correctly", () => {
      render(
        <UnbilledClientCard
          {...defaultProps}
          totalUnbilledHours={0}
        />
      );

      expect(screen.getByText("0 hours")).toBeInTheDocument();
    });

    it("formats singular hour correctly", () => {
      render(
        <UnbilledClientCard
          {...defaultProps}
          totalUnbilledHours={1}
        />
      );

      expect(screen.getByText("1 hour")).toBeInTheDocument();
    });
  });
});
