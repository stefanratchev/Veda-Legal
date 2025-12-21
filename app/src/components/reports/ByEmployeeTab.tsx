"use client";

import { BarChart } from "./charts/BarChart";
import { formatHours } from "@/lib/date-utils";

interface EmployeeStats {
  id: string;
  name: string;
  totalHours: number;
  clientCount: number;
  topClient: { name: string; hours: number } | null;
  clients: { id: string; name: string; hours: number }[];
  dailyHours: { date: string; hours: number }[];
}

interface Entry {
  id: string;
  date: string;
  hours: number;
  description: string;
  client: {
    id: string;
    name: string;
    timesheetCode: string;
  };
  employee: {
    id: string;
    name: string;
  };
}

interface ByEmployeeTabProps {
  employees: EmployeeStats[];
  entries: Entry[];
  isAdmin: boolean;
  currentUserId: string;
  selectedEmployeeId: string | null;
  onSelectEmployee: (id: string | null) => void;
}

export function ByEmployeeTab({
  employees,
  entries,
  isAdmin,
  currentUserId,
  selectedEmployeeId,
  onSelectEmployee,
}: ByEmployeeTabProps) {
  // Non-admins only see their own data
  const visibleEmployees = isAdmin
    ? employees
    : employees.filter((e) => e.id === currentUserId);

  const visibleEntries = isAdmin
    ? entries
    : entries.filter((e) => e.employee.id === currentUserId);

  // Find selected employee
  const selectedEmployee = selectedEmployeeId
    ? visibleEmployees.find((e) => e.id === selectedEmployeeId)
    : null;

  // Empty state
  if (visibleEmployees.length === 0) {
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
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <p className="text-[var(--text-secondary)] text-[13px]">
          No employee data for this period
        </p>
      </div>
    );
  }

  // Drill-down view: single employee details
  if (selectedEmployee) {
    const employeeEntries = visibleEntries.filter(
      (e) => e.employee.id === selectedEmployeeId
    );

    // Calculate hours by client for bar chart
    const hoursByClient = employeeEntries.reduce(
      (acc, entry) => {
        const clientId = entry.client.id;
        if (!acc[clientId]) {
          acc[clientId] = { name: entry.client.name, value: 0, id: clientId };
        }
        acc[clientId].value += entry.hours;
        return acc;
      },
      {} as Record<string, { name: string; value: number; id: string }>
    );
    const clientChartData = Object.values(hoursByClient).sort(
      (a, b) => b.value - a.value
    );

    // Calculate hours by day for bar chart
    const hoursByDay = employeeEntries.reduce(
      (acc, entry) => {
        const date = entry.date;
        if (!acc[date]) {
          acc[date] = { name: formatDateDisplay(date), value: 0, id: date };
        }
        acc[date].value += entry.hours;
        return acc;
      },
      {} as Record<string, { name: string; value: number; id: string }>
    );
    const dayChartData = Object.values(hoursByDay).sort((a, b) =>
      a.id.localeCompare(b.id)
    );

    // Get last 10 entries
    const recentEntries = [...employeeEntries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    return (
      <div className="space-y-6">
        {/* Back button and header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectEmployee(null)}
            className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to All
          </button>
          <span className="text-[var(--border-subtle)]">|</span>
          <h3 className="text-[var(--text-primary)] font-medium">
            {selectedEmployee.name}
          </h3>
          <span className="text-[var(--text-muted)] text-sm">
            {formatHours(selectedEmployee.totalHours)} total
          </span>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Hours by Client
            </h3>
            <div className="h-64">
              <BarChart
                data={clientChartData}
                valueFormatter={formatHours}
                layout="vertical"
              />
            </div>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Hours by Day
            </h3>
            <div className="h-64">
              <BarChart
                data={dayChartData}
                valueFormatter={formatHours}
                layout="horizontal"
              />
            </div>
          </div>
        </div>

        {/* Recent entries table */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded">
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              Recent Entries
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-muted)] text-[11px] uppercase tracking-wider border-b border-[var(--border-subtle)]">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[var(--border-subtle)] last:border-b-0"
                  >
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {formatDateDisplay(entry.date)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {entry.client.name}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] max-w-xs truncate">
                      {entry.description}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)] text-right">
                      {formatHours(entry.hours)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Summary view: table of all employees
  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--text-muted)] text-[11px] uppercase tracking-wider border-b border-[var(--border-subtle)]">
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium text-right">Hours</th>
              <th className="px-4 py-3 font-medium text-right">Clients</th>
              <th className="px-4 py-3 font-medium">Top Client</th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((employee) => (
              <tr
                key={employee.id}
                onClick={() => onSelectEmployee(employee.id)}
                className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-surface)] cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-[var(--text-primary)] font-medium">
                  {employee.name}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)] text-right">
                  {formatHours(employee.totalHours)}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)] text-right">
                  {employee.clientCount}
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)]">
                  {employee.topClient
                    ? `${employee.topClient.name} (${formatHours(employee.topClient.hours)})`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Format a date string for display (e.g., "20 Dec")
 */
function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
