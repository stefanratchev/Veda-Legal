import { and, eq, gte, lte, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeEntries } from "@/lib/schema";
import type { ClientType } from "@/types";
import type {
  ReportData,
  EmployeeStats,
  ClientStats,
  TopicAggregation,
} from "@/types/reports";

interface GetReportDataParams {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  userId: string;
  isAdmin: boolean;
}

/**
 * Fetches time entries for the given date range and aggregates them into
 * the ReportData shape used by both the server component and API route.
 */
export async function getReportData({
  startDate,
  endDate,
  userId,
  isAdmin,
}: GetReportDataParams): Promise<ReportData> {
  const whereClause = isAdmin
    ? and(gte(timeEntries.date, startDate), lte(timeEntries.date, endDate))
    : and(
        gte(timeEntries.date, startDate),
        lte(timeEntries.date, endDate),
        eq(timeEntries.userId, userId)
      );

  const entries = await db.query.timeEntries.findMany({
    where: whereClause,
    columns: {
      id: true,
      date: true,
      hours: true,
      description: true,
      userId: true,
      clientId: true,
      topicName: true,
      isWrittenOff: true,
    },
    with: {
      user: { columns: { id: true, name: true } },
      client: {
        columns: {
          id: true,
          name: true,
          hourlyRate: true,
          clientType: true,
        },
      },
    },
    orderBy: [desc(timeEntries.date)],
  });

  return aggregateEntries(entries, isAdmin, userId);
}

/**
 * Pure aggregation logic — takes raw DB entries and produces the ReportData shape.
 * Separated from the query for testability.
 */
