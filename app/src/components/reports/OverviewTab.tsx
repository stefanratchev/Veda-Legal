"use client";

import { useState, useEffect } from "react";
import { TrendChart } from "./charts/TrendChart";
import { RevenueChart } from "./charts/RevenueChart";
import { PricingHealthChart } from "./charts/PricingHealthChart";
import { EmployeeTrendTable, type EmployeeHoursMode } from "./charts/EmployeeTrendTable";
import { ByClientTable } from "./charts/ByClientTable";
import type { TrendResponse } from "@/types/reports";

// Module-level cache so tab switching does not re-fetch
let cachedTrendData: TrendResponse | null = null;

function isAllEmpty(data: TrendResponse): boolean {
  return data.months.every((m) => m.totalHours === 0);
}

function messageForStatus(status: number): string {
  if (status === 401) {
    return "Your session expired. Sign in again to load the dashboard.";
  }
  if (status === 403) {
    return "You no longer have access to reports. Ask an admin to restore your access.";
  }
  if (status >= 500) {
    return "The server hit an error loading trend data. Try again in a moment.";
  }
  return "Something went wrong loading trend data. Try refreshing the page.";
}

interface ModeOption {
  value: EmployeeHoursMode;
  label: string;
}

const HOURS_MODE_OPTIONS: ModeOption[] = [
  { value: "billableHours", label: "Billable" },
  { value: "billedHours", label: "Billed" },
  { value: "unbillableHours", label: "Unbillable" },
];

const EUR_MODE_OPTIONS: ModeOption[] = [
  { value: "billableRevenue", label: "Billable" },
  { value: "billedRevenue", label: "Billed" },
  { value: "lostRevenue", label: "Lost" },
];

const RATIO_MODE_OPTIONS: ModeOption[] = [
  { value: "realization", label: "Realization" },
  { value: "utilization", label: "Utilization" },
  { value: "effectiveRate", label: "Eff Rate" },
];

interface EmployeeModeGroupProps {
  label: string;
  options: ModeOption[];
  current: EmployeeHoursMode;
  onChange: (mode: EmployeeHoursMode) => void;
}

function EmployeeModeGroup({ label, options, current, onChange }: EmployeeModeGroupProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <div className="flex items-center gap-1 bg-[var(--bg-surface)] rounded p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
              current === opt.value
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OverviewTab() {
  const [trendData, setTrendData] = useState<TrendResponse | null>(
    cachedTrendData
  );
  const [loading, setLoading] = useState(cachedTrendData === null);
  const [error, setError] = useState<string | null>(null);
  const [employeeMode, setEmployeeMode] = useState<EmployeeHoursMode>("billableHours");
  const [clientMode, setClientMode] = useState<EmployeeHoursMode>("billableHours");

  useEffect(() => {
    if (cachedTrendData !== null) return;

    let cancelled = false;

    async function fetchTrends() {
      try {
        const res = await fetch("/api/reports/trends");
        if (!res.ok) {
          if (!cancelled) {
            setError(messageForStatus(res.status));
            setLoading(false);
          }
          console.error(`Trend fetch failed: HTTP ${res.status}`);
          return;
        }
        const data: TrendResponse = await res.json();
        if (!cancelled) {
          cachedTrendData = data;
          setTrendData(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Trend fetch failed:", err);
        if (!cancelled) {
          setError(
            "Couldn't reach the server. Check your connection and try refreshing the page."
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

      {/* Pricing Health Chart */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
          Pricing Health (12 Months)
        </h3>
        <PricingHealthChart data={trendData.months} />
      </div>

      {/* Employee Table */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            By Employee (12 Months)
          </h3>
          <div className="flex items-center gap-4 flex-wrap">
            <EmployeeModeGroup
              label="Hours"
              options={HOURS_MODE_OPTIONS}
              current={employeeMode}
              onChange={setEmployeeMode}
            />
            <EmployeeModeGroup
              label="€"
              options={EUR_MODE_OPTIONS}
              current={employeeMode}
              onChange={setEmployeeMode}
            />
            <EmployeeModeGroup
              label="%"
              options={RATIO_MODE_OPTIONS}
              current={employeeMode}
              onChange={setEmployeeMode}
            />
          </div>
        </div>
        <EmployeeTrendTable data={trendData.months} mode={employeeMode} />
      </div>

      {/* Client Table */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            By Client (12 Months)
          </h3>
          <div className="flex items-center gap-4 flex-wrap">
            <EmployeeModeGroup
              label="Hours"
              options={HOURS_MODE_OPTIONS}
              current={clientMode}
              onChange={setClientMode}
            />
            <EmployeeModeGroup
              label="€"
              options={EUR_MODE_OPTIONS}
              current={clientMode}
              onChange={setClientMode}
            />
            <EmployeeModeGroup
              label="%"
              options={RATIO_MODE_OPTIONS}
              current={clientMode}
              onChange={setClientMode}
            />
          </div>
        </div>
        <ByClientTable data={trendData.months} mode={clientMode} />
      </div>
    </div>
  );
}
