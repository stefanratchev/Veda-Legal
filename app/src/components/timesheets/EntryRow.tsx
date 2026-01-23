"use client";

import { useState, useMemo } from "react";
import { formatHours, toHoursAndMinutes } from "@/lib/date-utils";
import { EntryForm } from "./EntryForm";
import type { TimeEntry, ClientWithType, Topic, FormData } from "@/types";

interface EntryRowProps {
  entry: TimeEntry;
  onDeleteClick?: () => void;
  onUpdate?: (updatedEntry: TimeEntry) => void;
  readOnly?: boolean;
  clients?: ClientWithType[];
  topics?: Topic[];
}

export function EntryRow({
  entry,
  onDeleteClick,
  onUpdate,
  readOnly = false,
  clients = [],
  topics = [],
}: EntryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert entry to form data for editing
  const initialFormData = useMemo((): FormData => {
    const { hours, minutes } = toHoursAndMinutes(entry.hours);

    // If subtopicId is null, this was a topic-only selection (internal/management)
    // Find the topic by name to get the topicId
    let topicId = "";
    if (!entry.subtopicId && entry.topicName) {
      const topic = topics.find((t) => t.name === entry.topicName);
      topicId = topic?.id || "";
    }

    return {
      clientId: entry.clientId,
      topicId,
      subtopicId: entry.subtopicId || "",
      hours,
      minutes,
      description: entry.description,
    };
  }, [entry, topics]);

  const [formData, setFormData] = useState<FormData>(initialFormData);

  const handleFormChange = (updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    const totalHours = formData.hours + formData.minutes / 60;

    try {
      const response = await fetch(`/api/timesheets/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: formData.clientId,
          subtopicId: formData.subtopicId || null,
          topicId: formData.topicId || null,
          hours: totalHours,
          description: formData.description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update entry");
        return;
      }

      onUpdate?.(data);
      setIsEditing(false);
    } catch {
      setError("Failed to update entry");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormData);
    setError(null);
    setIsEditing(false);
  };

  const handleEditClick = () => {
    setFormData(initialFormData);
    setIsEditing(true);
  };

  // Editing mode - show inline form
  if (isEditing) {
    return (
      <tr>
        <td colSpan={5} className="p-2">
          <EntryForm
            clients={clients}
            topics={topics}
            formData={formData}
            isLoading={isLoading}
            error={error}
            onFormChange={handleFormChange}
            onSubmit={handleSave}
            isEditMode
            onCancel={handleCancel}
          />
        </td>
      </tr>
    );
  }

  // Display mode - keep existing row structure but add edit button
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
          <div className="flex items-center gap-1">
            {/* Edit Button */}
            <button
              onClick={handleEditClick}
              disabled={entry.isLocked}
              className={`
                p-1.5 rounded-sm transition-colors
                ${entry.isLocked
                  ? "text-[var(--text-muted)] opacity-50 cursor-not-allowed"
                  : "text-[var(--text-muted)] hover:text-[var(--accent-pink)] hover:bg-[var(--accent-pink-glow)]"
                }
              `}
              title={entry.isLocked ? "This entry has been billed and cannot be edited" : "Edit entry"}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            {/* Delete Button */}
            <button
              onClick={onDeleteClick}
              className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
              title="Delete entry"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
