"use client";

import { useState, useEffect } from "react";
import { TrendChart } from "./charts/TrendChart";
import { RevenueChart } from "./charts/RevenueChart";
import { EmployeeTrendTable, type EmployeeHoursMode } from "./charts/EmployeeTrendTable";
import type { TrendResponse } from "@/types/reports";

// Module-level cache so tab switching does not re-fetch
let cachedTrendData: TrendResponse | null = null;

function isAllEmpty(data: TrendResponse): boolean {
  return data.months.every((m) => m.totalHours === 0);
}

export function OverviewTab() {
  const [trendData, setTrendData] = useState<TrendResponse | null>(
    cachedTrendData
  );
  const [loading, setLoading] = useState(cachedTrendData === null);
  const [error, setError] = useState<string | null>(null);
  const [employeeMode, setEmployeeMode] = useState<EmployeeHoursMode>("billable");

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

  return (
    <div className="space-y-6">
      {/* Firm Trends Chart */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
          Billable Hours (12 Months)
        </h3>
        <TrendChart data={trendData.months} />
      </div>

      {/* Billed Revenue Chart */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
          Billed Revenue (12 Months)
        </h3>
        <RevenueChart data={trendData.months} />
      </div>

      {/* Employee Table */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            By Employee (12 Months)
          </h3>
          <div className="flex items-center gap-1 bg-[var(--bg-surface)] rounded p-0.5">
            <button
              onClick={() => setEmployeeMode("billable")}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                employeeMode === "billable"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              Billable
            </button>
            <button
              onClick={() => setEmployeeMode("total")}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                employeeMode === "total"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              Total
            </button>
          </div>
        </div>
        <EmployeeTrendTable data={trendData.months} mode={employeeMode} />
      </div>
    </div>
  );
}
