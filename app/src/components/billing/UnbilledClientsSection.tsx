"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UnbilledClientCard } from "./UnbilledClientCard";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUnbilledClients() {
      try {
        const response = await fetch("/api/billing/unbilled-summary");
        if (!response.ok) {
          throw new Error("Failed to fetch");
        }
        const data = await response.json();
        setClients(data.clients);
      } catch {
        setError("Failed to load unbilled clients");
      } finally {
        setIsLoading(false);
      }
    }

    fetchUnbilledClients();
  }, []);

  if (isLoading) {
    return <div className="text-[var(--text-secondary)]">Loading...</div>;
  }

  if (error) {
    return <div className="text-[var(--danger)]">{error}</div>;
  }

  if (clients.length === 0) {
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
          Log time →
        </Link>
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
          Clients Ready to Bill
        </h2>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent-pink)] text-[var(--bg-deep)]">
          {clients.length}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <UnbilledClientCard
            key={client.clientId}
            clientId={client.clientId}
            clientName={client.clientName}
            totalUnbilledHours={client.totalUnbilledHours}
            estimatedValue={client.estimatedValue}
            oldestEntryDate={client.oldestEntryDate}
            newestEntryDate={client.newestEntryDate}
            existingDraftId={client.existingDraftId}
            onCreateServiceDescription={onCreateServiceDescription}
          />
        ))}
      </div>
    </section>
  );
}
