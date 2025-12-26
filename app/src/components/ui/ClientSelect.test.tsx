import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientSelect } from "./ClientSelect";

// Mock the useClickOutside hook
vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: vi.fn(),
}));

// Mock scrollIntoView since it's not available in JSDOM
Element.prototype.scrollIntoView = vi.fn();

describe("ClientSelect", () => {
  const mockOnChange = vi.fn();

  const mockClients = [
    { id: "1", name: "Acme Corporation" },
    { id: "2", name: "Beta Industries" },
    { id: "3", name: "Gamma Solutions" },
    { id: "4", name: "Delta Corp" },
  ];

  const defaultProps = {
    clients: mockClients,
    value: "",
    onChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders with default placeholder when no value", () => {
      render(<ClientSelect {...defaultProps} />);

      expect(screen.getByText("Select client...")).toBeInTheDocument();
    });

    it("renders with custom placeholder when provided", () => {
      render(
        <ClientSelect {...defaultProps} placeholder="Choose a client" />
      );

      expect(screen.getByText("Choose a client")).toBeInTheDocument();
    });

    it("displays selected client name when value is set", () => {
      render(<ClientSelect {...defaultProps} value="2" />);

      expect(screen.getByText("Beta Industries")).toBeInTheDocument();
    });

    it("renders disabled state correctly", () => {
      render(<ClientSelect {...defaultProps} disabled />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });

  describe("Dropdown Behavior", () => {
    it("opens dropdown on click", () => {
      render(<ClientSelect {...defaultProps} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      // Search input should be visible when dropdown is open
      expect(
        screen.getByPlaceholderText("Search clients...")
      ).toBeInTheDocument();

      // All clients should be visible
      expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
      expect(screen.getByText("Beta Industries")).toBeInTheDocument();
      expect(screen.getByText("Gamma Solutions")).toBeInTheDocument();
      expect(screen.getByText("Delta Corp")).toBeInTheDocument();
    });

    it("closes dropdown on second click", () => {
      render(<ClientSelect {...defaultProps} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      // Dropdown is open
      expect(
        screen.getByPlaceholderText("Search clients...")
      ).toBeInTheDocument();

      fireEvent.click(button);

      // Dropdown should be closed
      expect(
        screen.queryByPlaceholderText("Search clients...")
      ).not.toBeInTheDocument();
    });

    it("does not open dropdown when disabled", () => {
      render(<ClientSelect {...defaultProps} disabled />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(
        screen.queryByPlaceholderText("Search clients...")
      ).not.toBeInTheDocument();
    });
  });

  describe("Filtering", () => {
    it("filters clients as user types", () => {
      render(<ClientSelect {...defaultProps} />);

      // Open dropdown
      fireEvent.click(screen.getByRole("button"));

      // Type in search
      const searchInput = screen.getByPlaceholderText("Search clients...");
      fireEvent.change(searchInput, { target: { value: "Beta" } });

      // Only Beta Industries should be visible
      expect(screen.getByText("Beta Industries")).toBeInTheDocument();
      expect(screen.queryByText("Acme Corporation")).not.toBeInTheDocument();
      expect(screen.queryByText("Gamma Solutions")).not.toBeInTheDocument();
    });

    it("filters case-insensitively", () => {
      render(<ClientSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const searchInput = screen.getByPlaceholderText("Search clients...");
      fireEvent.change(searchInput, { target: { value: "CORP" } });

      // Both "Acme Corporation" and "Delta Corp" contain "corp"
      expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
      expect(screen.getByText("Delta Corp")).toBeInTheDocument();
      expect(screen.queryByText("Beta Industries")).not.toBeInTheDocument();
    });

    it("shows empty state when no matches", () => {
      render(<ClientSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const searchInput = screen.getByPlaceholderText("Search clients...");
      fireEvent.change(searchInput, { target: { value: "XYZ Nonexistent" } });

      expect(screen.getByText("No clients found")).toBeInTheDocument();
    });
  });

  describe("Selection", () => {
    it("selects client and calls onChange", () => {
      render(<ClientSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      // Click on a client
      const clientOption = screen.getByText("Gamma Solutions");
      fireEvent.click(clientOption);

      expect(mockOnChange).toHaveBeenCalledWith("3");
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it("closes dropdown after selection", () => {
      render(<ClientSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Acme Corporation"));

      // Dropdown should be closed
      expect(
        screen.queryByPlaceholderText("Search clients...")
      ).not.toBeInTheDocument();
    });

    it("clears search after selection", () => {
      render(<ClientSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const searchInput = screen.getByPlaceholderText("Search clients...");
      fireEvent.change(searchInput, { target: { value: "Acme" } });
      fireEvent.click(screen.getByText("Acme Corporation"));

      // Reopen dropdown
      fireEvent.click(screen.getByRole("button"));

      // Search should be cleared - all clients visible
      expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
      expect(screen.getByText("Beta Industries")).toBeInTheDocument();
    });
  });

  describe("Keyboard Navigation", () => {
    it("closes dropdown on Escape key", () => {
      render(<ClientSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      // Dropdown should be open
      expect(
        screen.getByPlaceholderText("Search clients...")
      ).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(
        screen.getByPlaceholderText("Search clients..."),
        { key: "Escape" }
      );

      // Dropdown should be closed
      expect(
        screen.queryByPlaceholderText("Search clients...")
      ).not.toBeInTheDocument();
    });

    it("navigates with arrow keys and selects with Enter", () => {
      render(<ClientSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const searchInput = screen.getByPlaceholderText("Search clients...");

      // Navigate down
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });

      // Press Enter to select (index 2 = Gamma Solutions)
      fireEvent.keyDown(searchInput, { key: "Enter" });

      expect(mockOnChange).toHaveBeenCalledWith("3");
    });

    it("navigates up with arrow key", () => {
      render(<ClientSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const searchInput = screen.getByPlaceholderText("Search clients...");

      // Navigate down twice, then up once
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      fireEvent.keyDown(searchInput, { key: "ArrowUp" });

      // Press Enter to select (should be back to index 1 = Beta Industries)
      fireEvent.keyDown(searchInput, { key: "Enter" });

      expect(mockOnChange).toHaveBeenCalledWith("2");
    });
  });

  describe("Empty Client List", () => {
    it("shows empty state when clients array is empty", () => {
      render(<ClientSelect {...defaultProps} clients={[]} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("No clients found")).toBeInTheDocument();
    });
  });
});
