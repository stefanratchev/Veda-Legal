"use client";

import { useState, useEffect } from "react";
import { SummaryCard } from "./SummaryCard";
import { TrendChart } from "./charts/TrendChart";
import { EmployeeTrendChart } from "./charts/EmployeeTrendChart";
import { formatHours } from "@/lib/date-utils";
import { formatEurAbbreviated } from "./charts/RevenueBarChart";
import type { TrendResponse } from "@/types/reports";

// Module-level cache so tab switching does not re-fetch
let cachedTrendData: TrendResponse | null = null;

function getPercentChange(
  current: number,
  previous: number
): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function getPreviousMonthLabel(data: TrendResponse): string {
  if (data.months.length < 2) return "";
  // Extract short month name from the second-to-last label (e.g., "Mar '26" -> "Mar")
  const label = data.months[data.months.length - 2].label;
  return label.split(" ")[0];
}

function isAllEmpty(data: TrendResponse): boolean {
  return data.months.every((m) => m.totalHours === 0);
}

export function OverviewTab() {
  const [trendData, setTrendData] = useState<TrendResponse | null>(
    cachedTrendData
  );
  const [loading, setLoading] = useState(cachedTrendData === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedTrendData !== null) return;

    let cancelled = false;

    async function fetchTrends() {
      try {
        const res = await fetch("/api/reports/trends");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: TrendResponse = await res.json();
        if (!cancelled) {
          cachedTrendData = data;
          setTrendData(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Failed to load trend data. Check your connection and try refreshing the page."
          );
          setLoading(false);
        }
      }
    }

    fetchTrends();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-[var(--text-secondary)] text-[13px]">
          Loading...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--text-secondary)] text-[13px]">{error}</p>
      </div>
    );
  }

  if (!trendData || isAllEmpty(trendData)) {
    return (
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <p className="text-[var(--text-secondary)] text-[13px]">
          No hours logged in the last 12 months
        </p>
        <p className="text-[var(--text-muted)] text-[11px] mt-1">
          Time entries will appear here once team members start logging hours.
        </p>
      </div>
    );
  }

  const { latest, previous } = trendData;
  const prevMonthName = getPreviousMonthLabel(trendData);

  const hoursComparison = {
    value: getPercentChange(latest.totalHours, previous.totalHours) ?? 0,
    label: prevMonthName,
    type: "percentage" as const,
  };

  const revenueComparison = {
    value: getPercentChange(latest.revenue, previous.revenue) ?? 0,
    label: prevMonthName,
    type: "percentage" as const,
  };

  const clientsComparison = {
    value: latest.activeClients - previous.activeClients,
    label: prevMonthName,
    type: "absolute" as const,
  };

  const utilizationComparison = {
    value: latest.utilization - previous.utilization,
    label: prevMonthName,
    type: "absolute" as const,
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Hours"
          value={formatHours(latest.totalHours)}
          comparison={hoursComparison}
        />
        <SummaryCard
          label="Revenue"
          value={formatEurAbbreviated(latest.revenue)}
          comparison={revenueComparison}
        />
        <SummaryCard
          label="Active Clients"
          value={latest.activeClients.toString()}
          comparison={clientsComparison}
        />
        <SummaryCard
          label="Utilization"
          value={`${latest.utilization}%`}
          comparison={utilizationComparison}
        />
      </div>

      {/* Firm Trends Chart */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
          Firm Trends (12 Months)
        </h3>
        <TrendChart data={trendData.months} />
      </div>

      {/* Employee Chart */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
          Hours by Employee (12 Months)
        </h3>
        <EmployeeTrendChart data={trendData.months} />
      </div>
    </div>
  );
}
