"use client";

import { useState, useCallback } from "react";
import { DateRangePicker, Preset } from "./DateRangePicker";
import { ComparisonPicker, ComparisonType } from "./ComparisonPicker";
import { OverviewTab } from "./OverviewTab";
import { DetailTab } from "./DetailTab";
import {
  getMonthRange,
  formatDateISO,
} from "@/lib/date-utils";
import type { ReportData } from "@/types/reports";

export type { ReportData };

type TabType = "overview" | "detail";

interface ReportsContentProps {
  initialData: ReportData;
  isAdmin: boolean;
}

export function ReportsContent({
  initialData,
  isAdmin,
}: ReportsContentProps) {
  const today = new Date();
  const defaultRange = getMonthRange(today);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  const [comparisonType, setComparisonType] =
    useState<ComparisonType>("previous-period");

  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const [data, setData] = useState<ReportData>(initialData);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(
    async (start: Date, end: Date): Promise<ReportData> => {
      const mainParams = new URLSearchParams({
        startDate: formatDateISO(start),
        endDate: formatDateISO(end),
      });

      const response = await fetch(`/api/reports?${mainParams}`);
      if (!response.ok) {
        throw new Error("Failed to fetch report data");
      }
      return response.json();
    },
    []
  );

  const handleDateChange = useCallback(
    async (start: Date, end: Date, _preset?: Preset) => {
      void _preset;
      setStartDate(start);
      setEndDate(end);
      setLoading(true);

      try {
        const result = await fetchData(start, end);
        setData(result);
      } catch (error) {
        console.error("Failed to fetch report data:", error);
      } finally {
        setLoading(false);
      }
    },
    [fetchData]
  );

  const handleComparisonChange = useCallback(
    async (newComparison: ComparisonType) => {
      setComparisonType(newComparison);
      setLoading(true);

      try {
        const result = await fetchData(startDate, endDate);
        setData(result);
      } catch (error) {
        console.error("Failed to fetch report data:", error);
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, fetchData]
  );

  const handleTabClick = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "detail", label: "Detail" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
          Reports
        </h1>
        {activeTab !== "overview" && (
          <div className="flex items-center gap-3">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={handleDateChange}
            />
            <ComparisonPicker
              value={comparisonType}
              onChange={handleComparisonChange}
            />
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`
              px-4 py-2.5 text-[13px] font-medium transition-colors relative
              ${
                activeTab === tab.id
                  ? "text-[var(--accent-pink)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }
            `}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-pink)]" />
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="text-[var(--text-secondary)] text-[13px]">
            Loading...
          </span>
        </div>
      ) : (
        <>
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "detail" && (
            <DetailTab
              key="detail"
              entries={data.entries}
              isAdmin={isAdmin}
            />
          )}
        </>
      )}
    </div>
  );
}
