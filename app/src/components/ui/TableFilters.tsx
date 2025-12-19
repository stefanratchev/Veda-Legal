"use client";

import { TableFiltersProps } from "./table-types";

export function TableFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterOptions,
  filterValue,
  onFilterChange,
  resultCount,
}: TableFiltersProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Search Input */}
      <div className="flex-1 max-w-md relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="
            w-full pl-10 pr-3 py-2 rounded text-[13px]
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[var(--text-primary)] placeholder-[var(--text-muted)]
            focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
            focus:outline-none transition-all duration-200
          "
        />
      </div>

      {/* Dropdown Filter */}
      {filterOptions && onFilterChange && (
        <select
          value={filterValue}
          onChange={(e) => onFilterChange(e.target.value)}
          className="
            px-3 py-2 rounded text-[13px]
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[var(--text-primary)]
            focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
            focus:outline-none transition-all duration-200
            cursor-pointer
          "
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {/* Result Count */}
      {resultCount !== undefined && (
        <div className="text-[13px] text-[var(--text-muted)]">
          {resultCount} {resultCount === 1 ? "result" : "results"}
        </div>
      )}
    </div>
  );
}
