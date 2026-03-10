"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { UnbilledClientCard } from "./UnbilledClientCard";
import { DateRangePicker, DateRange, getDateRange } from "./DateRangePicker";

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
  }, [dateRangeFrom, dateRangeTo]);

  // Client-side search filter
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter((c) => c.clientName.toLowerCase().includes(query));
  }, [clients, searchQuery]);

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

        {/* Result Count */}
        <div className="text-[13px] text-[var(--text-muted)]">
          {filteredClients.length} {filteredClients.length === 1 ? "result" : "results"}
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
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
              Clients Ready to Bill
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent-pink)] text-[var(--bg-deep)]">
              {filteredClients.length}
            </span>
          </div>
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
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
