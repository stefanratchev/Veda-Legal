import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { M365ActivityPanel } from "./M365ActivityPanel";
import type { M365ActivityResponse } from "@/types";

describe("M365ActivityPanel", () => {
  const mockOnClose = vi.fn();
  const testDate = "2024-12-20";

  const mockCalendarEvents = [
    {
      subject: "Client Meeting",
      start: "2024-12-20T10:00:00.000Z",
      durationMinutes: 60,
      attendees: ["John Doe", "Jane Smith"],
    },
    {
      subject: "Team Standup",
      start: "2024-12-20T09:00:00.000Z",
      durationMinutes: 30,
      attendees: [],
    },
  ];

  const mockEmails = [
    {
      subject: "Re: Contract Review",
      timestamp: "2024-12-20T14:30:00.000Z",
      from: "Client A",
      to: ["Test User"],
      direction: "received" as const,
    },
    {
      subject: "Invoice Attached",
      timestamp: "2024-12-20T16:00:00.000Z",
      from: "Test User",
      to: ["Client B", "Client C"],
      direction: "sent" as const,
    },
  ];

  const mockData: M365ActivityResponse = {
    calendar: mockCalendarEvents,
    emails: mockEmails,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Calendar Events", () => {
    it("renders calendar events with subject, time, duration, and attendees", () => {
      render(
        <M365ActivityPanel
          data={mockData}
          isLoading={false}
          error={null}
          onClose={mockOnClose}
          date={testDate}
        />
      );

      // Check calendar event subjects are displayed
      expect(screen.getByText("Client Meeting")).toBeInTheDocument();
      expect(screen.getByText("Team Standup")).toBeInTheDocument();

      // Check duration is displayed (60 min = 1h or 60 min, 30 min)
      expect(screen.getByText(/60\s*min|1\s*h/i)).toBeInTheDocument();
      expect(screen.getByText(/30\s*min/i)).toBeInTheDocument();

      // Check attendees are displayed
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    });
  });

  describe("Sent Emails", () => {
    it("renders sent emails with arrow up icon and recipients", () => {
      render(
        <M365ActivityPanel
          data={mockData}
          isLoading={false}
          error={null}
          onClose={mockOnClose}
          date={testDate}
        />
      );

      // Check sent email subject is displayed
      expect(screen.getByText("Invoice Attached")).toBeInTheDocument();

      // Check recipients are displayed for sent email
      expect(screen.getByText(/Client B/)).toBeInTheDocument();

      // Verify there's an upward arrow SVG or indicator for sent emails
      const arrowUpIcon = screen.getByTestId("arrow-up-icon");
      expect(arrowUpIcon).toBeInTheDocument();
    });
  });

  describe("Received Emails", () => {
    it("renders received emails with arrow down icon and sender", () => {
      render(
        <M365ActivityPanel
          data={mockData}
          isLoading={false}
          error={null}
          onClose={mockOnClose}
          date={testDate}
        />
      );

      // Check received email subject is displayed
      expect(screen.getByText("Re: Contract Review")).toBeInTheDocument();

      // Check sender is displayed for received email
      expect(screen.getByText(/Client A/)).toBeInTheDocument();

      // Verify there's a downward arrow SVG or indicator for received emails
      const arrowDownIcon = screen.getByTestId("arrow-down-icon");
      expect(arrowDownIcon).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("shows loading state while fetching", () => {
      render(
        <M365ActivityPanel
          data={null}
          isLoading={true}
          error={null}
          onClose={mockOnClose}
          date={testDate}
        />
      );

      // Should show loading indicator - either text or a spinner element
      const loadingText = screen.queryByText(/loading/i);
      const loadingSpinner = screen.queryByTestId("loading-spinner");

      expect(loadingText || loadingSpinner).toBeTruthy();
    });
  });

  describe("Error State", () => {
    it("shows error message on failure", () => {
      const errorMessage = "Failed to fetch M365 activity data";

      render(
        <M365ActivityPanel
          data={null}
          isLoading={false}
          error={errorMessage}
          onClose={mockOnClose}
          date={testDate}
        />
      );

      // Should display the error message
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows empty state when no data", () => {
      const emptyData: M365ActivityResponse = {
        calendar: [],
        emails: [],
      };

      render(
        <M365ActivityPanel
          data={emptyData}
          isLoading={false}
          error={null}
          onClose={mockOnClose}
          date={testDate}
        />
      );

      // Should show empty state message
      const emptyText = screen.queryByText(/no activity/i) ||
        screen.queryByText(/no events/i) ||
        screen.queryByText(/nothing to show/i);

      expect(emptyText).toBeTruthy();
    });
  });

  describe("Close Button", () => {
    it("calls onClose when close button is clicked", () => {
      render(
        <M365ActivityPanel
          data={mockData}
          isLoading={false}
          error={null}
          onClose={mockOnClose}
          date={testDate}
        />
      );

      // Find close button - try multiple query strategies
      const closeButton =
        screen.queryByRole("button", { name: /close/i }) ||
        screen.queryByLabelText(/close/i) ||
        screen.queryByTestId("close-button");

      expect(closeButton).toBeTruthy();
      fireEvent.click(closeButton as HTMLElement);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Date Display", () => {
    it("displays the date in the panel header", () => {
      render(
        <M365ActivityPanel
          data={mockData}
          isLoading={false}
          error={null}
          onClose={mockOnClose}
          date={testDate}
        />
      );

      // Should show the date or formatted version of it
      // The date could be displayed as "Dec 20, 2024", "2024-12-20", "December 20", etc.
      const dateText =
        screen.queryByText(/Dec.*20/i) ||
        screen.queryByText(/20.*Dec/i) ||
        screen.queryByText(/2024-12-20/) ||
        screen.queryByText(/December 20/i);

      expect(dateText).toBeTruthy();
    });
  });

  describe("Section Headers", () => {
    it("displays section headers for calendar and emails", () => {
      render(
        <M365ActivityPanel
          data={mockData}
          isLoading={false}
          error={null}
          onClose={mockOnClose}
          date={testDate}
        />
      );

      // Should have section headers for calendar and emails
      const calendarHeader =
        screen.queryByText(/calendar/i) ||
        screen.queryByText(/meetings/i) ||
        screen.queryByText(/events/i);
      expect(calendarHeader).toBeTruthy();

      const emailHeader =
        screen.queryByText(/email/i) ||
        screen.queryByText(/messages/i);
      expect(emailHeader).toBeTruthy();
    });
  });
});
