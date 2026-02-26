"use client";

import { useCallback } from "react";
import { MultiSelectFilter } from "@/components/ui/MultiSelectFilter";

export interface FilterState {
  clientIds: Set<string>;
  employeeIds: Set<string>;
  topicNames: Set<string>;
}

interface FilterBarProps {
  clients: { id: string; label: string }[];
  employees: { id: string; label: string }[];
  topics: { id: string; label: string }[];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function FilterBar({
  clients,
  employees,
  topics,
  filters,
  onChange,
}: FilterBarProps) {
  const hasActiveFilters =
    filters.clientIds.size + filters.employeeIds.size + filters.topicNames.size >
    0;

  const handleClientChange = useCallback(
    (clientIds: Set<string>) => {
      onChange({ ...filters, clientIds });
    },
    [filters, onChange]
  );

  const handleEmployeeChange = useCallback(
    (employeeIds: Set<string>) => {
      onChange({ ...filters, employeeIds });
    },
    [filters, onChange]
  );

  const handleTopicChange = useCallback(
    (topicNames: Set<string>) => {
      onChange({ ...filters, topicNames });
    },
    [filters, onChange]
  );

  const handleClearAll = useCallback(() => {
    onChange({
      clientIds: new Set(),
      employeeIds: new Set(),
      topicNames: new Set(),
    });
  }, [onChange]);

  return (
    <div className="flex items-center gap-3" data-testid="filter-bar">
      <MultiSelectFilter
        options={clients}
        selected={filters.clientIds}
        onChange={handleClientChange}
        label="Clients"
      />
      <MultiSelectFilter
        options={employees}
        selected={filters.employeeIds}
        onChange={handleEmployeeChange}
        label="Employees"
      />
      <MultiSelectFilter
        options={topics}
        selected={filters.topicNames}
        onChange={handleTopicChange}
        label="Topics"
      />
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={handleClearAll}
          className="text-[13px] text-[var(--accent-pink)] hover:text-[var(--accent-pink-dim)] transition-colors ml-auto"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
