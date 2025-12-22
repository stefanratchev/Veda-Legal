"use client";

import { formatHours } from "@/lib/date-utils";

interface Client {
  id: string;
  name: string;
  timesheetCode: string;
}

interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    timesheetCode: string;
  };
  topicId?: string | null;
  topic?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface FormData {
  clientId: string;
  hours: number;
  minutes: number;
  description: string;
}

interface EntryCardProps {
  entry: TimeEntry;
  clients: Client[];
  isEditing: boolean;
  editFormData: FormData;
  isLoading: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onEditFormChange: (updates: Partial<FormData>) => void;
}

export function EntryCard({
  entry,
  clients,
  isEditing,
  editFormData,
  isLoading,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditFormChange,
}: EntryCardProps) {
  const canSave =
    editFormData.description.trim().length >= 10 &&
    (editFormData.hours > 0 || editFormData.minutes > 0);

  const incrementHours = () => {
    onEditFormChange({ hours: Math.min(12, editFormData.hours + 1) });
  };

  const decrementHours = () => {
    onEditFormChange({ hours: Math.max(0, editFormData.hours - 1) });
  };

  const incrementMinutes = () => {
    const newMinutes = editFormData.minutes === 45 ? 0 : editFormData.minutes + 15;
    onEditFormChange({ minutes: newMinutes });
  };

  const decrementMinutes = () => {
    const newMinutes = editFormData.minutes === 0 ? 45 : editFormData.minutes - 15;
    onEditFormChange({ minutes: newMinutes });
  };

  if (isEditing) {
    return (
      <div className="p-4 hover:bg-[var(--bg-hover)] transition-colors">
        <div className="space-y-3">
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
              Client
            </label>
            <select
              value={editFormData.clientId}
              onChange={(e) => onEditFormChange({ clientId: e.target.value })}
              className="
                w-full px-4 py-2.5 rounded
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                text-[var(--text-primary)]
                focus:border-[var(--border-accent)] focus:ring-[3px] focus:ring-[var(--accent-pink-glow)]
                focus:outline-none transition-all duration-200
              "
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.timesheetCode} - {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
              Duration
            </label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={decrementHours}
                  disabled={editFormData.hours === 0}
                  className="w-8 h-8 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] disabled:opacity-40 transition-all flex items-center justify-center"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                  </svg>
                </button>
                <span className="w-12 text-center text-lg font-heading font-semibold text-[var(--text-primary)]">
                  {editFormData.hours}h
                </span>
                <button
                  type="button"
                  onClick={incrementHours}
                  disabled={editFormData.hours === 12}
                  className="w-8 h-8 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] disabled:opacity-40 transition-all flex items-center justify-center"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <span className="text-[var(--text-muted)]">:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={decrementMinutes}
                  className="w-8 h-8 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] transition-all flex items-center justify-center"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                  </svg>
                </button>
                <span className="w-12 text-center text-lg font-heading font-semibold text-[var(--text-primary)]">
                  {editFormData.minutes.toString().padStart(2, "0")}m
                </span>
                <button
                  type="button"
                  onClick={incrementMinutes}
                  className="w-8 h-8 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] transition-all flex items-center justify-center"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
              Description
            </label>
            <textarea
              value={editFormData.description}
              onChange={(e) => onEditFormChange({ description: e.target.value })}
              rows={2}
              className="
                w-full px-4 py-2.5 rounded
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                text-[var(--text-primary)]
                focus:border-[var(--border-accent)] focus:ring-[3px] focus:ring-[var(--accent-pink-glow)]
                focus:outline-none transition-all duration-200
                resize-none
              "
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onSaveEdit}
              disabled={!canSave || isLoading}
              className="px-4 py-2 rounded bg-[var(--accent-pink)] text-[var(--bg-deep)] text-sm font-medium hover:bg-[var(--accent-pink-dim)] disabled:opacity-50 transition-colors"
            >
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="px-4 py-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-sm font-medium hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View Mode
  return (
    <div className="p-4 hover:bg-[var(--bg-hover)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[var(--accent-pink)] font-mono text-[11px] bg-[var(--accent-pink-glow)] px-1.5 py-0.5 rounded">
              {entry.client.timesheetCode}
            </span>
            {entry.topic && (
              <span className="text-[var(--text-muted)] font-mono text-[11px] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">
                {entry.topic.code}
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
        <div className="flex items-center gap-1">
          <button
            onClick={onStartEdit}
            className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            title="Edit entry"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
            title="Delete entry"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
