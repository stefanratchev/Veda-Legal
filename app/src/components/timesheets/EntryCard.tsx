"use client";

import { useState } from "react";
import { formatHours } from "@/lib/date-utils";
import type { TimeEntry } from "@/types";

interface EntryCardProps {
  entry: TimeEntry;
  onDelete: () => void;
}

export function EntryCard({ entry, onDelete }: EntryCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setShowConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
  };

  // Build full topic path for display
  const fullTopicPath = entry.topicName && entry.subtopicName
    ? `${entry.topicName} > ${entry.subtopicName}`
    : entry.subtopicName || entry.topicName || null;

  // Truncate for display
  const displayTopicPath = fullTopicPath && fullTopicPath.length > 40
    ? fullTopicPath.slice(0, 40) + "..."
    : fullTopicPath;

  return (
    <div className="p-4 hover:bg-[var(--bg-hover)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[var(--accent-pink)] text-[11px] font-medium bg-[var(--accent-pink-glow)] px-1.5 py-0.5 rounded">
              {entry.client.name}
            </span>
            {displayTopicPath && (
              <span
                className="text-[var(--text-muted)] text-[11px] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded truncate max-w-[280px]"
                title={fullTopicPath || undefined}
              >
                {displayTopicPath}
              </span>
            )}
            <span className="text-[13px] text-[var(--text-muted)]">
              {formatHours(entry.hours)}
            </span>
          </div>
          <p className="text-[var(--text-secondary)] text-[13px]">
            {entry.description}
          </p>
        </div>

        {/* Delete Button */}
        <div className="flex items-center">
          {showConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleConfirmDelete}
                className="px-2 py-1 text-xs font-medium text-white bg-[var(--danger)] rounded hover:opacity-80 transition-opacity"
              >
                Delete
              </button>
              <button
                onClick={handleCancelDelete}
                className="px-2 py-1 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded hover:border-[var(--border-accent)] transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
              title="Delete entry"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
