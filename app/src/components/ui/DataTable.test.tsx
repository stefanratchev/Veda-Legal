import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DataTable } from "./DataTable";
import { ColumnDef } from "./table-types";

describe("DataTable", () => {
  interface TestData {
    id: string;
    name: string;
    email: string;
    age: number;
    status: string;
  }

  const mockData: TestData[] = [
    { id: "1", name: "Alice Smith", email: "alice@example.com", age: 30, status: "active" },
    { id: "2", name: "Bob Jones", email: "bob@example.com", age: 25, status: "inactive" },
    { id: "3", name: "Charlie Brown", email: "charlie@example.com", age: 35, status: "active" },
    { id: "4", name: "Diana Prince", email: "diana@example.com", age: 28, status: "active" },
    { id: "5", name: "Eve Wilson", email: "eve@example.com", age: 32, status: "inactive" },
  ];

  const columns: ColumnDef<TestData>[] = [
    {
      id: "name",
      header: "Name",
      accessor: (row) => row.name,
    },
    {
      id: "email",
      header: "Email",
      accessor: (row) => row.email,
    },
    {
      id: "age",
      header: "Age",
      accessor: (row) => row.age,
      align: "right",
    },
    {
      id: "status",
      header: "Status",
      accessor: (row) => row.status,
      sortable: false,
    },
  ];

  const defaultProps = {
    data: mockData,
    columns,
    getRowKey: (row: TestData) => row.id,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders column headers", () => {
      render(<DataTable {...defaultProps} />);

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("Age")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
    });

    it("renders rows from data", () => {
      render(<DataTable {...defaultProps} />);

      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
      expect(screen.getByText("30")).toBeInTheDocument();

      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      expect(screen.getByText("25")).toBeInTheDocument();
    });

    it("displays empty state when data is empty", () => {
      render(<DataTable {...defaultProps} data={[]} />);

      expect(screen.getByText("No data")).toBeInTheDocument();
    });

    it("displays custom empty message", () => {
      render(
        <DataTable {...defaultProps} data={[]} emptyMessage="No records found" />
      );

      expect(screen.getByText("No records found")).toBeInTheDocument();
    });

    it("displays empty icon when provided", () => {
      const emptyIcon = <span data-testid="empty-icon">Icon</span>;
      render(<DataTable {...defaultProps} data={[]} emptyIcon={emptyIcon} />);

      expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
    });
  });

  describe("Custom Cell Renderers", () => {
    it("uses custom cell renderer when provided", () => {
      const columnsWithCustomCell: ColumnDef<TestData>[] = [
        ...columns.slice(0, 3),
        {
          id: "status",
          header: "Status",
          accessor: (row) => row.status,
          cell: (row) => (
            <span
              data-testid={`status-badge-${row.id}`}
              className={row.status === "active" ? "text-green" : "text-red"}
            >
              {row.status.toUpperCase()}
            </span>
          ),
        },
      ];

      render(<DataTable {...defaultProps} columns={columnsWithCustomCell} />);

      expect(screen.getByTestId("status-badge-1")).toHaveTextContent("ACTIVE");
      expect(screen.getByTestId("status-badge-2")).toHaveTextContent("INACTIVE");
    });
  });

  describe("Sorting", () => {
    it("sorts ascending on first click of column header", () => {
      render(<DataTable {...defaultProps} />);

      // Click Name header to sort
      const nameHeader = screen.getByRole("button", { name: /name/i });
      fireEvent.click(nameHeader);

      // Get all name cells (they should be sorted alphabetically)
      const rows = screen.getAllByRole("row").slice(1); // Skip header row
      const names = rows.map((row) => within(row).getAllByRole("cell")[0].textContent);

      expect(names).toEqual([
        "Alice Smith",
        "Bob Jones",
        "Charlie Brown",
        "Diana Prince",
        "Eve Wilson",
      ]);
    });

    it("sorts descending on second click of same column", () => {
      render(<DataTable {...defaultProps} />);

      const nameHeader = screen.getByRole("button", { name: /name/i });

      // First click - ascending
      fireEvent.click(nameHeader);

      // Second click - descending
      fireEvent.click(nameHeader);

      const rows = screen.getAllByRole("row").slice(1);
      const names = rows.map((row) => within(row).getAllByRole("cell")[0].textContent);

      expect(names).toEqual([
        "Eve Wilson",
        "Diana Prince",
        "Charlie Brown",
        "Bob Jones",
        "Alice Smith",
      ]);
    });

    it("clears sort on third click of same column", () => {
      render(<DataTable {...defaultProps} />);

      const nameHeader = screen.getByRole("button", { name: /name/i });

      // Click three times to cycle through asc -> desc -> unsorted
      fireEvent.click(nameHeader);
      fireEvent.click(nameHeader);
      fireEvent.click(nameHeader);

      // Should return to original order
      const rows = screen.getAllByRole("row").slice(1);
      const names = rows.map((row) => within(row).getAllByRole("cell")[0].textContent);

      expect(names).toEqual([
        "Alice Smith",
        "Bob Jones",
        "Charlie Brown",
        "Diana Prince",
        "Eve Wilson",
      ]);
    });

    it("sorts numeric columns correctly", () => {
      render(<DataTable {...defaultProps} />);

      const ageHeader = screen.getByRole("button", { name: /age/i });
      fireEvent.click(ageHeader);

      const rows = screen.getAllByRole("row").slice(1);
      const ages = rows.map((row) => within(row).getAllByRole("cell")[2].textContent);

      expect(ages).toEqual(["25", "28", "30", "32", "35"]);
    });

    it("does not sort non-sortable columns", () => {
      render(<DataTable {...defaultProps} />);

      // Status column has sortable: false, so it should render as a span, not a button
      const statusHeader = screen.getByText("Status");
      expect(statusHeader.tagName).toBe("SPAN");
    });

    it("applies default sort when provided", () => {
      render(
        <DataTable
          {...defaultProps}
          defaultSort={{ columnId: "age", direction: "desc" }}
        />
      );

      const rows = screen.getAllByRole("row").slice(1);
      const ages = rows.map((row) => within(row).getAllByRole("cell")[2].textContent);

      expect(ages).toEqual(["35", "32", "30", "28", "25"]);
    });
  });

  describe("Pagination", () => {
    it("does not show pagination when data fits on one page", () => {
      render(<DataTable {...defaultProps} pageSize={10} />);

      expect(screen.queryByText(/previous/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/next/i)).not.toBeInTheDocument();
    });

    it("shows pagination controls when data exceeds page size", () => {
      render(<DataTable {...defaultProps} pageSize={2} />);

      expect(screen.getByText(/previous/i)).toBeInTheDocument();
      expect(screen.getByText(/next/i)).toBeInTheDocument();
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    });

    it("shows correct page count info", () => {
      render(<DataTable {...defaultProps} pageSize={2} />);

      expect(screen.getByText(/showing 1 to 2 of 5/i)).toBeInTheDocument();
    });

    it("navigates to next page", () => {
      render(<DataTable {...defaultProps} pageSize={2} />);

      // Should show first 2 items
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.queryByText("Charlie Brown")).not.toBeInTheDocument();

      // Click next
      fireEvent.click(screen.getByText(/next/i));

      // Should now show items 3-4
      expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
      expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
      expect(screen.getByText("Diana Prince")).toBeInTheDocument();
      expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
    });

    it("navigates to previous page", () => {
      render(<DataTable {...defaultProps} pageSize={2} />);

      // Go to page 2
      fireEvent.click(screen.getByText(/next/i));

      // Go back to page 1
      fireEvent.click(screen.getByText(/previous/i));

      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    });

    it("disables Previous button on first page", () => {
      render(<DataTable {...defaultProps} pageSize={2} />);

      const prevButton = screen.getByText(/previous/i);
      expect(prevButton).toBeDisabled();
    });

    it("disables Next button on last page", () => {
      render(<DataTable {...defaultProps} pageSize={2} />);

      // Navigate to last page
      fireEvent.click(screen.getByText(/next/i));
      fireEvent.click(screen.getByText(/next/i));

      expect(screen.getByText(/page 3 of 3/i)).toBeInTheDocument();

      const nextButton = screen.getByText(/next/i);
      expect(nextButton).toBeDisabled();
    });

    it("shows correct range on last page with partial data", () => {
      render(<DataTable {...defaultProps} pageSize={2} />);

      // Navigate to last page (page 3 with only 1 item)
      fireEvent.click(screen.getByText(/next/i));
      fireEvent.click(screen.getByText(/next/i));

      expect(screen.getByText(/showing 5 to 5 of 5/i)).toBeInTheDocument();
    });
  });

  describe("Row Click Handler", () => {
    it("calls onRowClick when row is clicked", () => {
      const mockOnRowClick = vi.fn();
      render(<DataTable {...defaultProps} onRowClick={mockOnRowClick} />);

      const rows = screen.getAllByRole("row").slice(1); // Skip header
      fireEvent.click(rows[0]);

      expect(mockOnRowClick).toHaveBeenCalledWith(mockData[0]);
      expect(mockOnRowClick).toHaveBeenCalledTimes(1);
    });

    it("adds cursor-pointer class when onRowClick is provided", () => {
      const mockOnRowClick = vi.fn();
      render(<DataTable {...defaultProps} onRowClick={mockOnRowClick} />);

      const rows = screen.getAllByRole("row").slice(1);
      expect(rows[0]).toHaveClass("cursor-pointer");
    });

    it("does not add cursor-pointer class when onRowClick is not provided", () => {
      render(<DataTable {...defaultProps} />);

      const rows = screen.getAllByRole("row").slice(1);
      expect(rows[0]).not.toHaveClass("cursor-pointer");
    });
  });

  describe("Null Value Handling", () => {
    it("handles null values in sorting", () => {
      const dataWithNulls: TestData[] = [
        { id: "1", name: "Alice", email: "alice@example.com", age: 30, status: "active" },
        { id: "2", name: "", email: "", age: 0, status: "inactive" },
        { id: "3", name: "Charlie", email: "charlie@example.com", age: 35, status: "active" },
      ];

      const columnsWithNullable: ColumnDef<TestData>[] = [
        {
          id: "name",
          header: "Name",
          accessor: (row) => row.name || null,
        },
      ];

      render(
        <DataTable
          data={dataWithNulls}
          columns={columnsWithNullable}
          getRowKey={(row) => row.id}
        />
      );

      const nameHeader = screen.getByRole("button", { name: /name/i });
      fireEvent.click(nameHeader);

      // Null values should sort to the end
      const rows = screen.getAllByRole("row").slice(1);
      const names = rows.map((row) => within(row).getAllByRole("cell")[0].textContent);

      expect(names[0]).toBe("Alice");
      expect(names[1]).toBe("Charlie");
    });

    it("displays dash for null/undefined values without custom renderer", () => {
      const dataWithNull = [
        { id: "1", value: null as string | null },
        { id: "2", value: undefined as string | undefined },
        { id: "3", value: "present" },
      ];

      const nullColumns: ColumnDef<typeof dataWithNull[0]>[] = [
        {
          id: "value",
          header: "Value",
          accessor: (row) => row.value,
        },
      ];

      render(
        <DataTable
          data={dataWithNull}
          columns={nullColumns}
          getRowKey={(row) => row.id}
        />
      );

      const cells = screen.getAllByRole("cell");
      // Null and undefined should render as dash
      expect(cells[0]).toHaveTextContent("\u2014"); // em-dash
      expect(cells[1]).toHaveTextContent("\u2014");
      expect(cells[2]).toHaveTextContent("present");
    });
  });

  describe("Column Alignment", () => {
    it("applies right alignment to columns with align: right", () => {
      render(<DataTable {...defaultProps} />);

      // Age column has align: right
      const headerCells = screen.getAllByRole("columnheader");
      const ageHeader = headerCells[2]; // Age is the third column
      expect(ageHeader).toHaveClass("text-right");
    });
  });
});
