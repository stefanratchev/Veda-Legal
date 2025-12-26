"use client";

import { useState, useEffect } from "react";
import { formatDateISO, formatHours } from "@/lib/date-utils";
import { EntriesList } from "./EntriesList";
import type { TimeEntry, TeamSummary } from "@/types";

interface TeamMemberRowProps {
  summary: TeamSummary;
  selectedDate: Date;
}

const POSITION_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PARTNER: "Partner",
  SENIOR_ASSOCIATE: "Senior Associate",
  ASSOCIATE: "Associate",
  CONSULTANT: "Consultant",
};

export function TeamMemberRow({ summary, selectedDate }: TeamMemberRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [entries, setEntries] = useState<TimeEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset entries cache when date changes
  useEffect(() => {
    setEntries(null);
    setIsExpanded(false);
    setError(null);
  }, [selectedDate]);

  const handleToggle = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);

    // If we already have entries cached, don't re-fetch
    if (entries !== null) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/timesheets/team/${summary.userId}?date=${formatDateISO(selectedDate)}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch entries");
      }

      const data = await response.json();
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch entries");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setEntries(null);
    setError(null);
    handleToggle();
  };

  const positionLabel = POSITION_LABELS[summary.position] || summary.position;

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
      {/* Collapsed Header */}
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
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

          {/* Name */}
          <span className="text-[14px] font-medium text-[var(--text-primary)]">
            {summary.userName}
          </span>

          {/* Position Badge */}
          <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">
            {positionLabel}
          </span>
        </div>

        {/* Total Hours */}
        <span className="text-[14px] font-medium text-[var(--accent-pink)]">
          {formatHours(summary.totalHours)}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-[var(--border-subtle)]">
          {error ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-[var(--danger)] text-sm mb-2">{error}</p>
              <button
                onClick={handleRetry}
                className="text-[13px] text-[var(--accent-pink)] hover:underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <EntriesList
              entries={entries || []}
              isLoadingEntries={isLoading}
              readOnly
            />
          )}
        </div>
      )}
    </div>
  );
}
