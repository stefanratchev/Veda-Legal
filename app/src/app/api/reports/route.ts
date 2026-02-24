import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeEntries, users } from "@/lib/schema";
import { requireAuth } from "@/lib/api-utils";

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

interface ReportData {
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

// GET /api/reports?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, auth.session.user?.email || ""),
    columns: { id: true, email: true, name: true, position: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isAdmin = ["ADMIN", "PARTNER"].includes(user.position);

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  if (start > end) {
    return NextResponse.json({ error: "startDate must be before or equal to endDate" }, { status: 400 });
  }

  try {
    // Format dates as YYYY-MM-DD strings for Drizzle comparison
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    // Build where clause conditionally for non-admins
    const whereClause = isAdmin
      ? and(gte(timeEntries.date, startStr), lte(timeEntries.date, endStr))
      : and(
          gte(timeEntries.date, startStr),
          lte(timeEntries.date, endStr),
          eq(timeEntries.userId, user.id)
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

    // Aggregate by employee
    const employeeMap = new Map<string, {
      id: string;
      name: string;
      totalHours: number;
      billableHours: number;
      revenue: number;
      clients: Map<string, { name: string; hours: number }>;
      dailyHours: Map<string, number>;
      topicMap: Map<string, { totalHours: number; writtenOffHours: number }>;
    }>();

    // Aggregate by client
    const clientMap = new Map<string, {
      id: string;
      name: string;
      hourlyRate: number | null;
      clientType: "REGULAR" | "INTERNAL" | "MANAGEMENT";
      totalHours: number;
      revenue: number;
      employees: Map<string, { name: string; hours: number }>;
      topicMap: Map<string, { totalHours: number; writtenOffHours: number }>;
    }>();

    let totalHours = 0;
    let totalRevenue = 0;
    let totalWrittenOffHours = 0;
    const activeClientIds = new Set<string>();

    for (const entry of entries) {
      const hours = Number(entry.hours);
      const topicName = entry.topicName || "Uncategorized";
      const isWrittenOff = entry.isWrittenOff ?? false;
      const clientType = entry.client.clientType as "REGULAR" | "INTERNAL" | "MANAGEMENT";
      const isBillable = clientType === "REGULAR";
      const clientRate = entry.client.hourlyRate ? Number(entry.client.hourlyRate) : 0;

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

      // entry.date is already a YYYY-MM-DD string in Drizzle
      emp.dailyHours.set(entry.date, (emp.dailyHours.get(entry.date) || 0) + hours);

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
          hourlyRate: entry.client.hourlyRate ? Number(entry.client.hourlyRate) : null,
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
        client.employees.set(empId, { name: entry.user.name || "Unknown", hours: 0 });
      }
      client.employees.get(empId)!.hours += hours;
    }

    // Build response
    const byEmployee: EmployeeStats[] = Array.from(employeeMap.values()).map((emp) => {
      const clients = Array.from(emp.clients.entries())
        .map(([id, data]) => ({ id, name: data.name, hours: data.hours }))
        .sort((a, b) => b.hours - a.hours);

      const topics: TopicAggregation[] = Array.from(emp.topicMap.entries())
        .map(([name, data]) => ({ topicName: name, totalHours: data.totalHours, writtenOffHours: data.writtenOffHours }));

      return {
        id: emp.id,
        name: emp.name,
        totalHours: emp.totalHours,
        billableHours: isAdmin ? emp.billableHours : null,
        revenue: isAdmin ? emp.revenue : null,
        clientCount: clients.length,
        topClient: clients[0] ? { name: clients[0].name, hours: clients[0].hours } : null,
        clients,
        dailyHours: Array.from(emp.dailyHours.entries())
          .map(([date, hours]) => ({ date, hours }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        topics,
      };
    }).sort((a, b) => b.totalHours - a.totalHours);

    const byClient: ClientStats[] = Array.from(clientMap.values()).map((client) => {
      const employees = Array.from(client.employees.entries())
        .map(([id, data]) => ({ id, name: data.name, hours: data.hours }))
        .sort((a, b) => b.hours - a.hours);

      const topics: TopicAggregation[] = Array.from(client.topicMap.entries())
        .map(([name, data]) => ({ topicName: name, totalHours: data.totalHours, writtenOffHours: data.writtenOffHours }));

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
    }).sort((a, b) => b.totalHours - a.totalHours);

    const response: ReportData = {
      summary: {
        totalHours,
        totalRevenue: isAdmin ? totalRevenue : null,
        totalWrittenOffHours: isAdmin ? totalWrittenOffHours : null,
        activeClients: activeClientIds.size,
      },
      byEmployee: isAdmin ? byEmployee : byEmployee.filter(e => e.id === user.id),
      byClient: isAdmin ? byClient : byClient.map(c => ({ ...c, hourlyRate: null, revenue: null })),
      entries: entries.map((e) => ({
        id: e.id,
        date: e.date, // Already a YYYY-MM-DD string in Drizzle
        hours: Number(e.hours),
        description: e.description,
        userId: e.userId,
        userName: e.user.name || "Unknown",
        clientId: e.clientId,
        clientName: e.client.name,
        topicName: e.topicName || "Uncategorized",
        isWrittenOff: e.isWrittenOff ?? false,
        clientType: e.client.clientType as "REGULAR" | "INTERNAL" | "MANAGEMENT",
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Database error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}
