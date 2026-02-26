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
