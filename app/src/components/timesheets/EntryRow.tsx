"use client";

import { formatHours } from "@/lib/date-utils";
import type { TimeEntry } from "@/types";

interface EntryRowProps {
  entry: TimeEntry;
  onDeleteClick?: () => void;
  readOnly?: boolean;
}

export function EntryRow({ entry, onDeleteClick, readOnly = false }: EntryRowProps) {
  return (
    <tr className="hover:bg-[var(--bg-hover)] transition-colors">
      <td
        className="px-4 py-3 text-[13px] text-[var(--text-secondary)] truncate max-w-[150px]"
        title={entry.client.name}
      >
        {entry.client.name}
      </td>
      <td
        className="px-4 py-3 text-[13px] text-[var(--text-secondary)] truncate max-w-[180px]"
        title={entry.topicName || undefined}
      >
        {entry.topicName || "—"}
      </td>
      <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)] text-right whitespace-nowrap">
        {formatHours(entry.hours)}
      </td>
      <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)]">
        {entry.description}
      </td>
      {!readOnly && (
        <td className="px-4 py-3">
          <button
            onClick={onDeleteClick}
            className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
            title="Delete entry"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      )}
    </tr>
  );
}
