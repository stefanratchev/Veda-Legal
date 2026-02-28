import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateRangePicker, getDateRange, DateRange } from "./DateRangePicker";

// Mock useClickOutside
vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: vi.fn(),
}));

describe("DateRangePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set current date to 2026-02-15
    vi.setSystemTime(new Date(2026, 1, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getDateRange helper", () => {
    it("returns first and last day of current month for this-month", () => {
      const range = getDateRange("this-month");
      expect(range.from).toBe("2026-02-01");
      expect(range.to).toBe("2026-02-28");
    });

    it("returns first and last day of previous month for last-month", () => {
      const range = getDateRange("last-month");
      expect(range.from).toBe("2026-01-01");
      expect(range.to).toBe("2026-01-31");
    });

    it("returns null dates for all-time", () => {
      const range = getDateRange("all-time");
      expect(range.from).toBeNull();
      expect(range.to).toBeNull();
    });

    it("handles month boundary correctly (e.g., January -> December)", () => {
      vi.setSystemTime(new Date(2026, 0, 10)); // January 2026
      const range = getDateRange("last-month");
      expect(range.from).toBe("2025-12-01");
      expect(range.to).toBe("2025-12-31");
    });

    it("handles leap year February correctly", () => {
      vi.setSystemTime(new Date(2024, 2, 15)); // March 2024 (leap year)
      const range = getDateRange("last-month");
      expect(range.from).toBe("2024-02-01");
      expect(range.to).toBe("2024-02-29");
    });
  });

  describe("trigger label", () => {
    it("renders 'This Month' for this-month preset", () => {
      const value: DateRange = { preset: "this-month", from: "2026-02-01", to: "2026-02-28" };
      render(<DateRangePicker value={value} onChange={vi.fn()} />);
      expect(screen.getByText("This Month")).toBeInTheDocument();
    });

    it("renders 'Last Month' for last-month preset", () => {
      const value: DateRange = { preset: "last-month", from: "2026-01-01", to: "2026-01-31" };
      render(<DateRangePicker value={value} onChange={vi.fn()} />);
      expect(screen.getByText("Last Month")).toBeInTheDocument();
    });

    it("renders 'All Time' for all-time preset", () => {
      const value: DateRange = { preset: "all-time", from: null, to: null };
      render(<DateRangePicker value={value} onChange={vi.fn()} />);
      expect(screen.getByText("All Time")).toBeInTheDocument();
    });

    it("renders formatted date range for custom preset", () => {
      const value: DateRange = { preset: "custom", from: "2026-01-15", to: "2026-02-15" };
      render(<DateRangePicker value={value} onChange={vi.fn()} />);
      expect(screen.getByText("15 Jan - 15 Feb")).toBeInTheDocument();
    });

    it("renders 'Custom Range' when custom preset has no dates", () => {
      const value: DateRange = { preset: "custom", from: null, to: null };
      render(<DateRangePicker value={value} onChange={vi.fn()} />);
      expect(screen.getByText("Custom Range")).toBeInTheDocument();
    });
  });

  describe("dropdown behavior", () => {
    it("shows all 4 preset options when dropdown is opened", () => {
      const value: DateRange = { preset: "this-month", from: "2026-02-01", to: "2026-02-28" };
      render(<DateRangePicker value={value} onChange={vi.fn()} />);

      // Open dropdown
      fireEvent.click(screen.getByRole("button", { name: /This Month/i }));

      // Should see all presets + Custom Range — use getAllByText for "This Month" since it's in both trigger and dropdown
      const thisMonthElements = screen.getAllByText("This Month");
      expect(thisMonthElements.length).toBeGreaterThanOrEqual(2); // trigger + dropdown option
      expect(screen.getByText("Last Month")).toBeInTheDocument();
      expect(screen.getByText("All Time")).toBeInTheDocument();
      expect(screen.getByText("Custom Range")).toBeInTheDocument();
    });

    it("does not show dropdown when closed", () => {
      const value: DateRange = { preset: "this-month", from: "2026-02-01", to: "2026-02-28" };
      render(<DateRangePicker value={value} onChange={vi.fn()} />);

      // Dropdown should not show "All Time" option (it's not the trigger label)
      expect(screen.queryByText("All Time")).not.toBeInTheDocument();
    });
  });

  describe("preset selection", () => {
    it("calls onChange with correct DateRange when clicking Last Month", () => {
      const onChange = vi.fn();
      const value: DateRange = { preset: "this-month", from: "2026-02-01", to: "2026-02-28" };
      render(<DateRangePicker value={value} onChange={onChange} />);

      // Open dropdown
      fireEvent.click(screen.getByRole("button", { name: /This Month/i }));
      // Click Last Month
      fireEvent.click(screen.getByText("Last Month"));

      expect(onChange).toHaveBeenCalledWith({
        preset: "last-month",
        from: "2026-01-01",
        to: "2026-01-31",
      });
    });

    it("calls onChange with null dates for All Time", () => {
      const onChange = vi.fn();
      const value: DateRange = { preset: "this-month", from: "2026-02-01", to: "2026-02-28" };
      render(<DateRangePicker value={value} onChange={onChange} />);

      fireEvent.click(screen.getByRole("button", { name: /This Month/i }));
      fireEvent.click(screen.getByText("All Time"));

      expect(onChange).toHaveBeenCalledWith({
        preset: "all-time",
        from: null,
        to: null,
      });
    });
  });

  describe("custom range", () => {
    it("shows date inputs when Custom Range is selected", () => {
      const value: DateRange = { preset: "custom", from: "2026-01-01", to: "2026-02-28" };
      render(<DateRangePicker value={value} onChange={vi.fn()} />);

      // Open dropdown
      fireEvent.click(screen.getByRole("button", { name: /1 Jan - 28 Feb/i }));

      // Date inputs should be visible
      expect(screen.getByLabelText("From")).toBeInTheDocument();
      expect(screen.getByLabelText("To")).toBeInTheDocument();
    });

    it("calls onChange when custom from date changes", () => {
      const onChange = vi.fn();
      const value: DateRange = { preset: "custom", from: "2026-01-01", to: "2026-02-28" };
      render(<DateRangePicker value={value} onChange={onChange} />);

      // Open dropdown
      fireEvent.click(screen.getByRole("button", { name: /1 Jan - 28 Feb/i }));

      // Change from date
      fireEvent.change(screen.getByLabelText("From"), {
        target: { value: "2026-01-15" },
      });

      expect(onChange).toHaveBeenCalledWith({
        preset: "custom",
        from: "2026-01-15",
        to: "2026-02-28",
      });
    });

    it("calls onChange when custom to date changes", () => {
      const onChange = vi.fn();
      const value: DateRange = { preset: "custom", from: "2026-01-01", to: "2026-02-28" };
      render(<DateRangePicker value={value} onChange={onChange} />);

      // Open dropdown
      fireEvent.click(screen.getByRole("button", { name: /1 Jan - 28 Feb/i }));

      // Change to date
      fireEvent.change(screen.getByLabelText("To"), {
        target: { value: "2026-03-15" },
      });

      expect(onChange).toHaveBeenCalledWith({
        preset: "custom",
        from: "2026-01-01",
        to: "2026-03-15",
      });
    });

    it("does not show date inputs for non-custom presets", () => {
      const value: DateRange = { preset: "this-month", from: "2026-02-01", to: "2026-02-28" };
      render(<DateRangePicker value={value} onChange={vi.fn()} />);

      // Open dropdown
      fireEvent.click(screen.getByRole("button", { name: /This Month/i }));

      // Date inputs should not be visible
      expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("To")).not.toBeInTheDocument();
    });
  });
});
