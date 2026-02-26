"use client";

import { useState, useMemo, useCallback } from "react";
import { FilterBar, FilterState } from "@/components/reports/FilterBar";
import { BarChart } from "@/components/reports/charts/BarChart";
import { RevenueBarChart } from "@/components/reports/charts/RevenueBarChart";
import { DataTable } from "@/components/ui/DataTable";
import { ColumnDef } from "@/components/ui/table-types";
import {
  filterEntries,
  aggregateByClient,
  aggregateByEmployee,
  aggregateByTopic,
} from "@/lib/report-detail-utils";
import { formatHours } from "@/lib/date-utils";
import type { ReportEntry } from "@/types/reports";

interface DetailTabProps {
  entries: ReportEntry[];
  isAdmin: boolean;
}

/**
 * Format a date string for display (e.g., "15 Jan")
 */
function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Compute chart container height based on number of data items.
 * After maxBars grouping, effective bar count = min(dataLength, maxBars) + 1 if overflow exists.
 * Each bar gets 22px; minimum height is 120px to ensure axes and labels render properly.
 */
function getChartHeight(dataLength: number, maxBars: number = 20): number {
  const effectiveBars = Math.min(dataLength, maxBars) + (dataLength > maxBars ? 1 : 0);
  return Math.max(120, effectiveBars * 22);
}

