import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DurationPicker, DurationPickerRef } from "./DurationPicker";
import { createRef } from "react";

// Mock the useClickOutside hook
vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: vi.fn(),
}));

describe("DurationPicker", () => {
  const mockOnChange = vi.fn();

  const defaultProps = {
    hours: 2,
    minutes: 30,
    onChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Display Format", () => {
    it("renders with initial value showing hours and minutes", () => {
      render(<DurationPicker {...defaultProps} />);

      expect(screen.getByText("2h 30m")).toBeInTheDocument();
    });

    it("renders hours only when minutes is 0", () => {
      render(<DurationPicker {...defaultProps} hours={3} minutes={0} />);

      expect(screen.getByText("3h")).toBeInTheDocument();
    });

    it("renders minutes only when hours is 0", () => {
      render(<DurationPicker {...defaultProps} hours={0} minutes={45} />);

      expect(screen.getByText("45m")).toBeInTheDocument();
    });

    it("renders 0h 0m when both are zero", () => {
      render(<DurationPicker {...defaultProps} hours={0} minutes={0} />);

      expect(screen.getByText("0h 0m")).toBeInTheDocument();
    });
  });

  describe("Dropdown Behavior", () => {
    it("opens dropdown on click", () => {
      render(<DurationPicker {...defaultProps} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      // Should show hours selection first
      expect(screen.getByText("Select hours")).toBeInTheDocument();
    });

    it("closes dropdown on second click", () => {
      render(<DurationPicker {...defaultProps} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);
      fireEvent.click(button);

      expect(screen.queryByText("Select hours")).not.toBeInTheDocument();
    });

    it("does not open when disabled", () => {
      render(<DurationPicker {...defaultProps} disabled />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();

      fireEvent.click(button);

      expect(screen.queryByText("Select hours")).not.toBeInTheDocument();
    });
  });

  describe("Hour Selection", () => {
    it("displays hour options 0-9", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      // Check all hour buttons are present (0-9)
      for (let h = 0; h <= 9; h++) {
        expect(
          screen.getByRole("button", { name: h.toString() })
        ).toBeInTheDocument();
      }
    });

    it("advances to minutes step after selecting hours", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      // Select 3 hours
      fireEvent.click(screen.getByRole("button", { name: "3" }));

      // Should now show minutes selection
      expect(screen.getByText(/3h.*Select minutes/)).toBeInTheDocument();
    });
  });

  describe("Minute Selection", () => {
    it("displays minute options 00, 15, 30, 45", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      // Select hours first
      fireEvent.click(screen.getByRole("button", { name: "2" }));

      // Check minute options
      expect(screen.getByRole("button", { name: "00" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "15" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "30" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "45" })).toBeInTheDocument();
    });

    it("calls onChange with correct values after selecting minutes", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      // Select 4 hours
      fireEvent.click(screen.getByRole("button", { name: "4" }));

      // Select 15 minutes
      fireEvent.click(screen.getByRole("button", { name: "15" }));

      expect(mockOnChange).toHaveBeenCalledWith(4, 15);
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it("closes dropdown after minute selection", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button", { name: "1" }));
      fireEvent.click(screen.getByRole("button", { name: "30" }));

      // Dropdown should be closed
      expect(screen.queryByText("Select hours")).not.toBeInTheDocument();
      expect(screen.queryByText("Select minutes")).not.toBeInTheDocument();
    });
  });

  describe("Back Navigation", () => {
    it("allows going back from minutes to hours", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      // Select hours
      fireEvent.click(screen.getByRole("button", { name: "5" }));

      // Should be on minutes step
      expect(screen.getByText(/Select minutes/)).toBeInTheDocument();

      // Click back button (the arrow button)
      const backButton = screen.getByRole("button", { name: "" });
      fireEvent.click(backButton);

      // Should be back on hours step
      expect(screen.getByText("Select hours")).toBeInTheDocument();
    });
  });

  describe("Keyboard Navigation", () => {
    it("closes dropdown on Escape from hours step", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      // Dropdown panel receives focus
      const dropdown = document.querySelector("[tabindex='-1']");
      expect(dropdown).toBeTruthy();

      fireEvent.keyDown(dropdown as HTMLElement, { key: "Escape" });

      expect(screen.queryByText("Select hours")).not.toBeInTheDocument();
    });

    it("goes back to hours on Escape from minutes step", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button", { name: "3" }));

      // Now on minutes step
      expect(screen.getByText(/Select minutes/)).toBeInTheDocument();

      const dropdown = document.querySelector("[tabindex='-1']");
      fireEvent.keyDown(dropdown as HTMLElement, { key: "Escape" });

      // Should be back on hours step
      expect(screen.getByText("Select hours")).toBeInTheDocument();
    });

    it("selects hour with Enter key", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const dropdown = document.querySelector("[tabindex='-1']");

      // Default highlight is index 0 (hour 1)
      fireEvent.keyDown(dropdown as HTMLElement, { key: "Enter" });

      // Should advance to minutes step with hour 1 selected
      expect(screen.getByText(/1h.*Select minutes/)).toBeInTheDocument();
    });

    it("navigates hours grid with arrow keys", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const dropdown = document.querySelector("[tabindex='-1']");

      // Move right (from 1 to 2), then down (from 2 to 5)
      fireEvent.keyDown(dropdown as HTMLElement, { key: "ArrowRight" });
      fireEvent.keyDown(dropdown as HTMLElement, { key: "ArrowDown" });

      // Select with Enter (should be 5)
      fireEvent.keyDown(dropdown as HTMLElement, { key: "Enter" });

      expect(screen.getByText(/5h.*Select minutes/)).toBeInTheDocument();
    });

    it("navigates minutes row with arrow keys and selects", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button", { name: "2" }));

      const dropdown = document.querySelector("[tabindex='-1']");

      // Move right twice (from 00 to 30)
      fireEvent.keyDown(dropdown as HTMLElement, { key: "ArrowRight" });
      fireEvent.keyDown(dropdown as HTMLElement, { key: "ArrowRight" });

      // Select with Enter
      fireEvent.keyDown(dropdown as HTMLElement, { key: "Enter" });

      expect(mockOnChange).toHaveBeenCalledWith(2, 30);
    });
  });

  describe("Imperative Handle", () => {
    it("opens picker via ref.open()", () => {
      const ref = createRef<DurationPickerRef>();

      render(<DurationPicker {...defaultProps} ref={ref} />);

      // Call open() via ref - wrap in act since it updates state
      act(() => {
        ref.current?.open();
      });

      // Should show hours selection
      expect(screen.getByText("Select hours")).toBeInTheDocument();
    });

    it("does not open via ref when disabled", () => {
      const ref = createRef<DurationPickerRef>();

      render(<DurationPicker {...defaultProps} ref={ref} disabled />);

      act(() => {
        ref.current?.open();
      });

      expect(screen.queryByText("Select hours")).not.toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles selecting 0 hours correctly", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button", { name: "0" }));
      fireEvent.click(screen.getByRole("button", { name: "45" }));

      expect(mockOnChange).toHaveBeenCalledWith(0, 45);
    });

    it("handles selecting 0 minutes correctly", () => {
      render(<DurationPicker {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button", { name: "8" }));
      fireEvent.click(screen.getByRole("button", { name: "00" }));

      expect(mockOnChange).toHaveBeenCalledWith(8, 0);
    });

    it("resets to hours step when reopened", () => {
      render(<DurationPicker {...defaultProps} />);

      // Open and go to minutes
      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button", { name: "2" }));

      // Close by clicking trigger again
      fireEvent.click(screen.getByText("2h 30m"));

      // Reopen
      fireEvent.click(screen.getByRole("button"));

      // Should be back at hours step
      expect(screen.getByText("Select hours")).toBeInTheDocument();
    });
  });
});