function aggregateEntries(
  entries: {
    id: string;
    date: string;
    hours: string | number;
    description: string;
    userId: string;
    clientId: string;
    topicName: string | null;
    isWrittenOff: boolean | null;
    user: { id: string; name: string | null };
    client: {
      id: string;
      name: string;
      hourlyRate: number | string | null;
      clientType: string;
    };
  }[],
  isAdmin: boolean,
  userId: string
): ReportData {
  // Aggregate by employee
  const employeeMap = new Map<
    string,
    {
      id: string;
      name: string;
      totalHours: number;
      billableHours: number;
      revenue: number;
      clients: Map<string, { name: string; hours: number }>;
      dailyHours: Map<string, number>;
      topicMap: Map<string, { totalHours: number; writtenOffHours: number }>;
    }
  >();

  // Aggregate by client
  const clientMap = new Map<
    string,
    {
      id: string;
      name: string;
      hourlyRate: number | null;
      clientType: ClientType;
      totalHours: number;
      revenue: number;
      employees: Map<string, { name: string; hours: number }>;
      topicMap: Map<string, { totalHours: number; writtenOffHours: number }>;
    }
  >();

  let totalHours = 0;
  let totalRevenue = 0;
  let totalWrittenOffHours = 0;
  const activeClientIds = new Set<string>();

  for (const entry of entries) {
    const hours = Number(entry.hours);
    const topicName = entry.topicName || "Uncategorized";
    const isWrittenOff = entry.isWrittenOff ?? false;
    const clientType = entry.client.clientType as ClientType;
    const isBillable = clientType === "REGULAR";
    const clientRate = entry.client.hourlyRate
      ? Number(entry.client.hourlyRate)
      : 0;

    totalHours += hours;
    activeClientIds.add(entry.clientId);

    if (isWrittenOff) {
      totalWrittenOffHours += hours;
    }

    // Revenue: only count when not written-off, billable client, and rate > 0
    if (!isWrittenOff && isBillable && clientRate > 0) {
      totalRevenue += hours * clientRate;
    }

    // Employee aggregation
    const empId = entry.userId;
    if (!employeeMap.has(empId)) {
      employeeMap.set(empId, {
        id: empId,
        name: entry.user.name || "Unknown",
        totalHours: 0,
        billableHours: 0,
        revenue: 0,
        clients: new Map(),
        dailyHours: new Map(),
        topicMap: new Map(),
      });
    }
    const emp = employeeMap.get(empId)!;
    emp.totalHours += hours;

    // Employee billable hours: REGULAR clients, not written-off
    if (isBillable && !isWrittenOff) {
      emp.billableHours += hours;
      emp.revenue += hours * clientRate;
    }

    // Employee topic aggregation
    if (!emp.topicMap.has(topicName)) {
      emp.topicMap.set(topicName, { totalHours: 0, writtenOffHours: 0 });
    }
    const empTopic = emp.topicMap.get(topicName)!;
    empTopic.totalHours += hours;
    if (isWrittenOff) empTopic.writtenOffHours += hours;

    emp.dailyHours.set(
      entry.date,
      (emp.dailyHours.get(entry.date) || 0) + hours
    );

    if (!emp.clients.has(entry.clientId)) {
      emp.clients.set(entry.clientId, { name: entry.client.name, hours: 0 });
    }
    emp.clients.get(entry.clientId)!.hours += hours;

    // Client aggregation
    const clientId = entry.clientId;
    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        id: clientId,
        name: entry.client.name,
        hourlyRate: entry.client.hourlyRate
          ? Number(entry.client.hourlyRate)
          : null,
        clientType,
        totalHours: 0,
        revenue: 0,
        employees: new Map(),
        topicMap: new Map(),
      });
    }
    const client = clientMap.get(clientId)!;
    client.totalHours += hours;

    // Client revenue: only for REGULAR, not written-off
    if (!isWrittenOff && isBillable && clientRate > 0) {
      client.revenue += hours * clientRate;
    }

    // Client topic aggregation
    if (!client.topicMap.has(topicName)) {
      client.topicMap.set(topicName, { totalHours: 0, writtenOffHours: 0 });
    }
    const clientTopic = client.topicMap.get(topicName)!;
    clientTopic.totalHours += hours;
    if (isWrittenOff) clientTopic.writtenOffHours += hours;

    if (!client.employees.has(empId)) {
      client.employees.set(empId, {
        name: entry.user.name || "Unknown",
        hours: 0,
      });
    }
    client.employees.get(empId)!.hours += hours;
  }

  // Build response
  const byEmployee: EmployeeStats[] = Array.from(employeeMap.values())
    .map((emp) => {
      const clients = Array.from(emp.clients.entries())
        .map(([id, data]) => ({ id, name: data.name, hours: data.hours }))
        .sort((a, b) => b.hours - a.hours);

      const topics: TopicAggregation[] = Array.from(
        emp.topicMap.entries()
      ).map(([name, data]) => ({
        topicName: name,
        totalHours: data.totalHours,
        writtenOffHours: data.writtenOffHours,
      }));

      return {
        id: emp.id,
        name: emp.name,
        totalHours: emp.totalHours,
        billableHours: isAdmin ? emp.billableHours : null,
        revenue: isAdmin ? emp.revenue : null,
        clientCount: clients.length,
        topClient: clients[0]
          ? { name: clients[0].name, hours: clients[0].hours }
          : null,
        clients,
        dailyHours: Array.from(emp.dailyHours.entries())
          .map(([date, hours]) => ({ date, hours }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        topics,
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  const byClient: ClientStats[] = Array.from(clientMap.values())
    .map((client) => {
      const employees = Array.from(client.employees.entries())
        .map(([id, data]) => ({ id, name: data.name, hours: data.hours }))
        .sort((a, b) => b.hours - a.hours);

      const topics: TopicAggregation[] = Array.from(
        client.topicMap.entries()
      ).map(([name, data]) => ({
        topicName: name,
        totalHours: data.totalHours,
        writtenOffHours: data.writtenOffHours,
      }));

      return {
        id: client.id,
        name: client.name,
        hourlyRate: client.hourlyRate,
        clientType: client.clientType,
        totalHours: client.totalHours,
        revenue: client.revenue,
        employees,
        topics,
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  return {
    summary: {
      totalHours,
      totalRevenue: isAdmin ? totalRevenue : null,
      totalWrittenOffHours: isAdmin ? totalWrittenOffHours : null,
      activeClients: activeClientIds.size,
    },
    byEmployee: isAdmin
      ? byEmployee
      : byEmployee.filter((e) => e.id === userId),
    byClient: isAdmin
      ? byClient
      : byClient.map((c) => ({ ...c, hourlyRate: null, revenue: null })),
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date,
      hours: Number(e.hours),
      description: e.description,
      userId: e.userId,
      userName: e.user.name || "Unknown",
      clientId: e.clientId,
      clientName: e.client.name,
      topicName: e.topicName || "Uncategorized",
      isWrittenOff: e.isWrittenOff ?? false,
      clientType: e.client.clientType as ClientType,
    })),
  };
}
