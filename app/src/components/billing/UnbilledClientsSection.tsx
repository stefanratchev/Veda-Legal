"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { UnbilledClientCard } from "./UnbilledClientCard";
import { DateRangePicker, DateRange, getDateRange } from "./DateRangePicker";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface UnbilledClient {
  clientId: string;
  clientName: string;
  totalUnbilledHours: number;
  estimatedValue: number | null;
  oldestEntryDate: string;
  newestEntryDate: string;
  existingDraftId: string | null;
}

export interface UnbilledClientsSectionProps {
  onCreateServiceDescription: (
    clientId: string,
    periodStart: string,
    periodEnd: string
  ) => Promise<void>;
}

export function UnbilledClientsSection({
  onCreateServiceDescription,
}: UnbilledClientsSectionProps) {
  const [clients, setClients] = useState<UnbilledClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Waive state
  const [waiveTarget, setWaiveTarget] = useState<{
    clientId: string;
    clientName: string;
    totalHours: number;
  } | null>(null);
  const [isWaiving, setIsWaiving] = useState(false);

  // Refetch key — increment to trigger a refetch without changing date range
  const [fetchKey, setFetchKey] = useState(0);

  // Date range state — default to "all-time"
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const { from, to } = getDateRange("all-time");
    return { preset: "all-time" as const, from, to };
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Extract primitives for useEffect dependencies (rerender-dependencies pattern)
  const dateRangeFrom = dateRange.from;
  const dateRangeTo = dateRange.to;

  // Fetch unbilled clients with optional date range params
  useEffect(() => {
    async function fetchUnbilledClients() {
      // Use isRefetching for subsequent loads, isLoading for first load
      if (!isLoading) {
        setIsRefetching(true);
      }
      try {
        const params = new URLSearchParams();
        if (dateRangeFrom) params.set("dateFrom", dateRangeFrom);
        if (dateRangeTo) params.set("dateTo", dateRangeTo);
        const queryString = params.toString();
        const url = `/api/billing/unbilled-summary${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch");
        }
        const data = await response.json();
        setClients(data);
      } catch {
        setError("Failed to load unbilled clients");
      } finally {
        setIsLoading(false);
        setIsRefetching(false);
      }
    }

    fetchUnbilledClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRangeFrom, dateRangeTo, fetchKey]);

  // Client-side search filter
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter((c) => c.clientName.toLowerCase().includes(query));
  }, [clients, searchQuery]);

  // Summary stats derived from filtered clients
  const summaryStats = useMemo(() => {
    let totalHours = 0;
    let totalRevenue = 0;
    for (const c of filteredClients) {
      totalHours += c.totalUnbilledHours;
      if (c.estimatedValue !== null) totalRevenue += c.estimatedValue;
    }
    return { totalHours, totalRevenue, clientCount: filteredClients.length };
  }, [filteredClients]);

  // Wrap onCreateServiceDescription to substitute filter dates when a date filter is active
  const handleCreateServiceDescription = useCallback(
    async (clientId: string, periodStart: string, periodEnd: string) => {
      // When a non-all-time date filter is active, use filter dates as the period
      if (dateRangeFrom && dateRangeTo) {
        return onCreateServiceDescription(clientId, dateRangeFrom, dateRangeTo);
      }
      // All Time: use per-card oldest/newest dates
      return onCreateServiceDescription(clientId, periodStart, periodEnd);
    },
    [onCreateServiceDescription, dateRangeFrom, dateRangeTo]
  );

  // Build confirmation message for the waive modal
  const buildWaiveMessage = useCallback(
    (target: { clientName: string; totalHours: number }) => {
      const hoursStr = `${target.totalHours} ${target.totalHours === 1 ? "hour" : "hours"}`;
      if (dateRangeFrom && dateRangeTo) {
        return `All unbilled entries for ${target.clientName} from ${dateRangeFrom} to ${dateRangeTo} will be written off (${hoursStr}). This action cannot be undone from this page.`;
      }
      return `All unbilled entries for ${target.clientName} will be written off (${hoursStr}). This action cannot be undone from this page.`;
    },
    [dateRangeFrom, dateRangeTo]
  );

  // Handle bulk waive API call
  const handleBulkWaive = useCallback(async () => {
    if (!waiveTarget) return;
    setIsWaiving(true);
    try {
      const res = await fetch("/api/timesheets/bulk-waive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: waiveTarget.clientId,
          ...(dateRangeFrom && { dateFrom: dateRangeFrom }),
          ...(dateRangeTo && { dateTo: dateRangeTo }),
        }),
      });
      if (!res.ok) throw new Error("Failed to waive entries");
      setWaiveTarget(null);
      // Trigger refetch to update the client list
      setFetchKey((prev) => prev + 1);
    } catch (error) {
      console.error("Bulk waive error:", error);
    } finally {
      setIsWaiving(false);
    }
  }, [waiveTarget, dateRangeFrom, dateRangeTo]);

  if (isLoading) {
    return <div className="text-[var(--text-secondary)]">Loading...</div>;
  }

  if (error) {
    return <div className="text-[var(--danger)]">{error}</div>;
  }

  // Genuinely no unbilled hours (no filter active, no search)
  if (clients.length === 0 && dateRange.preset === "all-time" && searchQuery === "") {
    return (
      <div className="text-center py-12">
        <h2 className="font-heading text-xl font-semibold text-[var(--text-primary)] mb-2">
          All caught up!
        </h2>
        <p className="text-[var(--text-muted)] mb-4">No unbilled hours to bill.</p>
        <Link
          href="/timesheets"
          className="text-[var(--accent-pink)] hover:underline"
        >
          Log time
        </Link>
      </div>
    );
  }

  return (
    <section>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <DateRangePicker value={dateRange} onChange={setDateRange} />

        {/* Search Input */}
        <div className="flex-1 max-w-md relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by client name..."
            className="
              w-full pl-10 pr-3 py-2 rounded text-[13px]
              bg-[var(--bg-surface)] border border-[var(--border-subtle)]
              text-[var(--text-primary)] placeholder-[var(--text-muted)]
              focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
              focus:outline-none transition-all duration-200
            "
          />
        </div>

        {/* Summary stats */}
        <div
          className="flex items-center gap-4 ml-auto text-[13px]"
          style={{ opacity: isRefetching ? 0.5 : 1, transition: "opacity 200ms" }}
        >
          <span className="text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-secondary)]">{summaryStats.totalHours.toLocaleString("en-GB", { maximumFractionDigits: 1 })}h</span>
          </span>
          <span className="text-[var(--border-subtle)]">|</span>
          <span className="text-[var(--text-muted)]">
            <span className="font-medium text-[var(--accent-pink)]">&euro;{summaryStats.totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </span>
          <span className="text-[var(--border-subtle)]">|</span>
          <span className="text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-secondary)]">{summaryStats.clientCount}</span> {summaryStats.clientCount === 1 ? "client" : "clients"}
          </span>
        </div>
      </div>

      {/* Filter-aware empty state */}
      {filteredClients.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="font-heading text-xl font-semibold text-[var(--text-primary)] mb-2">
            No unbilled hours match your filters
          </h2>
          <p className="text-[var(--text-muted)]">
            Try adjusting the date range or search query.
          </p>
        </div>
      ) : (
        <>
          <div
            style={{ opacity: isRefetching ? 0.5 : 1, transition: "opacity 200ms" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.map((client) => (
                <UnbilledClientCard
                  key={client.clientId}
                  clientId={client.clientId}
                  clientName={client.clientName}
                  totalUnbilledHours={client.totalUnbilledHours}
                  estimatedValue={client.estimatedValue}
                  oldestEntryDate={client.oldestEntryDate}
                  newestEntryDate={client.newestEntryDate}
                  existingDraftId={client.existingDraftId}
                  onCreateServiceDescription={handleCreateServiceDescription}
                  onWaive={(clientId, clientName, totalHours) =>
                    setWaiveTarget({ clientId, clientName, totalHours })
                  }
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bulk waive confirmation modal */}
      {waiveTarget && (
        <ConfirmModal
          title="Write Off Unbilled Entries"
          message={buildWaiveMessage(waiveTarget)}
          confirmLabel={isWaiving ? "Writing Off..." : "Write Off"}
          cancelLabel="Cancel"
          isDestructive={true}
          onConfirm={handleBulkWaive}
          onCancel={() => setWaiveTarget(null)}
        />
      )}
    </section>
  );
}
