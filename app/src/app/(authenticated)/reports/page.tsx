import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { ReportsContent, ReportData } from "@/components/reports/ReportsContent";
import {
  getMonthRange,
  formatDateISO,
  getPreviousPeriod,
} from "@/lib/date-utils";

interface GetReportDataParams {
  startDate: Date;
  endDate: Date;
  userId: string;
  isAdmin: boolean;
}

async function getReportData({
  startDate,
  endDate,
  userId,
  isAdmin,
}: GetReportDataParams): Promise<ReportData> {
  // Build where clause - filter by user if not admin
  const whereClause = {
    date: {
      gte: startDate,
      lte: endDate,
    },
    ...(isAdmin ? {} : { userId }),
  };

  // Query entries with user and client relations
  const entries = await db.timeEntry.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          timesheetCode: true,
          hourlyRate: true,
        },
      },
    },
    orderBy: { date: "desc" },
  });

  // Use Maps for efficient aggregation
  const employeeMap = new Map<
    string,
    {
      id: string;
      name: string;
      totalHours: number;
      clientHoursMap: Map<string, { id: string; name: string; hours: number }>;
      dailyHoursMap: Map<string, number>;
    }
  >();

  const clientMap = new Map<
    string,
    {
      id: string;
      name: string;
      timesheetCode: string;
      hourlyRate: number | null;
      totalHours: number;
      employeeHoursMap: Map<string, { id: string; name: string; hours: number }>;
    }
  >();

  let totalHours = 0;
  let totalRevenue = 0;
  const activeClientIds = new Set<string>();

  // Process each entry
  for (const entry of entries) {
    const hours = Number(entry.hours);
    const hourlyRate = entry.client.hourlyRate
      ? Number(entry.client.hourlyRate)
      : null;
    const dateStr = formatDateISO(entry.date);

    totalHours += hours;
    if (hourlyRate !== null) {
      totalRevenue += hours * hourlyRate;
    }
    activeClientIds.add(entry.client.id);

    // Aggregate by employee
    const employeeData = employeeMap.get(entry.user.id);
    if (employeeData) {
      employeeData.totalHours += hours;

      // Update client hours for this employee
      const existingClientHours = employeeData.clientHoursMap.get(
        entry.client.id
      );
      if (existingClientHours) {
        existingClientHours.hours += hours;
      } else {
        employeeData.clientHoursMap.set(entry.client.id, {
          id: entry.client.id,
          name: entry.client.name,
          hours,
        });
      }

      // Update daily hours
      const existingDailyHours = employeeData.dailyHoursMap.get(dateStr) || 0;
      employeeData.dailyHoursMap.set(dateStr, existingDailyHours + hours);
    } else {
      const clientHoursMap = new Map<
        string,
        { id: string; name: string; hours: number }
      >();
      clientHoursMap.set(entry.client.id, {
        id: entry.client.id,
        name: entry.client.name,
        hours,
      });

      const dailyHoursMap = new Map<string, number>();
      dailyHoursMap.set(dateStr, hours);

      employeeMap.set(entry.user.id, {
        id: entry.user.id,
        name: entry.user.name || "Unknown",
        totalHours: hours,
        clientHoursMap,
        dailyHoursMap,
      });
    }

    // Aggregate by client
    const clientData = clientMap.get(entry.client.id);
    if (clientData) {
      clientData.totalHours += hours;

      // Update employee hours for this client
      const existingEmployeeHours = clientData.employeeHoursMap.get(
        entry.user.id
      );
      if (existingEmployeeHours) {
        existingEmployeeHours.hours += hours;
      } else {
        clientData.employeeHoursMap.set(entry.user.id, {
          id: entry.user.id,
          name: entry.user.name || "Unknown",
          hours,
        });
      }
    } else {
      const employeeHoursMap = new Map<
        string,
        { id: string; name: string; hours: number }
      >();
      employeeHoursMap.set(entry.user.id, {
        id: entry.user.id,
        name: entry.user.name || "Unknown",
        hours,
      });

      clientMap.set(entry.client.id, {
        id: entry.client.id,
        name: entry.client.name,
        timesheetCode: entry.client.timesheetCode,
        hourlyRate,
        totalHours: hours,
        employeeHoursMap,
      });
    }
  }

  // Convert employee map to array
  const byEmployee = Array.from(employeeMap.values())
    .map((emp) => {
      const clients = Array.from(emp.clientHoursMap.values()).sort(
        (a, b) => b.hours - a.hours
      );
      const topClient = clients.length > 0 ? clients[0] : null;
      const dailyHours = Array.from(emp.dailyHoursMap.entries())
        .map(([date, hours]) => ({ date, hours }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        id: emp.id,
        name: emp.name,
        totalHours: emp.totalHours,
        clientCount: clients.length,
        topClient,
        clients,
        dailyHours,
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  // Convert client map to array
  const byClient = Array.from(clientMap.values())
    .map((client) => {
      const employees = Array.from(client.employeeHoursMap.values()).sort(
        (a, b) => b.hours - a.hours
      );
      const revenue =
        client.hourlyRate !== null ? client.totalHours * client.hourlyRate : null;

      return {
        id: client.id,
        name: client.name,
        timesheetCode: client.timesheetCode,
        hourlyRate: client.hourlyRate,
        totalHours: client.totalHours,
        revenue,
        employees,
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  // Transform entries for the response
  const transformedEntries = entries.map((entry) => ({
    id: entry.id,
    date: formatDateISO(entry.date),
    hours: Number(entry.hours),
    description: entry.description,
    userId: entry.user.id,
    userName: entry.user.name || "Unknown",
    clientId: entry.client.id,
    clientName: entry.client.name,
    clientCode: entry.client.timesheetCode,
  }));

  return {
    summary: {
      totalHours,
      totalRevenue: isAdmin ? totalRevenue : null,
      activeClients: activeClientIds.size,
    },
    byEmployee,
    byClient,
    entries: transformedEntries,
  };
}

export default async function ReportsPage() {
  const user = await getCurrentUser();
  const isAdmin = user.role === "ADMIN";

  // Get current month range
  const today = new Date();
  const { start: startDate, end: endDate } = getMonthRange(today);

  // Get comparison period (previous month)
  const comparisonPeriod = getPreviousPeriod(startDate, endDate);

  // Fetch both periods in parallel
  const [initialData, initialComparisonData] = await Promise.all([
    getReportData({
      startDate,
      endDate,
      userId: user.id,
      isAdmin,
    }),
    getReportData({
      startDate: comparisonPeriod.start,
      endDate: comparisonPeriod.end,
      userId: user.id,
      isAdmin,
    }),
  ]);

  return (
    <ReportsContent
      initialData={initialData}
      initialComparisonData={initialComparisonData}
      isAdmin={isAdmin}
      currentUserId={user.id}
    />
  );
}
