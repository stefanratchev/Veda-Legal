"use client";

import { useMemo, useState } from "react";
import { formatHours } from "@/lib/date-utils";
import { EntryRow } from "./EntryRow";
import { EntryCard } from "./EntryCard";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { TimeEntry, ClientWithType, Topic } from "@/types";

interface EntriesListProps {
  entries: TimeEntry[];
  isLoadingEntries: boolean;
  onDeleteEntry?: (entryId: string) => void;
  onUpdateEntry?: (updatedEntry: TimeEntry, revocationData?: { submissionRevoked: boolean; remainingHours: number }) => void;
  readOnly?: boolean;
  clients?: ClientWithType[];
  topics?: Topic[];
}

export function EntriesList({
  entries,
  isLoadingEntries,
  onDeleteEntry,
  onUpdateEntry,
  readOnly = false,
  clients = [],
  topics = [],
}: EntriesListProps) {
  const [entryToDelete, setEntryToDelete] = useState<TimeEntry | null>(null);

  const dailyTotal = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [entries]);

  const handleConfirmDelete = () => {
    if (entryToDelete && onDeleteEntry) {
      onDeleteEntry(entryToDelete.id);
      setEntryToDelete(null);
    }
  };

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded">
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
        <>
          {/* Mobile: Cards */}
          <div className="lg:hidden p-3 space-y-2">
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onEditClick={undefined}
                onDeleteClick={readOnly ? undefined : () => setEntryToDelete(entry)}
                readOnly={readOnly}
              />
            ))}
            {/* Daily Total */}
            <div className="pt-2 text-center border-t border-[var(--border-subtle)]">
              <span className="text-[13px] font-medium text-[var(--text-secondary)]">Daily Total: </span>
              <span className="text-base text-[var(--accent-pink)]">{formatHours(dailyTotal)}</span>
            </div>
          </div>

          {/* Desktop: Table */}
          <div className="hidden lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="w-[150px] px-4 py-2 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                    Client
                  </th>
                  <th className="w-[180px] px-4 py-2 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                    Topic
                  </th>
                  <th className="w-[70px] px-4 py-2 text-right text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                    Hours
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                    Work
                  </th>
                  {!readOnly && (
                    <th className="w-[50px] px-4 py-2"></th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onDeleteClick={readOnly ? undefined : () => setEntryToDelete(entry)}
                    onUpdate={onUpdateEntry}
                    readOnly={readOnly}
                    clients={clients}
                    topics={topics}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--bg-surface)]">
                  <td colSpan={readOnly ? 4 : 5} className="px-4 py-3 text-center">
                    <span className="text-[13px] font-medium text-[var(--text-secondary)]">Daily Total: </span>
                    <span className="text-base text-[var(--accent-pink)]">
                      {formatHours(dailyTotal)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {!readOnly && entryToDelete && (
        <ConfirmModal
          title="Delete Entry"
          message={`Are you sure you want to delete this ${formatHours(entryToDelete.hours)} entry for ${entryToDelete.client.name}? This action cannot be undone.`}
          confirmLabel="Delete"
          isDestructive
          onConfirm={handleConfirmDelete}
          onCancel={() => setEntryToDelete(null)}
        />
      )}
    </div>
  );
}
