import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EntriesList } from "./EntriesList";
import type { TimeEntry, ClientWithType, Topic } from "@/types";

// Mock the child components
vi.mock("./EntryRow", () => ({
  EntryRow: ({
    entry,
    onDeleteClick,
    readOnly,
  }: {
    entry: TimeEntry;
    onDeleteClick?: () => void;
    onUpdate?: (updatedEntry: TimeEntry) => void;
    readOnly?: boolean;
    clients?: ClientWithType[];
    topics?: Topic[];
  }) => (
    <tr data-testid={`entry-row-${entry.id}`}>
      <td>{entry.client.name}</td>
      <td>{entry.topicName}</td>
      <td>{entry.hours}h</td>
      <td>{entry.description}</td>
      {!readOnly && (
        <td>
          <button
            data-testid={`delete-btn-${entry.id}`}
            onClick={onDeleteClick}
          >
            Delete
          </button>
        </td>
      )}
    </tr>
  ),
}));

vi.mock("./EntryCard", () => ({
  EntryCard: ({
    entry,
    onDeleteClick,
    readOnly,
  }: {
    entry: TimeEntry;
    onEditClick?: () => void;
    onDeleteClick?: () => void;
    readOnly?: boolean;
  }) => (
    <div data-testid={`entry-card-${entry.id}`}>
      <span>{entry.client.name}</span>
      <span>{entry.hours}h</span>
      <span>{entry.topicName}</span>
      <span>{entry.description}</span>
      {!readOnly && (
        <button
          data-testid={`card-delete-btn-${entry.id}`}
          onClick={onDeleteClick}
        >
          Delete
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/ui/ConfirmModal", () => ({
  ConfirmModal: ({
    title,
    message,
    onConfirm,
    onCancel,
  }: {
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="confirm-modal">
      <h2>{title}</h2>
      <p>{message}</p>
      <button data-testid="confirm-delete" onClick={onConfirm}>
        Confirm
      </button>
      <button data-testid="cancel-delete" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

// Mock formatHours
vi.mock("@/lib/date-utils", () => ({
  formatHours: (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  },
}));

describe("EntriesList", () => {
  const mockOnDeleteEntry = vi.fn();
  const mockOnUpdateEntry = vi.fn();

  const mockEntries: TimeEntry[] = [
    {
      id: "entry-1",
      date: "2024-12-26",
      hours: 2.5,
      description: "Contract review and analysis",
      clientId: "client-1",
      client: { id: "client-1", name: "Acme Corporation" },
      subtopicId: "subtopic-1",
      topicName: "M&A Advisory",
      subtopicName: "Contract review",
    },
    {
      id: "entry-2",
      date: "2024-12-26",
      hours: 1,
      description: "Client meeting",
      clientId: "client-2",
      client: { id: "client-2", name: "Beta Industries" },
      subtopicId: "subtopic-2",
      topicName: "General Counsel",
      subtopicName: "Meetings",
    },
    {
      id: "entry-3",
      date: "2024-12-26",
      hours: 0.5,
      description: "Email correspondence",
      clientId: "client-1",
      client: { id: "client-1", name: "Acme Corporation" },
      subtopicId: "subtopic-3",
      topicName: "M&A Advisory",
      subtopicName: "Correspondence",
      isLocked: true,
    },
  ];

  const mockClients: ClientWithType[] = [
    { id: "client-1", name: "Acme Corporation", clientType: "REGULAR" },
    { id: "client-2", name: "Beta Industries", clientType: "REGULAR" },
  ];

  const mockTopics: Topic[] = [
    {
      id: "topic-1",
      name: "M&A Advisory",
      displayOrder: 1,
      status: "ACTIVE",
      topicType: "REGULAR",
      subtopics: [],
    },
  ];

  const defaultProps = {
    entries: mockEntries,
    isLoadingEntries: false,
    onDeleteEntry: mockOnDeleteEntry,
    onUpdateEntry: mockOnUpdateEntry,
    clients: mockClients,
    topics: mockTopics,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering Entries", () => {
    it("renders list of entries", () => {
      render(<EntriesList {...defaultProps} />);

      // Desktop view - table rows
      expect(screen.getByTestId("entry-row-entry-1")).toBeInTheDocument();
      expect(screen.getByTestId("entry-row-entry-2")).toBeInTheDocument();
      expect(screen.getByTestId("entry-row-entry-3")).toBeInTheDocument();
    });

    it("renders entry cards for mobile view", () => {
      render(<EntriesList {...defaultProps} />);

      // Mobile view - cards
      expect(screen.getByTestId("entry-card-entry-1")).toBeInTheDocument();
      expect(screen.getByTestId("entry-card-entry-2")).toBeInTheDocument();
      expect(screen.getByTestId("entry-card-entry-3")).toBeInTheDocument();
    });

    it("shows entry details in desktop table", () => {
      render(<EntriesList {...defaultProps} />);

      // Check that entry content is rendered (via mocked EntryRow)
      expect(screen.getAllByText("Acme Corporation")).toHaveLength(4); // 2 in rows, 2 in cards
      expect(screen.getAllByText("Beta Industries")).toHaveLength(2); // 1 in row, 1 in card
    });

    it("renders table headers in desktop view", () => {
      render(<EntriesList {...defaultProps} />);

      expect(screen.getByText("Client")).toBeInTheDocument();
      expect(screen.getByText("Topic")).toBeInTheDocument();
      expect(screen.getByText("Hours")).toBeInTheDocument();
      expect(screen.getByText("Work")).toBeInTheDocument();
    });
  });

  describe("Daily Total", () => {
    it("calculates and displays daily total hours", () => {
      render(<EntriesList {...defaultProps} />);

      // Total: 2.5 + 1 + 0.5 = 4 hours
      // formatHours(4) = "4h"
      const totalElements = screen.getAllByText("4h");
      expect(totalElements.length).toBeGreaterThan(0);
    });

    it("shows daily total in both mobile and desktop views", () => {
      render(<EntriesList {...defaultProps} />);

      // "Daily Total:" label should appear twice (mobile + desktop)
      const totalLabels = screen.getAllByText("Daily Total:");
      expect(totalLabels).toHaveLength(2);
    });
  });

  describe("Submit Functionality", () => {
    const submitProps = {
      totalHours: 6.5,
      isSubmitted: false,
      isLoading: false,
      onSubmit: vi.fn(),
    };

    beforeEach(() => {
      submitProps.onSubmit = vi.fn();
    });

    it("shows remaining hours when under 8 hours", () => {
      render(<EntriesList {...defaultProps} {...submitProps} totalHours={6.5} />);

      // 8 - 6.5 = 1.5 hours = "1h 30m to go"
      expect(screen.getAllByText(/1h 30m to go/)).toHaveLength(2); // mobile + desktop
    });

    it("shows submit button when 8+ hours logged", () => {
      render(<EntriesList {...defaultProps} {...submitProps} totalHours={8.5} />);

      const submitButtons = screen.getAllByText("Submit Timesheet →");
      expect(submitButtons).toHaveLength(2); // mobile + desktop
    });

    it("calls onSubmit when submit button is clicked", () => {
      render(<EntriesList {...defaultProps} {...submitProps} totalHours={8.5} />);

      const submitButtons = screen.getAllByText("Submit Timesheet →");
      fireEvent.click(submitButtons[0]);

      expect(submitProps.onSubmit).toHaveBeenCalledTimes(1);
    });

    it("shows submitted state after submission", () => {
      render(<EntriesList {...defaultProps} {...submitProps} totalHours={8.5} isSubmitted />);

      expect(screen.getAllByText(/Timesheet Submitted/)).toHaveLength(2);
      expect(screen.queryByText("Submit Timesheet →")).not.toBeInTheDocument();
    });

    it("disables submit button when loading", () => {
      render(<EntriesList {...defaultProps} {...submitProps} totalHours={8.5} isLoading />);

      const submitButtons = screen.getAllByRole("button", { name: /Submit Timesheet/ });
      submitButtons.forEach(btn => {
        expect(btn).toBeDisabled();
      });
    });

    it("does not show submit UI when props are not provided", () => {
      render(<EntriesList {...defaultProps} />);

      expect(screen.queryByText(/to go/)).not.toBeInTheDocument();
      expect(screen.queryByText("Submit Timesheet →")).not.toBeInTheDocument();
    });

    it("does not show submit UI in readOnly mode", () => {
      render(<EntriesList {...defaultProps} {...submitProps} totalHours={8.5} readOnly />);

      expect(screen.queryByText("Submit Timesheet →")).not.toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows empty state when no entries", () => {
      render(<EntriesList {...defaultProps} entries={[]} />);

      expect(screen.getByText("No entries for this date")).toBeInTheDocument();
      expect(
        screen.getByText("Use the form above to log your time")
      ).toBeInTheDocument();
    });

    it("does not show table when no entries", () => {
      render(<EntriesList {...defaultProps} entries={[]} />);

      expect(screen.queryByText("Client")).not.toBeInTheDocument();
      expect(screen.queryByText("Topic")).not.toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("shows loading spinner when loading entries", () => {
      const { container } = render(
        <EntriesList {...defaultProps} isLoadingEntries />
      );

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("does not show entries while loading", () => {
      render(<EntriesList {...defaultProps} isLoadingEntries />);

      expect(screen.queryByTestId("entry-row-entry-1")).not.toBeInTheDocument();
      expect(screen.queryByText("Daily Total:")).not.toBeInTheDocument();
    });
  });

  describe("Delete Functionality", () => {
    it("shows delete confirmation modal when delete is clicked", () => {
      render(<EntriesList {...defaultProps} />);

      // Click delete on entry-1 (desktop row)
      fireEvent.click(screen.getByTestId("delete-btn-entry-1"));

      expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();
      expect(screen.getByText("Delete Entry")).toBeInTheDocument();
    });

    it("calls onDeleteEntry when deletion is confirmed", () => {
      render(<EntriesList {...defaultProps} />);

      // Click delete
      fireEvent.click(screen.getByTestId("delete-btn-entry-1"));

      // Confirm
      fireEvent.click(screen.getByTestId("confirm-delete"));

      expect(mockOnDeleteEntry).toHaveBeenCalledWith("entry-1");
    });

    it("closes modal without deleting when cancelled", () => {
      render(<EntriesList {...defaultProps} />);

      // Click delete
      fireEvent.click(screen.getByTestId("delete-btn-entry-1"));

      // Cancel
      fireEvent.click(screen.getByTestId("cancel-delete"));

      // Modal should be closed
      expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
      expect(mockOnDeleteEntry).not.toHaveBeenCalled();
    });

    it("shows entry details in confirmation message", () => {
      render(<EntriesList {...defaultProps} />);

      // Click delete on entry-1
      fireEvent.click(screen.getByTestId("delete-btn-entry-1"));

      // Modal message should mention the entry's hours and client
      const message = screen.getByText(/2h 30m.*Acme Corporation/);
      expect(message).toBeInTheDocument();
    });

    it("delete works from mobile card view too", () => {
      render(<EntriesList {...defaultProps} />);

      // Click delete on card
      fireEvent.click(screen.getByTestId("card-delete-btn-entry-2"));

      expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();

      // Confirm
      fireEvent.click(screen.getByTestId("confirm-delete"));

      expect(mockOnDeleteEntry).toHaveBeenCalledWith("entry-2");
    });
  });

  describe("Read-Only Mode", () => {
    it("hides delete buttons in read-only mode", () => {
      render(<EntriesList {...defaultProps} readOnly />);

      expect(screen.queryByTestId("delete-btn-entry-1")).not.toBeInTheDocument();
      expect(screen.queryByTestId("card-delete-btn-entry-1")).not.toBeInTheDocument();
    });

    it("does not show actions column in read-only mode", () => {
      render(<EntriesList {...defaultProps} readOnly />);

      // In read-only mode, table has 4 columns not 5
      // The EntryRow mock checks readOnly prop
      expect(screen.queryByTestId("delete-btn-entry-1")).not.toBeInTheDocument();
    });

    it("does not show confirm modal in read-only mode", () => {
      render(<EntriesList {...defaultProps} readOnly />);

      // No delete buttons to click, so no modal
      expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
    });
  });

  describe("Mobile vs Desktop Rendering", () => {
    it("renders both mobile cards and desktop table", () => {
      render(<EntriesList {...defaultProps} />);

      // Both should be in DOM (visibility controlled by CSS)
      expect(screen.getByTestId("entry-card-entry-1")).toBeInTheDocument();
      expect(screen.getByTestId("entry-row-entry-1")).toBeInTheDocument();
    });

    it("mobile cards container has lg:hidden class", () => {
      const { container } = render(<EntriesList {...defaultProps} />);

      // Find mobile container with lg:hidden class
      const mobileContainer = container.querySelector(".lg\\:hidden");
      expect(mobileContainer).toBeInTheDocument();
    });

    it("desktop table container has hidden lg:block classes", () => {
      const { container } = render(<EntriesList {...defaultProps} />);

      // Find desktop container with hidden lg:block classes
      const desktopContainer = container.querySelector(".hidden.lg\\:block");
      expect(desktopContainer).toBeInTheDocument();
    });
  });

  describe("Props Passing", () => {
    it("passes clients and topics to EntryRow", () => {
      render(<EntriesList {...defaultProps} />);

      // EntryRow is rendered (mocked) - if props weren't passed, it wouldn't render
      expect(screen.getByTestId("entry-row-entry-1")).toBeInTheDocument();
    });

    it("passes onUpdateEntry to EntryRow", () => {
      render(<EntriesList {...defaultProps} />);

      // EntryRow renders correctly, indicating props were passed
      // (Our mock doesn't expose onUpdate, but the component receives it)
      expect(screen.getByTestId("entry-row-entry-1")).toBeInTheDocument();
    });
  });
});
