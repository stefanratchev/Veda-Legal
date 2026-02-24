"use client";

import { useState, useCallback } from "react";
import { DateRangePicker, Preset } from "./DateRangePicker";
import { ComparisonPicker, ComparisonType } from "./ComparisonPicker";
import { OverviewTab } from "./OverviewTab";
import { ByEmployeeTab } from "./ByEmployeeTab";
import { ByClientTab } from "./ByClientTab";
import {
  getMonthRange,
  formatDateISO,
  getPreviousPeriod,
  getPreviousYear,
  formatMonthShort,
} from "@/lib/date-utils";

type TabType = "overview" | "by-employee" | "by-client";

interface TopicAggregation {
  topicName: string;
  totalHours: number;
  writtenOffHours: number;
}

interface EmployeeStats {
  id: string;
  name: string;
  totalHours: number;
  billableHours: number | null;
  revenue: number | null;
  clientCount: number;
  topClient: { name: string; hours: number } | null;
  clients: { id: string; name: string; hours: number }[];
  dailyHours: { date: string; hours: number }[];
  topics: TopicAggregation[];
}

interface ClientStats {
  id: string;
  name: string;
  hourlyRate: number | null;
  clientType: "REGULAR" | "INTERNAL" | "MANAGEMENT";
  totalHours: number;
  revenue: number | null;
  employees: { id: string; name: string; hours: number }[];
  topics: TopicAggregation[];
}

interface Entry {
  id: string;
  date: string;
  hours: number;
  description: string;
  topicName: string;
  client: {
    id: string;
    name: string;
  };
  employee: {
    id: string;
    name: string;
  };
}

export interface ReportData {
  summary: {
    totalHours: number;
    totalRevenue: number | null;
    totalWrittenOffHours: number | null;
    activeClients: number;
  };
  byEmployee: EmployeeStats[];
  byClient: ClientStats[];
  entries: {
    id: string;
    date: string;
    hours: number;
    description: string;
    userId: string;
    userName: string;
    clientId: string;
    clientName: string;
    topicName: string;
    isWrittenOff: boolean;
    clientType: "REGULAR" | "INTERNAL" | "MANAGEMENT";
  }[];
}

interface ReportsContentProps {
  initialData: ReportData;
  initialComparisonData: ReportData | null;
  isAdmin: boolean;
  currentUserId: string;
}

export function ReportsContent({
  initialData,
  initialComparisonData,
  isAdmin,
  currentUserId,
}: ReportsContentProps) {
  // Date range state - default to current month
  const today = new Date();
  const defaultRange = getMonthRange(today);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  // Comparison state
  const [comparisonType, setComparisonType] =
    useState<ComparisonType>("previous-period");

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Data state
  const [data, setData] = useState<ReportData>(initialData);
  const [comparisonData, setComparisonData] = useState<ReportData | null>(
    initialComparisonData
  );
  const [loading, setLoading] = useState(false);

  // Selection state for drill-down
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Fetch data from API
  const fetchData = useCallback(
    async (
      start: Date,
      end: Date,
      comparison: ComparisonType
    ): Promise<{ main: ReportData; comparison: ReportData | null }> => {
      const mainParams = new URLSearchParams({
        startDate: formatDateISO(start),
        endDate: formatDateISO(end),
      });

      // Calculate comparison range
      const comparisonRange =
        comparison === "previous-period"
          ? getPreviousPeriod(start, end)
          : getPreviousYear(start, end);

      const compParams = new URLSearchParams({
        startDate: formatDateISO(comparisonRange.start),
        endDate: formatDateISO(comparisonRange.end),
      });

      const [mainResponse, compResponse] = await Promise.all([
        fetch(`/api/reports?${mainParams}`),
        fetch(`/api/reports?${compParams}`),
      ]);

      if (!mainResponse.ok) {
        throw new Error("Failed to fetch report data");
      }

      const mainData = await mainResponse.json();
      const compData = compResponse.ok ? await compResponse.json() : null;

      return { main: mainData, comparison: compData };
    },
    []
  );

  // Handle date change
  const handleDateChange = useCallback(
    async (start: Date, end: Date, _preset?: Preset) => {
      void _preset; // Unused but required by DateRangePicker callback signature
      setStartDate(start);
      setEndDate(end);
      setSelectedEmployeeId(null);
      setSelectedClientId(null);
      setLoading(true);

      try {
        const result = await fetchData(start, end, comparisonType);
        setData(result.main);
        setComparisonData(result.comparison);
      } catch (error) {
        console.error("Failed to fetch report data:", error);
      } finally {
        setLoading(false);
      }
    },
    [comparisonType, fetchData]
  );

  // Handle comparison change
  const handleComparisonChange = useCallback(
    async (newComparison: ComparisonType) => {
      setComparisonType(newComparison);
      setLoading(true);

      try {
        const result = await fetchData(startDate, endDate, newComparison);
        setData(result.main);
        setComparisonData(result.comparison);
      } catch (error) {
        console.error("Failed to fetch comparison data:", error);
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, fetchData]
  );

  // Handle employee click (from Overview chart)
  const handleEmployeeClick = useCallback((id: string) => {
    setSelectedEmployeeId(id);
    setSelectedClientId(null);
    setActiveTab("by-employee");
  }, []);

  // Handle client click (from Overview chart)
  const handleClientClick = useCallback((id: string) => {
    setSelectedClientId(id);
    setSelectedEmployeeId(null);
    setActiveTab("by-client");
  }, []);

  // Handle tab click
  const handleTabClick = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (tab === "overview") {
      setSelectedEmployeeId(null);
      setSelectedClientId(null);
    }
  }, []);

  // Generate comparison label
  const getComparisonLabel = (): string => {
    const compRange =
      comparisonType === "previous-period"
        ? getPreviousPeriod(startDate, endDate)
        : getPreviousYear(startDate, endDate);

    const startMonth = formatMonthShort(compRange.start);
    const endMonth = formatMonthShort(compRange.end);

    if (startMonth === endMonth) {
      return `vs ${startMonth}`;
    }
    return `vs ${startMonth} - ${endMonth}`;
  };

  // Transform entries for tab components
  const transformedEntries: Entry[] = data.entries.map((e) => ({
    id: e.id,
    date: e.date,
    hours: e.hours,
    description: e.description,
    topicName: e.topicName,
    client: {
      id: e.clientId,
      name: e.clientName,
    },
    employee: {
      id: e.userId,
      name: e.userName,
    },
  }));

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "by-employee", label: "By Employee" },
    { id: "by-client", label: "By Client" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
          Reports
        </h1>
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
          {activeTab === "overview" && (
            <OverviewTab
              data={data}
              comparison={comparisonData}
              comparisonLabel={getComparisonLabel()}
              isAdmin={isAdmin}
              onEmployeeClick={handleEmployeeClick}
              onClientClick={handleClientClick}
            />
          )}
          {activeTab === "by-employee" && (
            <ByEmployeeTab
              employees={data.byEmployee}
              entries={transformedEntries}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              selectedEmployeeId={selectedEmployeeId}
              onSelectEmployee={setSelectedEmployeeId}
            />
          )}
          {activeTab === "by-client" && (
            <ByClientTab
              clients={data.byClient}
              entries={transformedEntries}
              isAdmin={isAdmin}
              selectedClientId={selectedClientId}
              onSelectClient={setSelectedClientId}
            />
          )}
        </>
      )}
    </div>
  );
}
