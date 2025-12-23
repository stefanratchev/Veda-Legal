import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-utils";
import { Prisma } from "@prisma/client";

interface EmployeeStats {
  id: string;
  name: string;
  totalHours: number;
  clientCount: number;
  topClient: { name: string; hours: number } | null;
  clients: { id: string; name: string; hours: number }[];
  dailyHours: { date: string; hours: number }[];
}

interface ClientStats {
  id: string;
  name: string;
  hourlyRate: number | null;
  totalHours: number;
  revenue: number | null;
  employees: { id: string; name: string; hours: number }[];
}

interface ReportData {
  summary: {
    totalHours: number;
    totalRevenue: number | null;
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
  }[];
}

// GET /api/reports?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await db.user.findUnique({
    where: { email: auth.session.user?.email || "" },
    select: { id: true, email: true, name: true, position: true },
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
    // Fetch time entries for the period
    const whereClause: Prisma.TimeEntryWhereInput = {
      date: { gte: start, lte: end },
      // Non-admins only see their own data
      ...(!isAdmin && { userId: user.id }),
    };

    const entries = await db.timeEntry.findMany({
      where: whereClause,
      select: {
        id: true,
        date: true,
        hours: true,
        description: true,
        userId: true,
        user: { select: { id: true, name: true } },
        clientId: true,
        client: { select: { id: true, name: true, hourlyRate: true } },
      },
      orderBy: { date: "desc" },
    });

    // Aggregate by employee
    const employeeMap = new Map<string, {
      id: string;
      name: string;
      totalHours: number;
      clients: Map<string, { name: string; hours: number }>;
      dailyHours: Map<string, number>;
    }>();

    // Aggregate by client
    const clientMap = new Map<string, {
      id: string;
      name: string;
      hourlyRate: number | null;
      totalHours: number;
      employees: Map<string, { name: string; hours: number }>;
    }>();

    let totalHours = 0;
    let totalRevenue: number | null = isAdmin ? 0 : null;
    const activeClientIds = new Set<string>();

    for (const entry of entries) {
      const hours = Number(entry.hours);
      totalHours += hours;
      activeClientIds.add(entry.clientId);

      const clientRate = entry.client.hourlyRate ? Number(entry.client.hourlyRate) : null;
      if (isAdmin && clientRate !== null) {
        totalRevenue = (totalRevenue ?? 0) + hours * clientRate;
      }

      // Employee aggregation
      const empId = entry.userId;
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          id: empId,
          name: entry.user.name || "Unknown",
          totalHours: 0,
          clients: new Map(),
          dailyHours: new Map(),
        });
      }
      const emp = employeeMap.get(empId)!;
      emp.totalHours += hours;

      const dateStr = entry.date.toISOString().split("T")[0];
      emp.dailyHours.set(dateStr, (emp.dailyHours.get(dateStr) || 0) + hours);

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
          hourlyRate: clientRate,
          totalHours: 0,
          employees: new Map(),
        });
      }
      const client = clientMap.get(clientId)!;
      client.totalHours += hours;

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

      return {
        id: emp.id,
        name: emp.name,
        totalHours: emp.totalHours,
        clientCount: clients.length,
        topClient: clients[0] ? { name: clients[0].name, hours: clients[0].hours } : null,
        clients,
        dailyHours: Array.from(emp.dailyHours.entries())
          .map(([date, hours]) => ({ date, hours }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }).sort((a, b) => b.totalHours - a.totalHours);

    const byClient: ClientStats[] = Array.from(clientMap.values()).map((client) => {
      const employees = Array.from(client.employees.entries())
        .map(([id, data]) => ({ id, name: data.name, hours: data.hours }))
        .sort((a, b) => b.hours - a.hours);

      return {
        id: client.id,
        name: client.name,
        hourlyRate: client.hourlyRate,
        totalHours: client.totalHours,
        revenue: client.hourlyRate !== null ? client.totalHours * client.hourlyRate : null,
        employees,
      };
    }).sort((a, b) => b.totalHours - a.totalHours);

    const response: ReportData = {
      summary: {
        totalHours,
        totalRevenue,
        activeClients: activeClientIds.size,
      },
      byEmployee: isAdmin ? byEmployee : byEmployee.filter(e => e.id === user.id),
      byClient: isAdmin ? byClient : byClient.map(c => ({ ...c, hourlyRate: null, revenue: null })),
      entries: entries.map((e) => ({
        id: e.id,
        date: e.date.toISOString().split("T")[0],
        hours: Number(e.hours),
        description: e.description,
        userId: e.userId,
        userName: e.user.name || "Unknown",
        clientId: e.clientId,
        clientName: e.client.name,
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
