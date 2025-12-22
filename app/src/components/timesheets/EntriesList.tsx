"use client";

import { useMemo } from "react";
import { formatHours } from "@/lib/date-utils";
import { EntryCard } from "./EntryCard";
import type { TimeEntry } from "@/types";

interface EntriesListProps {
  entries: TimeEntry[];
  isLoadingEntries: boolean;
  isToday: boolean;
  onDeleteEntry: (entryId: string) => void;
}

export function EntriesList({
  entries,
  isLoadingEntries,
  isToday,
  onDeleteEntry,
}: EntriesListProps) {
  const dailyTotal = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [entries]);

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="font-medium text-sm text-[var(--text-primary)]">
          {isToday ? "Today's Entries" : "Entries"}
        </h3>
      </div>

      {isLoadingEntries ? (
        <div className="flex items-center justify-center py-8">
          <svg className="w-6 h-6 animate-spin text-[var(--accent-pink)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded bg-[var(--bg-surface)] flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">No entries for this date</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Use the form above to log your time</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onDelete={() => onDeleteEntry(entry.id)}
            />
          ))}

          {/* Daily Total Footer */}
          {entries.length > 0 && (
            <div className="px-4 py-3 bg-[var(--bg-surface)]">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[var(--text-secondary)]">Daily Total</span>
                <span className="text-base font-heading font-semibold text-[var(--accent-pink)]">
                  {formatHours(dailyTotal)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
