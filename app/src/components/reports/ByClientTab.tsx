"use client";

import { BarChart } from "./charts/BarChart";
import { formatHours } from "@/lib/date-utils";

interface ClientStats {
  id: string;
  name: string;
  totalHours: number;
  revenue: number | null;
  employees: { id: string; name: string; hours: number }[];
}

interface Entry {
  id: string;
  date: string;
  hours: number;
  description: string;
  client: {
    id: string;
    name: string;
  };
  employee: {
    id: string;
    name: string;
  };
}

interface ByClientTabProps {
  clients: ClientStats[];
  entries: Entry[];
  isAdmin: boolean;
  selectedClientId: string | null;
  onSelectClient: (id: string | null) => void;
}

export function ByClientTab({
  clients,
  entries,
  isAdmin,
  selectedClientId,
  onSelectClient,
}: ByClientTabProps) {
  // Find selected client
  const selectedClient = selectedClientId
    ? clients.find((c) => c.id === selectedClientId)
    : null;

  // Empty state
  if (clients.length === 0) {
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
        <p className="text-[var(--text-secondary)] text-[13px]">
          No client data for this period
        </p>
      </div>
    );
  }

  // Drill-down view: single client details
  if (selectedClient) {
    const clientEntries = entries.filter(
      (e) => e.client.id === selectedClientId
    );

    // Empty state: client selected but no entries in period
    if (clientEntries.length === 0) {
      return (
        <div className="space-y-6">
          {/* Back button and header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectClient(null)}
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
              {selectedClient.name}
            </h3>
          </div>
          {/* Empty state message */}
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[var(--text-secondary)] text-[13px]">
              No time entries for this client in the selected period
            </p>
          </div>
        </div>
      );
    }

    // Calculate hours by employee for bar chart
    const hoursByEmployee = clientEntries.reduce(
      (acc, entry) => {
        const employeeId = entry.employee.id;
        if (!acc[employeeId]) {
          acc[employeeId] = { name: entry.employee.name, value: 0, id: employeeId };
        }
        acc[employeeId].value += entry.hours;
        return acc;
      },
      {} as Record<string, { name: string; value: number; id: string }>
    );
    const employeeChartData = Object.values(hoursByEmployee).sort(
      (a, b) => b.value - a.value
    );

    // Get last 10 entries
    const recentEntries = [...clientEntries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    return (
      <div className="space-y-6">
        {/* Back button and header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectClient(null)}
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
            {selectedClient.name}
          </h3>
          <span className="text-[var(--text-muted)] text-sm">
            {formatHours(selectedClient.totalHours)} total
          </span>
          {isAdmin && selectedClient.revenue !== null && (
            <span className="text-[var(--accent-pink)] text-sm font-medium">
              {formatCurrency(selectedClient.revenue)}
            </span>
          )}
        </div>

        {/* Hours by Employee chart */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
            Hours by Employee
          </h3>
          <div className="h-64">
            <BarChart
              data={employeeChartData}
              valueFormatter={formatHours}
              layout="vertical"
            />
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
                  <th className="px-4 py-3 font-medium">Employee</th>
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
                      {entry.employee.name}
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

  // Summary view: table of all clients
  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--text-muted)] text-[11px] uppercase tracking-wider border-b border-[var(--border-subtle)]">
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium text-right">Hours</th>
              {isAdmin && (
                <th className="px-4 py-3 font-medium text-right">Revenue</th>
              )}
              <th className="px-4 py-3 font-medium">Employees</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr
                key={client.id}
                onClick={() => onSelectClient(client.id)}
                className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-surface)] cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-[var(--text-primary)] font-medium">
                  {client.name}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)] text-right">
                  {formatHours(client.totalHours)}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-[var(--accent-pink)] text-right font-medium">
                    {client.revenue !== null ? formatCurrency(client.revenue) : "—"}
                  </td>
                )}
                <td className="px-4 py-3 text-[var(--text-muted)]">
                  {formatEmployeesList(client.employees)}
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
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Format currency for display (e.g., "€1,234.56")
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format employees list for display (e.g., "John Smith, Jane Doe +2")
 */
function formatEmployeesList(
  employees: { id: string; name: string; hours: number }[]
): string {
  if (employees.length === 0) return "—";

  // Sort by hours descending and take top 2
  const sorted = [...employees].sort((a, b) => b.hours - a.hours);
  const displayed = sorted.slice(0, 2);
  const remaining = sorted.length - 2;

  const names = displayed.map((e) => e.name).join(", ");
  if (remaining > 0) {
    return `${names} +${remaining}`;
  }
  return names;
}