/**
 * Format currency for display (e.g., "€1,234")
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DetailTab({ entries, isAdmin }: DetailTabProps) {
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    clientIds: new Set(),
    employeeIds: new Set(),
    topicNames: new Set(),
  });

  // Derive filter options from FULL dataset (not filtered subset)
  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) map.set(e.clientId, e.clientName);
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [entries]);

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) map.set(e.userId, e.userName);
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [entries]);

  const topicOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) map.set(e.topicName, e.topicName);
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [entries]);

  // Derive filtered entries
  const filteredEntries = useMemo(
    () =>
      filterEntries(
        entries,
        filters.clientIds,
        filters.employeeIds,
        filters.topicNames
      ),
    [entries, filters]
  );

  // Toggle handlers for chart bar clicks (stable refs via functional setState)
  const handleClientBarClick = useCallback((id: string) => {
    setFilters(prev => {
      const next = new Set(prev.clientIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, clientIds: next };
    });
  }, []);

  const handleEmployeeBarClick = useCallback((id: string) => {
    setFilters(prev => {
      const next = new Set(prev.employeeIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, employeeIds: next };
    });
  }, []);

  const handleTopicBarClick = useCallback((id: string) => {
    setFilters(prev => {
      const next = new Set(prev.topicNames);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, topicNames: next };
    });
  }, []);

  // Summary stats derived from filtered data
  const summaryStats = useMemo(() => {
    const entryCount = filteredEntries.length;
    const totalHours = filteredEntries.reduce((sum, e) => sum + e.hours, 0);
    const totalRevenue = filteredEntries.reduce((sum, e) => sum + (e.revenue ?? 0), 0);
    const hasRevenue = filteredEntries.some(e => e.revenue !== null);
    return { entryCount, totalHours, totalRevenue: hasRevenue ? totalRevenue : null };
  }, [filteredEntries]);

  // Aggregations for charts
  const byClient = useMemo(
    () => aggregateByClient(filteredEntries),
    [filteredEntries]
  );
  const byEmployee = useMemo(
    () => aggregateByEmployee(filteredEntries),
    [filteredEntries]
  );
  const byTopic = useMemo(
    () => aggregateByTopic(filteredEntries),
    [filteredEntries]
  );

  // Chart data: Hours
  const clientHoursData = useMemo(
    () => byClient.map((r) => ({ name: r.name, value: r.totalHours, id: r.id })),
    [byClient]
  );
  const employeeHoursData = useMemo(
    () =>
      byEmployee.map((r) => ({ name: r.name, value: r.totalHours, id: r.id })),
    [byEmployee]
  );
  const topicHoursData = useMemo(
    () => byTopic.map((r) => ({ name: r.name, value: r.totalHours, id: r.id })),
    [byTopic]
  );

  // Chart data: Revenue (admin only)
  const clientRevenueData = useMemo(
    () =>
      byClient
        .filter((r) => r.revenue != null && r.revenue > 0)
        .map((r) => ({ name: r.name, value: r.revenue!, id: r.id })),
    [byClient]
  );
  const employeeRevenueData = useMemo(
    () =>
      byEmployee
        .filter((r) => r.revenue != null && r.revenue > 0)
        .map((r) => ({ name: r.name, value: r.revenue!, id: r.id })),
    [byEmployee]
  );
  const topicRevenueData = useMemo(
    () =>
      byTopic
        .filter((r) => r.revenue != null && r.revenue > 0)
        .map((r) => ({ name: r.name, value: r.revenue!, id: r.id })),
    [byTopic]
  );

  // Column definitions for entry table
  const columns = useMemo(() => {
    const base: ColumnDef<ReportEntry>[] = [
      {
        id: "date",
        header: "Date",
        accessor: (r) => r.date,
        cell: (r) => (
          <span className="text-[var(--text-secondary)] text-[13px]">
            {formatDateDisplay(r.date)}
          </span>
        ),
      },
      {
        id: "employee",
        header: "Employee",
        accessor: (r) => r.userName,
        cell: (r) => (
          <span className="text-[var(--text-primary)] text-[13px]">
            {r.userName}
          </span>
        ),
      },
      {
        id: "client",
        header: "Client",
        accessor: (r) => r.clientName,
        cell: (r) => (
          <span className="text-[var(--text-primary)] text-[13px]">
            {r.clientName}
          </span>
        ),
      },
      {
        id: "topic",
        header: "Topic",
        accessor: (r) => r.topicName,
        cell: (r) => (
          <span className="text-[var(--text-secondary)] text-[13px]">
            {r.topicName}
          </span>
        ),
      },
      {
        id: "subtopic",
        header: "Subtopic",
        accessor: (r) => r.subtopicName,
        sortable: false,
        cell: (r) => (
          <span className="text-[var(--text-secondary)] text-[13px]">
            {r.subtopicName || "\u2014"}
          </span>
        ),
      },
      {
        id: "description",
        header: "Description",
        accessor: (r) => r.description,
        sortable: false,
        cell: (r) => (
          <span
            className="text-[var(--text-secondary)] text-[13px] max-w-xs truncate block"
            title={r.description}
          >
            {r.description}
          </span>
        ),
      },
      {
        id: "hours",
        header: "Hours",
        accessor: (r) => r.hours,
        align: "right" as const,
        cell: (r) => (
          <span className="text-[var(--text-primary)] text-[13px]">
            {formatHours(r.hours)}
          </span>
        ),
      },
    ];

    if (isAdmin) {
      base.push({
        id: "revenue",
        header: "Revenue",
        accessor: (r) => r.revenue,
        align: "right" as const,
        cell: (r) => (
          <span className="text-[var(--accent-pink)] text-[13px] font-medium">
            {r.revenue != null ? formatCurrency(r.revenue) : "\u2014"}
          </span>
        ),
      });
    }

    return base;
  }, [isAdmin]);

  // Handle clear filters
  const handleClearFilters = () => {
    setFilters({
      clientIds: new Set(),
      employeeIds: new Set(),
      topicNames: new Set(),
    });
  };

  // Summary stats row JSX
  const summaryStatsRow = (
    <div className="flex items-center gap-6 px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded">
      <div>
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Entries</span>
        <span className="ml-2 text-sm font-medium text-[var(--text-primary)]">{summaryStats.entryCount}</span>
      </div>
      <div className="w-px h-4 bg-[var(--border-subtle)]" />
      <div>
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Hours</span>
        <span className="ml-2 text-sm font-medium text-[var(--text-primary)]">{formatHours(summaryStats.totalHours)}</span>
      </div>
      {isAdmin && summaryStats.totalRevenue !== null ? (
        <>
          <div className="w-px h-4 bg-[var(--border-subtle)]" />
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Revenue</span>
            <span className="ml-2 text-sm font-medium text-[var(--accent-pink)]">{formatCurrency(summaryStats.totalRevenue)}</span>
          </div>
        </>
      ) : null}
    </div>
  );

  // Empty state
  if (filteredEntries.length === 0) {
    return (
      <div className="space-y-6">
        {/* FilterBar */}
        <FilterBar
          clients={clientOptions}
          employees={employeeOptions}
          topics={topicOptions}
          filters={filters}
          onChange={setFilters}
        />

        {/* Summary Stats */}
        {summaryStatsRow}

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded bg-[var(--bg-surface)] flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-[var(--text-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
          </div>
          <p className="text-[var(--text-secondary)] text-[13px]">
            No entries match the selected filters
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="mt-2 text-[13px] text-[var(--accent-pink)] hover:text-[var(--accent-pink-dim)] transition-colors"
          >
            Clear filters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* FilterBar */}
      <FilterBar
        clients={clientOptions}
        employees={employeeOptions}
        topics={topicOptions}
        filters={filters}
        onChange={setFilters}
      />

      {/* Summary Stats */}
      {summaryStatsRow}

      {/* Chart Row 1: By Client */}
      <div
        className={`grid grid-cols-1 ${isAdmin ? "md:grid-cols-2" : ""} gap-4`}
      >
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
            Hours by Client
          </h3>
          <div style={{ height: getChartHeight(clientHoursData.length) }}>
            <BarChart
              data={clientHoursData}
              valueFormatter={formatHours}
              layout="vertical"
              maxBars={20}
              onBarClick={handleClientBarClick}
              activeIds={filters.clientIds}
            />
          </div>
        </div>
        {isAdmin ? (
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Revenue by Client
            </h3>
            <div style={{ height: getChartHeight(clientRevenueData.length) }}>
              <RevenueBarChart data={clientRevenueData} maxBars={20} onBarClick={handleClientBarClick} activeIds={filters.clientIds} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Chart Row 2: By Employee */}
      <div
        className={`grid grid-cols-1 ${isAdmin ? "md:grid-cols-2" : ""} gap-4`}
      >
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
            Hours by Employee
          </h3>
          <div style={{ height: getChartHeight(employeeHoursData.length) }}>
            <BarChart
              data={employeeHoursData}
              valueFormatter={formatHours}
              layout="vertical"
              maxBars={20}
              onBarClick={handleEmployeeBarClick}
              activeIds={filters.employeeIds}
            />
          </div>
        </div>
        {isAdmin ? (
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Revenue by Employee
            </h3>
            <div style={{ height: getChartHeight(employeeRevenueData.length) }}>
              <RevenueBarChart data={employeeRevenueData} maxBars={20} onBarClick={handleEmployeeBarClick} activeIds={filters.employeeIds} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Chart Row 3: By Topic */}
      <div
        className={`grid grid-cols-1 ${isAdmin ? "md:grid-cols-2" : ""} gap-4`}
      >
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
            Hours by Topic
          </h3>
          <div style={{ height: getChartHeight(topicHoursData.length) }}>
            <BarChart
              data={topicHoursData}
              valueFormatter={formatHours}
              layout="vertical"
              maxBars={20}
              onBarClick={handleTopicBarClick}
              activeIds={filters.topicNames}
            />
          </div>
        </div>
        {isAdmin ? (
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Revenue by Topic
            </h3>
            <div style={{ height: getChartHeight(topicRevenueData.length) }}>
              <RevenueBarChart data={topicRevenueData} maxBars={20} onBarClick={handleTopicBarClick} activeIds={filters.topicNames} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Entry Table */}
      <DataTable
        data={filteredEntries}
        columns={columns}
        getRowKey={(entry) => entry.id}
        pageSize={50}
        defaultSort={{ columnId: "date", direction: "desc" }}
        emptyMessage="No entries match the selected filters"
      />
    </div>
  );
}
