"use client";

import { SummaryCard } from "./SummaryCard";
import { BarChart } from "./charts/BarChart";
import { DonutChart } from "./charts/DonutChart";
import { formatHours } from "@/lib/date-utils";

interface OverviewTabProps {
  data: {
    summary: {
      totalHours: number;
      totalRevenue: number | null;
      activeClients: number;
    };
    byEmployee: { id: string; name: string; totalHours: number }[];
    byClient: { id: string; name: string; totalHours: number }[];
  };
  comparison: {
    summary: {
      totalHours: number;
      totalRevenue: number | null;
      activeClients: number;
    };
  } | null;
  comparisonLabel: string;
  isAdmin: boolean;
  onEmployeeClick: (id: string) => void;
  onClientClick: (id: string) => void;
}

export function OverviewTab({
  data,
  comparison,
  comparisonLabel,
  isAdmin,
  onEmployeeClick,
  onClientClick,
}: OverviewTabProps) {
  const { summary, byEmployee, byClient } = data;

  const getPercentChange = (current: number, previous: number | null | undefined) => {
    if (previous === null || previous === undefined || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const hoursComparison = comparison
    ? {
        value: getPercentChange(summary.totalHours, comparison.summary.totalHours) ?? 0,
        label: comparisonLabel,
        type: "percentage" as const,
      }
    : null;

  const revenueComparison = comparison && summary.totalRevenue !== null
    ? {
        value: getPercentChange(summary.totalRevenue, comparison.summary.totalRevenue) ?? 0,
        label: comparisonLabel,
        type: "percentage" as const,
      }
    : null;

  const clientsComparison = comparison
    ? {
        value: summary.activeClients - comparison.summary.activeClients,
        label: comparisonLabel,
        type: "absolute" as const,
      }
    : null;

  const employeeChartData = byEmployee.map((e) => ({
    name: e.name,
    value: e.totalHours,
    id: e.id,
  }));

  const clientChartData = byClient.map((c) => ({
    name: c.name,
    value: c.totalHours,
    id: c.id,
  }));

  if (summary.totalHours === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded bg-[var(--bg-surface)] flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-[var(--text-secondary)] text-[13px]">No time entries for this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className={`grid gap-4 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
        <SummaryCard
          label="Total Hours"
          value={formatHours(summary.totalHours)}
          comparison={hoursComparison}
        />
        {isAdmin && (
          <SummaryCard
            label="Total Revenue"
            value={summary.totalRevenue !== null ? `€${summary.totalRevenue.toLocaleString()}` : "—"}
            comparison={revenueComparison}
          />
        )}
        <SummaryCard
          label="Active Clients"
          value={summary.activeClients.toString()}
          comparison={clientsComparison}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
            Hours by Employee
          </h3>
          <div className="h-64">
            <BarChart
              data={employeeChartData}
              onBarClick={onEmployeeClick}
              valueFormatter={formatHours}
              layout="vertical"
            />
          </div>
        </div>

        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
            Hours by Client
          </h3>
          <div className="h-64">
            <DonutChart
              data={clientChartData}
              onSliceClick={onClientClick}
              valueFormatter={formatHours}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
