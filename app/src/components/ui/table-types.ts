import { ReactNode } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState {
  columnId: string;
  direction: SortDirection;
}

export interface ColumnDef<TData> {
  /** Unique identifier for the column */
  id: string;

  /** Header label */
  header: string;

  /** Extract value from row data for sorting */
  accessor: (row: TData) => string | number | null | undefined;

  /** Custom cell renderer (optional) */
  cell?: (row: TData) => ReactNode;

  /** Is this column sortable? Default: true */
  sortable?: boolean;

  /** Text alignment. Default: "left" */
  align?: "left" | "center" | "right";

  /** Column width (e.g., "120px", "25%") */
  width?: string;
}

export interface DataTableProps<TData> {
  /** Data to display */
  data: TData[];

  /** Column definitions */
  columns: ColumnDef<TData>[];

  /** Extract unique key from each row */
  getRowKey: (row: TData) => string;

  /** Rows per page. Default: 25 */
  pageSize?: number;

  /** Message shown when data is empty */
  emptyMessage?: string;

  /** Icon shown in empty state */
  emptyIcon?: ReactNode;
}

export interface TableFiltersProps {
  /** Search input value */
  searchValue: string;

  /** Callback when search changes */
  onSearchChange: (value: string) => void;

  /** Placeholder for search input */
  searchPlaceholder?: string;

  /** Dropdown filter options */
  filterOptions?: Array<{ value: string; label: string }>;

  /** Current filter value */
  filterValue?: string;

  /** Callback when filter changes */
  onFilterChange?: (value: string) => void;

  /** Total number of results to display */
  resultCount?: number;
}
