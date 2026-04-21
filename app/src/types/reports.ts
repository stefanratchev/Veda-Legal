import type { ClientType } from "@/types";

export interface TopicAggregation {
  topicName: string;
  totalHours: number;
  writtenOffHours: number;
}

export interface EmployeeStats {
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

export interface ClientStats {
  id: string;
  name: string;
  hourlyRate: number | null;
  clientType: ClientType;
  totalHours: number;
  revenue: number | null;
  employees: { id: string; name: string; hours: number }[];
  topics: TopicAggregation[];
}

export interface ReportEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  userId: string;
  userName: string;
  clientId: string;
  clientName: string;
  topicName: string;
  subtopicName: string;
  isWrittenOff: boolean;
  clientType: ClientType;
  revenue: number | null;
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
  entries: ReportEntry[];
}

/** Monthly data point for the 12-month trend dashboard */
export interface MonthlyTrendPoint {
  month: string;        // "2025-04" ISO month format
  label: string;        // "Apr '25" display label
  totalHours: number;
  billableHours: number; // REGULAR client hours, not written off
  revenue: number;      // theoretical revenue (hours * rate)
  activeClients: number;
  utilization: number;  // percentage 0-100
  billedRevenue: number;     // grand total from finalized SDs
  standardRateValue: number; // potential revenue at standard rates
  billedHours: number;       // hours billed on finalized SDs bucketed by periodEnd
  realization: number;       // percentage: billedRevenue / standardRateValue * 100
  byEmployee: {
    id: string;
    name: string;
    hours: number;
    billableHours: number;
    billableRevenue: number; // billableHours * client hourlyRate (theoretical)
    billedRevenue: number;
    billedHours: number; // hours billed on finalized SDs bucketed by periodEnd
    standardRateValue: number; // per-employee standard-rate value of items on finalized SDs (denominator of realization)
  }[];
  byClient: {
    id: string;
    name: string;
    hours: number;
    billableHours: number;
    billableRevenue: number; // billableHours * client hourlyRate (theoretical)
    billedRevenue: number;
    billedHours: number; // hours billed on finalized SDs bucketed by line-item date
    standardRateValue: number; // per-client standard-rate value of items on finalized SDs
  }[];
}

/** Response shape from GET /api/reports/trends */
export interface TrendResponse {
  months: MonthlyTrendPoint[];  // 12 items, oldest first
  latest: {
    totalHours: number;
    revenue: number;
    activeClients: number;
    utilization: number;
  };
  previous: {
    totalHours: number;
    revenue: number;
    activeClients: number;
    utilization: number;
  };
}

/** Entry shape used by drill-down tab components (ByClientTab, ByEmployeeTab) */
export interface DrillDownEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  topicName: string;
  client: { id: string; name: string };
  employee: { id: string; name: string };
}
