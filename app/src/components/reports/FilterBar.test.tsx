import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterBar } from "./FilterBar";
import type { FilterState } from "./FilterBar";

// Mock the useClickOutside hook (required by MultiSelectFilter)
vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: vi.fn(),
}));

// Mock scrollIntoView since it's not available in JSDOM
Element.prototype.scrollIntoView = vi.fn();

describe("FilterBar", () => {
  const mockOnChange = vi.fn();

  const mockClients = [
    { id: "c1", label: "Acme Corp" },
    { id: "c2", label: "Beta Inc" },
  ];

  const mockEmployees = [
    { id: "e1", label: "Alice Smith" },
    { id: "e2", label: "Bob Jones" },
  ];

  const mockTopics = [
    { id: "Company Incorporation", label: "Company Incorporation" },
    { id: "M&A Advisory", label: "M&A Advisory" },
  ];

  const emptyFilters: FilterState = {
    clientIds: new Set<string>(),
    employeeIds: new Set<string>(),
    topicNames: new Set<string>(),
  };

  const defaultProps = {
    clients: mockClients,
    employees: mockEmployees,
    topics: mockTopics,
    filters: emptyFilters,
    onChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders three MultiSelectFilter triggers with labels 'Clients', 'Employees', 'Topics'", () => {
      render(<FilterBar {...defaultProps} />);

      expect(screen.getByText("Clients")).toBeInTheDocument();
      expect(screen.getByText("Employees")).toBeInTheDocument();
      expect(screen.getByText("Topics")).toBeInTheDocument();
    });

    it("passes correct options to each MultiSelectFilter instance", () => {
      render(<FilterBar {...defaultProps} />);

      // Open Clients dropdown and verify options
      fireEvent.click(screen.getByText("Clients"));
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("Beta Inc")).toBeInTheDocument();
    });
  });

  describe("Clear All", () => {
    it("does not show 'Clear all' when no filters are active", () => {
      render(<FilterBar {...defaultProps} />);

      expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
    });

    it("shows 'Clear all' when at least one filter is active", () => {
      const activeFilters: FilterState = {
        clientIds: new Set(["c1"]),
        employeeIds: new Set<string>(),
        topicNames: new Set<string>(),
      };

      render(<FilterBar {...defaultProps} filters={activeFilters} />);

      expect(screen.getByText("Clear all")).toBeInTheDocument();
    });

    it("clicking 'Clear all' calls onChange with all three Sets empty", () => {
      const activeFilters: FilterState = {
        clientIds: new Set(["c1"]),
        employeeIds: new Set(["e1", "e2"]),
        topicNames: new Set(["Company Incorporation"]),
      };

      render(<FilterBar {...defaultProps} filters={activeFilters} />);

      fireEvent.click(screen.getByText("Clear all"));

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const calledWith = mockOnChange.mock.calls[0][0] as FilterState;
      expect(calledWith.clientIds.size).toBe(0);
      expect(calledWith.employeeIds.size).toBe(0);
      expect(calledWith.topicNames.size).toBe(0);
    });
  });

  describe("Individual Filter Changes", () => {
    it("changing a single filter calls onChange with updated clientIds and unchanged employeeIds/topicNames", () => {
      render(<FilterBar {...defaultProps} />);

      // Open Clients dropdown
      fireEvent.click(screen.getByText("Clients"));

      // Select Acme Corp
      fireEvent.mouseDown(screen.getByText("Acme Corp"));

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const calledWith = mockOnChange.mock.calls[0][0] as FilterState;
      expect(calledWith.clientIds.has("c1")).toBe(true);
      expect(calledWith.clientIds.size).toBe(1);
      expect(calledWith.employeeIds.size).toBe(0);
      expect(calledWith.topicNames.size).toBe(0);
    });
  });
});
