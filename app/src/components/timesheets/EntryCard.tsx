"use client";

import { formatHours } from "@/lib/date-utils";
import type { TimeEntry } from "@/types";

interface EntryCardProps {
  entry: TimeEntry;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  readOnly?: boolean;
}

export function EntryCard({ entry, onEditClick, onDeleteClick, readOnly = false }: EntryCardProps) {
  return (
    <div className="bg-[var(--bg-surface)] rounded-lg p-3">
      {/* Header: Client + Hours */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
          {entry.client.name}
        </span>
        <span className="text-[15px] font-semibold text-[var(--accent-pink)] whitespace-nowrap">
          {formatHours(entry.hours)}
        </span>
      </div>

      {/* Topic */}
      {entry.topicName && (
        <p className="text-[12px] text-[var(--text-muted)] mb-1 truncate">
          {entry.topicName}
          {entry.subtopicName && ` › ${entry.subtopicName}`}
        </p>
      )}

      {/* Description */}
      <p className="text-[13px] text-[var(--text-secondary)] line-clamp-2">
        {entry.description}
      </p>

      {/* Actions */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[var(--border-subtle)]">
          {entry.isLocked ? (
            <span className="text-[11px] text-[var(--text-muted)] italic">Billed</span>
          ) : (
            <>
              {onEditClick && (
                <button
                  onClick={onEditClick}
                  className="px-2.5 py-1 rounded text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-pink)] hover:bg-[var(--accent-pink-glow)] transition-colors"
                >
                  Edit
                </button>
              )}
              <button
                onClick={onDeleteClick}
                className="px-2.5 py-1 rounded text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
