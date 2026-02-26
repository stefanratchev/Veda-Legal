import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MultiSelectFilter } from "./MultiSelectFilter";

// Mock the useClickOutside hook
vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: vi.fn(),
}));

// Mock scrollIntoView since it's not available in JSDOM
Element.prototype.scrollIntoView = vi.fn();

describe("MultiSelectFilter", () => {
  const mockOnChange = vi.fn();

  const mockOptions = [
    { id: "1", label: "Acme Corporation" },
    { id: "2", label: "Beta Industries" },
    { id: "3", label: "Gamma Solutions" },
    { id: "4", label: "Delta Corp" },
  ];

  const defaultProps = {
    options: mockOptions,
    selected: new Set<string>(),
    onChange: mockOnChange,
    label: "Clients",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders trigger button with label text", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      expect(screen.getByText("Clients")).toBeInTheDocument();
    });

    it("renders custom placeholder in search input when provided", () => {
      render(
        <MultiSelectFilter {...defaultProps} placeholder="Find clients..." />
      );

      // Open dropdown
      fireEvent.click(screen.getByText("Clients"));

      expect(
        screen.getByPlaceholderText("Find clients...")
      ).toBeInTheDocument();
    });

    it("renders default placeholder in search input when not provided", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      // Open dropdown
      fireEvent.click(screen.getByText("Clients"));

      expect(
        screen.getByPlaceholderText("Search Clients...")
      ).toBeInTheDocument();
    });
  });

  describe("Dropdown Behavior", () => {
    it("opens dropdown on trigger click showing search input and all options", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clients"));

      // Search input should be visible
      expect(
        screen.getByPlaceholderText("Search Clients...")
      ).toBeInTheDocument();

      // All options should be visible
      expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
      expect(screen.getByText("Beta Industries")).toBeInTheDocument();
      expect(screen.getByText("Gamma Solutions")).toBeInTheDocument();
      expect(screen.getByText("Delta Corp")).toBeInTheDocument();
    });

    it("closes dropdown on second trigger click", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      const trigger = screen.getByText("Clients");
      fireEvent.click(trigger);

      // Dropdown is open
      expect(
        screen.getByPlaceholderText("Search Clients...")
      ).toBeInTheDocument();

      fireEvent.click(trigger);

      // Dropdown should be closed
      expect(
        screen.queryByPlaceholderText("Search Clients...")
      ).not.toBeInTheDocument();
    });

    it("search input is focused when dropdown opens", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clients"));

      const searchInput = screen.getByPlaceholderText("Search Clients...");
      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe("Filtering", () => {
    it("filters options case-insensitively as user types in search", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clients"));

      const searchInput = screen.getByPlaceholderText("Search Clients...");
      fireEvent.change(searchInput, { target: { value: "beta" } });

      expect(screen.getByText("Beta Industries")).toBeInTheDocument();
      expect(screen.queryByText("Acme Corporation")).not.toBeInTheDocument();
      expect(screen.queryByText("Gamma Solutions")).not.toBeInTheDocument();
      expect(screen.queryByText("Delta Corp")).not.toBeInTheDocument();
    });

    it("shows 'No results' when search matches nothing", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clients"));

      const searchInput = screen.getByPlaceholderText("Search Clients...");
      fireEvent.change(searchInput, { target: { value: "XYZ Nonexistent" } });

      expect(screen.getByText("No results")).toBeInTheDocument();
    });
  });

  describe("Selection", () => {
    it("toggles checkbox on option click, calls onChange with new Set containing the id", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clients"));

      // Click on an option
      fireEvent.mouseDown(screen.getByText("Acme Corporation"));

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const calledWith = mockOnChange.mock.calls[0][0];
      expect(calledWith).toBeInstanceOf(Set);
      expect(calledWith.has("1")).toBe(true);
      expect(calledWith.size).toBe(1);
    });

    it("deselects on second click, calls onChange with new Set without the id", () => {
      const selectedSet = new Set(["1"]);
      render(
        <MultiSelectFilter {...defaultProps} selected={selectedSet} />
      );

      fireEvent.click(screen.getByText("Clients"));

      // Click on already-selected option to deselect
      fireEvent.mouseDown(screen.getByText("Acme Corporation"));

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const calledWith = mockOnChange.mock.calls[0][0];
      expect(calledWith).toBeInstanceOf(Set);
      expect(calledWith.has("1")).toBe(false);
      expect(calledWith.size).toBe(0);
    });

    it("dropdown stays open after selecting/deselecting an option", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clients"));

      // Select an option
      fireEvent.mouseDown(screen.getByText("Acme Corporation"));

      // Dropdown should still be open
      expect(
        screen.getByPlaceholderText("Search Clients...")
      ).toBeInTheDocument();
    });
  });

  describe("Active Indicators", () => {
    it("shows count badge with selected count when items are selected", () => {
      const selectedSet = new Set(["1", "2", "3"]);
      render(
        <MultiSelectFilter {...defaultProps} selected={selectedSet} />
      );

      // Count badge should show "3"
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("does not show count badge when nothing is selected", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      // Should not have any numeric badge
      const container = screen.getByTestId("multi-select-filter");
      const badges = container.querySelectorAll("[data-testid='count-badge']");
      expect(badges).toHaveLength(0);
    });

    it("trigger has accent border when selections active", () => {
      const selectedSet = new Set(["1"]);
      render(
        <MultiSelectFilter {...defaultProps} selected={selectedSet} />
      );

      const trigger = screen.getByRole("button", { name: /clients/i });
      expect(trigger.className).toContain("border-[var(--border-accent)]");
    });

    it("trigger has subtle border when no selections active", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      const trigger = screen.getByRole("button", { name: /clients/i });
      expect(trigger.className).toContain("border-[var(--border-subtle)]");
    });
  });

  describe("Keyboard Navigation", () => {
    it("ArrowDown navigates highlight forward", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clients"));

      const searchInput = screen.getByPlaceholderText("Search Clients...");

      // Navigate down
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });

      // Press Space to toggle (index 2 = Gamma Solutions)
      fireEvent.keyDown(searchInput, { key: " " });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const calledWith = mockOnChange.mock.calls[0][0];
      expect(calledWith.has("3")).toBe(true);
    });

    it("ArrowUp navigates highlight backward", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clients"));

      const searchInput = screen.getByPlaceholderText("Search Clients...");

      // Navigate down twice, then up once
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      fireEvent.keyDown(searchInput, { key: "ArrowUp" });

      // Press Space to toggle (should be back to index 1 = Beta Industries)
      fireEvent.keyDown(searchInput, { key: " " });

      expect(mockOnChange).toHaveBeenCalledWith(expect.any(Set));
      const calledWith = mockOnChange.mock.calls[0][0];
      expect(calledWith.has("2")).toBe(true);
    });

    it("Space toggles the highlighted option's checkbox", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clients"));

      const searchInput = screen.getByPlaceholderText("Search Clients...");

      // Space on first item (index 0 = Acme Corporation)
      fireEvent.keyDown(searchInput, { key: " " });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const calledWith = mockOnChange.mock.calls[0][0];
      expect(calledWith.has("1")).toBe(true);
    });

    it("Escape closes the dropdown and resets search", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clients"));

      const searchInput = screen.getByPlaceholderText("Search Clients...");
      fireEvent.change(searchInput, { target: { value: "Beta" } });

      // Press Escape
      fireEvent.keyDown(searchInput, { key: "Escape" });

      // Dropdown should be closed
      expect(
        screen.queryByPlaceholderText("Search Clients...")
      ).not.toBeInTheDocument();

      // Reopen and verify search is reset
      fireEvent.click(screen.getByText("Clients"));
      const newSearchInput = screen.getByPlaceholderText("Search Clients...");
      expect(newSearchInput).toHaveValue("");
    });

    it("highlighted index resets to 0 when search text changes", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clients"));

      const searchInput = screen.getByPlaceholderText("Search Clients...");

      // Navigate down
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });

      // Type to filter — highlight should reset
      fireEvent.change(searchInput, { target: { value: "Corp" } });

      // Space should toggle first visible item (Acme Corporation since it matches "Corp")
      fireEvent.keyDown(searchInput, { key: " " });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const calledWith = mockOnChange.mock.calls[0][0];
      // First match for "Corp" is "Acme Corporation" (id: "1")
      expect(calledWith.has("1")).toBe(true);
    });

    it("highlighted item scrolls into view", () => {
      render(<MultiSelectFilter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clients"));

      const searchInput = screen.getByPlaceholderText("Search Clients...");

      fireEvent.keyDown(searchInput, { key: "ArrowDown" });

      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });
});
