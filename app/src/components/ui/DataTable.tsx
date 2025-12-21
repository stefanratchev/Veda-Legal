"use client";

import { useState, useMemo, useCallback } from "react";
import { SortState, DataTableProps } from "./table-types";

export function DataTable<TData>({
  data,
  columns,
  getRowKey,
  pageSize = 25,
  emptyMessage = "No data",
  emptyIcon,
}: DataTableProps<TData>) {
  // Sorting state
  const [sortState, setSortState] = useState<SortState | null>(null);

  // Pagination state - simple current page tracking
  const [currentPage, setCurrentPage] = useState(1);

  // Sort handler
  const handleSort = useCallback((columnId: string) => {
    setSortState((prev) => {
      if (prev?.columnId === columnId) {
        // Same column: toggle direction or clear
        if (prev.direction === "asc") {
          return { columnId, direction: "desc" };
        }
        // Was desc, clear sort
        return null;
      }
      // New column: start with asc
      return { columnId, direction: "asc" };
    });
  }, []);

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortState) return data;

    const column = columns.find((c) => c.id === sortState.columnId);
    if (!column) return data;

    const sorted = [...data].sort((a, b) => {
      const aVal = column.accessor(a);
      const bVal = column.accessor(b);

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Compare values
      let comparison = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }

      return sortState.direction === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [data, sortState, columns]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));

  // Clamp current page to valid range (derived state, no useEffect needed)
  const validCurrentPage = Math.min(currentPage, totalPages);

  // Paginated data (use validCurrentPage)
  const paginatedData = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, validCurrentPage, pageSize]);

  const startIndex = (validCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(validCurrentPage * pageSize, sortedData.length);

  // Sort indicator component
  const SortIndicator = ({ columnId }: { columnId: string }) => {
    const isActive = sortState?.columnId === columnId;
    const direction = isActive ? sortState?.direction : null;

    return (
      <svg
        className={`w-3 h-3 transition-all ${
          isActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] opacity-0 group-hover:opacity-50"
        } ${direction === "desc" ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
      </svg>
    );
  };

  // Empty state
  if (data.length === 0) {
    return (
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          {emptyIcon && (
            <div className="w-12 h-12 rounded bg-[var(--bg-surface)] flex items-center justify-center mb-3">
              {emptyIcon}
            </div>
          )}
          <p className="text-[var(--text-secondary)] text-[13px]">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            {columns.map((column) => {
              const isSortable = column.sortable !== false;
              const align = column.align || "left";

              return (
                <th
                  key={column.id}
                  className={`px-4 py-2.5 ${
                    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
                  }`}
                  style={{ width: column.width }}
                >
                  {isSortable ? (
                    <button
                      onClick={() => handleSort(column.id)}
                      className={`
                        group flex items-center gap-1.5 text-[10px] font-semibold
                        text-[var(--text-muted)] uppercase tracking-wider
                        hover:text-[var(--text-primary)] transition-colors
                        ${align === "right" ? "ml-auto" : ""}
                      `}
                    >
                      {column.header}
                      <SortIndicator columnId={column.id} />
                    </button>
                  ) : (
                    <span
                      className={`
                        text-[10px] font-semibold text-[var(--text-muted)]
                        uppercase tracking-wider
                        ${align === "right" ? "block text-right" : ""}
                      `}
                    >
                      {column.header}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row) => (
            <tr
              key={getRowKey(row)}
              className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-hover)] transition-colors"
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={`px-4 py-2.5 ${column.align === "right" ? "text-right" : ""}`}
                >
                  {column.cell ? (
                    column.cell(row)
                  ) : (
                    <span className="text-[13px] text-[var(--text-secondary)]">
                      {String(column.accessor(row) ?? "—")}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)]">
          <div className="text-[13px] text-[var(--text-muted)]">
            Showing {startIndex} to {endIndex} of {sortedData.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={validCurrentPage === 1}
              className="
                px-3 py-1.5 rounded text-[13px] font-medium
                text-[var(--text-secondary)]
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border-subtle)] disabled:hover:text-[var(--text-secondary)]
                transition-all duration-200
              "
            >
              Previous
            </button>

            <span className="text-[13px] text-[var(--text-secondary)] px-3">
              Page {validCurrentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={validCurrentPage === totalPages}
              className="
                px-3 py-1.5 rounded text-[13px] font-medium
                text-[var(--text-secondary)]
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border-subtle)] disabled:hover:text-[var(--text-secondary)]
                transition-all duration-200
              "
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
