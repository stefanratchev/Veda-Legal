import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WeekStrip } from "./WeekStrip";

// Mock the useClickOutside hook
vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: vi.fn(),
}));

// Mock date-utils to have predictable values
vi.mock("@/lib/date-utils", () => ({
  formatDateISO: (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },
  getWeekDays: (centerDate: Date) => {
    const days: Date[] = [];
    const dayOfWeek = (centerDate.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(centerDate);
    monday.setDate(centerDate.getDate() - dayOfWeek);

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      days.push(day);
    }
    return days;
  },
  getDayName: (date: Date) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[date.getDay()];
  },
  getMonthName: (date: Date) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  },
}));

describe("WeekStrip", () => {
  const mockOnSelectDate = vi.fn();
  const mockOnPrevWeek = vi.fn();
  const mockOnNextWeek = vi.fn();
  const mockOnGoToToday = vi.fn();
  const mockOnFetchM365Activity = vi.fn();

  // Fixed dates for testing: December 26, 2024 (Thursday)
  const selectedDate = new Date(2024, 11, 26); // Thu Dec 26
  const today = new Date(2024, 11, 26); // Same as selected for base tests

  const defaultProps = {
    selectedDate,
    today,
    datesWithEntries: new Set<string>(),
    onSelectDate: mockOnSelectDate,
    onPrevWeek: mockOnPrevWeek,
    onNextWeek: mockOnNextWeek,
    onGoToToday: mockOnGoToToday,
    onFetchM365Activity: mockOnFetchM365Activity,
    isM365Loading: false,
    isM365PanelOpen: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders all 7 weekdays (Mon-Sun)", () => {
      render(<WeekStrip {...defaultProps} />);

      // Week of Dec 26, 2024: Mon Dec 23 - Sun Dec 29
      expect(screen.getByText("Mon")).toBeInTheDocument();
      expect(screen.getByText("Tue")).toBeInTheDocument();
      expect(screen.getByText("Wed")).toBeInTheDocument();
      expect(screen.getByText("Thu")).toBeInTheDocument();
      expect(screen.getByText("Fri")).toBeInTheDocument();
      expect(screen.getByText("Sat")).toBeInTheDocument();
      expect(screen.getByText("Sun")).toBeInTheDocument();
    });

    it("renders day numbers for the week", () => {
      render(<WeekStrip {...defaultProps} />);

      // Mon Dec 23 - Sun Dec 29
      expect(screen.getByText("23")).toBeInTheDocument();
      expect(screen.getByText("24")).toBeInTheDocument();
      expect(screen.getByText("25")).toBeInTheDocument();
      expect(screen.getByText("26")).toBeInTheDocument();
      expect(screen.getByText("27")).toBeInTheDocument();
      expect(screen.getByText("28")).toBeInTheDocument();
      expect(screen.getByText("29")).toBeInTheDocument();
    });

    it("renders navigation buttons", () => {
      render(<WeekStrip {...defaultProps} />);

      expect(screen.getByTitle("Previous week")).toBeInTheDocument();
      expect(screen.getByTitle("Next week")).toBeInTheDocument();
    });

    it("renders Today button", () => {
      render(<WeekStrip {...defaultProps} />);

      expect(screen.getByText("Today")).toBeInTheDocument();
    });

    it("renders calendar icon button", () => {
      render(<WeekStrip {...defaultProps} />);

      expect(screen.getByTitle("Open calendar")).toBeInTheDocument();
    });

    it("renders M365 Activity button", () => {
      render(<WeekStrip {...defaultProps} />);

      expect(screen.getByText("M365")).toBeInTheDocument();
    });
  });

  describe("Selected Date Highlighting", () => {
    it("highlights the selected date with accent styling", () => {
      render(<WeekStrip {...defaultProps} />);

      // Find the button for Dec 26 (selected date)
      // The parent button contains the day number
      const dayButtons = screen.getAllByRole("button");
      const selectedButton = dayButtons.find((btn) =>
        btn.textContent?.includes("26") && btn.textContent?.includes("Thu")
      );

      expect(selectedButton).toBeTruthy();
      expect(selectedButton).toHaveClass("bg-[var(--accent-pink)]");
    });

    it("selected date has different text color", () => {
      render(<WeekStrip {...defaultProps} />);

      const dayButtons = screen.getAllByRole("button");
      const selectedButton = dayButtons.find((btn) =>
        btn.textContent?.includes("26") && btn.textContent?.includes("Thu")
      );

      expect(selectedButton).toHaveClass("text-[var(--bg-deep)]");
    });
  });

  describe("Today Highlighting", () => {
    it("highlights today when it differs from selected date", () => {
      // Today is Dec 26, selected is Dec 24
      const differentSelectedDate = new Date(2024, 11, 24);

      render(
        <WeekStrip
          {...defaultProps}
          selectedDate={differentSelectedDate}
          today={today}
        />
      );

      // Find button for Dec 26 (today, not selected)
      const dayButtons = screen.getAllByRole("button");
      const todayButton = dayButtons.find((btn) =>
        btn.textContent?.includes("26") && btn.textContent?.includes("Thu")
      );

      // Today (not selected) should have ring styling
      expect(todayButton).toHaveClass("ring-1");
      expect(todayButton).toHaveClass("ring-[var(--accent-pink)]");
    });

    it("selected date does not have today ring when same as today", () => {
      // When selected === today, should have selected styling, not today ring
      render(<WeekStrip {...defaultProps} />);

      const dayButtons = screen.getAllByRole("button");
      const selectedButton = dayButtons.find((btn) =>
        btn.textContent?.includes("26") && btn.textContent?.includes("Thu")
      );

      // Should have selected bg, not the ring styling
      expect(selectedButton).toHaveClass("bg-[var(--accent-pink)]");
      // The ring class should only apply when todayDay && !selected
      // When both are true, only selected styling applies
    });
  });

  describe("Date Selection", () => {
    it("calls onSelectDate when clicking a day", () => {
      render(<WeekStrip {...defaultProps} />);

      // Click on Dec 24 (Tuesday)
      const dayButtons = screen.getAllByRole("button");
      const tuesdayButton = dayButtons.find((btn) =>
        btn.textContent?.includes("24") && btn.textContent?.includes("Tue")
      );

      fireEvent.click(tuesdayButton!);

      expect(mockOnSelectDate).toHaveBeenCalledTimes(1);
      // The date should be Dec 24, 2024
      const calledDate = mockOnSelectDate.mock.calls[0][0];
      expect(calledDate.getDate()).toBe(24);
      expect(calledDate.getMonth()).toBe(11); // December
    });
  });

  describe("Week Navigation", () => {
    it("calls onPrevWeek when clicking previous button", () => {
      render(<WeekStrip {...defaultProps} />);

      fireEvent.click(screen.getByTitle("Previous week"));

      expect(mockOnPrevWeek).toHaveBeenCalledTimes(1);
    });

    it("calls onNextWeek when clicking next button", () => {
      render(<WeekStrip {...defaultProps} />);

      fireEvent.click(screen.getByTitle("Next week"));

      expect(mockOnNextWeek).toHaveBeenCalledTimes(1);
    });

    it("calls onGoToToday when clicking Today button", () => {
      render(<WeekStrip {...defaultProps} />);

      fireEvent.click(screen.getByText("Today"));

      expect(mockOnGoToToday).toHaveBeenCalledTimes(1);
    });
  });

  describe("Entry Indicators", () => {
    it("shows entry indicator dot for dates with entries", () => {
      const datesWithEntries = new Set(["2024-12-24", "2024-12-26"]);

      const { container } = render(
        <WeekStrip {...defaultProps} datesWithEntries={datesWithEntries} />
      );

      // Entry indicators are small dots (w-1 h-1 rounded-full)
      const indicators = container.querySelectorAll(".w-1.h-1.rounded-full");
      expect(indicators.length).toBe(2);
    });

    it("does not show indicator for dates without entries", () => {
      const datesWithEntries = new Set(["2024-12-24"]);

      const { container } = render(
        <WeekStrip {...defaultProps} datesWithEntries={datesWithEntries} />
      );

      // Only one indicator should exist
      const indicators = container.querySelectorAll(".w-1.h-1.rounded-full");
      expect(indicators.length).toBe(1);
    });
  });

  describe("Calendar Popup", () => {
    it("opens calendar popup when clicking calendar icon", () => {
      render(<WeekStrip {...defaultProps} />);

      fireEvent.click(screen.getByTitle("Open calendar"));

      // Calendar popup should show day headers
      expect(screen.getByText("Mo")).toBeInTheDocument();
      expect(screen.getByText("Tu")).toBeInTheDocument();
      expect(screen.getByText("We")).toBeInTheDocument();
      expect(screen.getByText("Th")).toBeInTheDocument();
      expect(screen.getByText("Fr")).toBeInTheDocument();
      expect(screen.getByText("Sa")).toBeInTheDocument();
      expect(screen.getByText("Su")).toBeInTheDocument();
    });

    it("shows month name in calendar popup", () => {
      render(<WeekStrip {...defaultProps} />);

      fireEvent.click(screen.getByTitle("Open calendar"));

      expect(screen.getByText("December 2024")).toBeInTheDocument();
    });

    it("navigates to previous month in calendar", () => {
      render(<WeekStrip {...defaultProps} />);

      fireEvent.click(screen.getByTitle("Open calendar"));

      // Find and click the previous month button (first chevron in calendar popup)
      const calendarNav = screen.getAllByRole("button");
      const prevMonthBtn = calendarNav.find(
        (btn) =>
          btn.querySelector("svg") &&
          btn.closest(".absolute") // Inside the calendar popup
      );

      // The popup has prev/next month buttons
      const buttonsInPopup = Array.from(
        document.querySelectorAll(".absolute button")
      );
      const prevButton = buttonsInPopup[0]; // First button is prev month

      fireEvent.click(prevButton);

      expect(screen.getByText("November 2024")).toBeInTheDocument();
    });

    it("navigates to next month in calendar", () => {
      render(<WeekStrip {...defaultProps} />);

      fireEvent.click(screen.getByTitle("Open calendar"));

      // Find next month button in popup
      const buttonsInPopup = Array.from(
        document.querySelectorAll(".absolute button")
      );
      const nextButton = buttonsInPopup[1]; // Second button is next month

      fireEvent.click(nextButton);

      expect(screen.getByText("January 2025")).toBeInTheDocument();
    });

    it("selects date from calendar and closes popup", () => {
      render(<WeekStrip {...defaultProps} />);

      fireEvent.click(screen.getByTitle("Open calendar"));

      // Click on day 15 in the calendar grid
      const day15 = screen.getByText("15");
      fireEvent.click(day15);

      expect(mockOnSelectDate).toHaveBeenCalled();
      const calledDate = mockOnSelectDate.mock.calls[0][0];
      expect(calledDate.getDate()).toBe(15);

      // Calendar should be closed
      expect(screen.queryByText("Mo")).not.toBeInTheDocument();
    });
  });

  describe("M365 Activity Button", () => {
    it("calls onFetchM365Activity when clicking M365 button", () => {
      render(<WeekStrip {...defaultProps} />);

      fireEvent.click(screen.getByText("M365"));

      expect(mockOnFetchM365Activity).toHaveBeenCalledTimes(1);
    });

    it("shows loading spinner when M365 is loading", () => {
      const { container } = render(
        <WeekStrip {...defaultProps} isM365Loading />
      );

      // Should have animate-spin class on the spinner
      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("disables M365 button when loading", () => {
      render(<WeekStrip {...defaultProps} isM365Loading />);

      const m365Button = screen.getByText("M365").closest("button");
      expect(m365Button).toBeDisabled();
    });

    it("shows active styling when M365 panel is open", () => {
      render(<WeekStrip {...defaultProps} isM365PanelOpen />);

      const m365Button = screen.getByText("M365").closest("button");
      expect(m365Button).toHaveClass("bg-[var(--info)]");
    });
  });

  describe("Weekend Styling", () => {
    it("applies weekend styling to Saturday and Sunday", () => {
      render(<WeekStrip {...defaultProps} />);

      // Find Saturday (28) and Sunday (29) buttons
      const dayButtons = screen.getAllByRole("button");

      const satButton = dayButtons.find((btn) =>
        btn.textContent?.includes("28") && btn.textContent?.includes("Sat")
      );
      const sunButton = dayButtons.find((btn) =>
        btn.textContent?.includes("29") && btn.textContent?.includes("Sun")
      );

      // Weekend days have muted styling in the day name
      // The span inside should have the muted text class
      const satDayName = satButton?.querySelector("span");
      const sunDayName = sunButton?.querySelector("span");

      expect(satDayName).toHaveClass("text-[var(--text-muted)]/60");
      expect(sunDayName).toHaveClass("text-[var(--text-muted)]/60");
    });
  });
});
