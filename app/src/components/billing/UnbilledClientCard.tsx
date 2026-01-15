"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface UnbilledClientCardProps {
  clientId: string;
  clientName: string;
  totalUnbilledHours: number;
  estimatedValue: number | null;
  oldestEntryDate: string;
  newestEntryDate: string;
  existingDraftId: string | null;
  onCreateServiceDescription: (
    clientId: string,
    periodStart: string,
    periodEnd: string
  ) => Promise<void>;
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.toLocaleDateString("en-GB", { month: "short" });
  const endMonth = end.toLocaleDateString("en-GB", { month: "short" });
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  // Format: "Oct 15 – Dec 20, 2024"
  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${endYear}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${endYear}`;
  }
  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatHours(hours: number): string {
  if (hours === 1) return "1 hour";
  return `${hours} hours`;
}

export function UnbilledClientCard({
  clientId,
  clientName,
  totalUnbilledHours,
  estimatedValue,
  oldestEntryDate,
  newestEntryDate,
  existingDraftId,
  onCreateServiceDescription,
}: UnbilledClientCardProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const hasDraft = existingDraftId !== null;

  const handleClick = useCallback(async () => {
    if (hasDraft) {
      router.push(`/billing/${existingDraftId}`);
      return;
    }

    setIsCreating(true);
    try {
      await onCreateServiceDescription(clientId, oldestEntryDate, newestEntryDate);
    } finally {
      setIsCreating(false);
    }
  }, [
    hasDraft,
    existingDraftId,
    router,
    onCreateServiceDescription,
    clientId,
    oldestEntryDate,
    newestEntryDate,
  ]);

  return (
    <div className="bg-[var(--bg-elevated)] rounded-lg p-5 flex flex-col gap-3">
      {/* Header: Client name and optional DRAFT badge */}
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-[15px] font-semibold text-[var(--text-primary)] truncate">
          {clientName}
        </h3>
        {hasDraft && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-[var(--warning-bg)] text-[var(--warning)]">
            DRAFT
          </span>
        )}
      </div>

      {/* Estimated value - large accent color */}
      <div className="flex flex-col gap-0.5">
        {estimatedValue !== null ? (
          <>
            <span className="text-xl font-semibold text-[var(--accent-pink)]">
              {formatCurrency(estimatedValue)} BGN
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              estimated unbilled
            </span>
          </>
        ) : (
          <span className="text-lg font-medium text-[var(--text-muted)]">
            Rate not set
          </span>
        )}
      </div>

      {/* Hours and date range */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-[var(--text-secondary)]">
          {formatHours(totalUnbilledHours)}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">
          {formatDateRange(oldestEntryDate, newestEntryDate)}
        </span>
      </div>

      {/* Action button */}
      <button
        onClick={handleClick}
        disabled={isCreating}
        className={`mt-1 w-full py-2 px-3 rounded text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-1.5 ${
          hasDraft
            ? "text-[var(--bg-deep)] bg-[var(--warning)] hover:brightness-110"
            : "text-[var(--bg-deep)] bg-[var(--accent-pink)] hover:bg-[var(--accent-pink-dim)]"
        }`}
      >
        {isCreating ? (
          "Creating..."
        ) : hasDraft ? (
          <>
            Continue Draft
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </>
        ) : (
          <>
            Create Service Description
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}
