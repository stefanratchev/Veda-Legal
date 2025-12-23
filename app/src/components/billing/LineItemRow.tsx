"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ServiceDescriptionLineItem } from "@/types";

interface LineItemRowProps {
  item: ServiceDescriptionLineItem;
  isEditable: boolean;
  onUpdate: (itemId: string, updates: { description?: string; hours?: number }) => Promise<void>;
  onDelete: (itemId: string) => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatHours(hours: number | null): string {
  if (hours === null || hours === 0) return "-";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function LineItemRow({ item, isEditable, onUpdate, onDelete }: LineItemRowProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingHours, setIsEditingHours] = useState(false);
  const [editDescription, setEditDescription] = useState(item.description);
  const [editHours, setEditHours] = useState(item.hours?.toString() || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const hoursInputRef = useRef<HTMLInputElement>(null);

  // Check if values differ from original
  const hasDescriptionChange = item.originalDescription !== undefined && item.description !== item.originalDescription;
  const hasHoursChange = item.originalHours !== undefined && item.hours !== item.originalHours;

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingDescription && descriptionInputRef.current) {
      descriptionInputRef.current.focus();
      descriptionInputRef.current.select();
    }
  }, [isEditingDescription]);

  useEffect(() => {
    if (isEditingHours && hoursInputRef.current) {
      hoursInputRef.current.focus();
      hoursInputRef.current.select();
    }
  }, [isEditingHours]);

  const handleDescriptionClick = useCallback(() => {
    if (!isEditable) return;
    setEditDescription(item.description);
    setIsEditingDescription(true);
  }, [isEditable, item.description]);

  const handleHoursClick = useCallback(() => {
    if (!isEditable) return;
    setEditHours(item.hours?.toString() || "");
    setIsEditingHours(true);
  }, [isEditable, item.hours]);

  const handleDescriptionBlur = useCallback(async () => {
    setIsEditingDescription(false);
    const trimmed = editDescription.trim();
    if (trimmed === item.description || !trimmed) {
      setEditDescription(item.description);
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdate(item.id, { description: trimmed });
    } catch {
      setEditDescription(item.description);
    } finally {
      setIsUpdating(false);
    }
  }, [editDescription, item.id, item.description, onUpdate]);

  const handleHoursBlur = useCallback(async () => {
    setIsEditingHours(false);
    const value = parseFloat(editHours);
    if (isNaN(value) || value === item.hours) {
      setEditHours(item.hours?.toString() || "");
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdate(item.id, { hours: value || undefined });
    } catch {
      setEditHours(item.hours?.toString() || "");
    } finally {
      setIsUpdating(false);
    }
  }, [editHours, item.id, item.hours, onUpdate]);

  const handleDescriptionKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleDescriptionBlur();
      } else if (e.key === "Escape") {
        setEditDescription(item.description);
        setIsEditingDescription(false);
      }
    },
    [handleDescriptionBlur, item.description]
  );

  const handleHoursKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleHoursBlur();
      } else if (e.key === "Escape") {
        setEditHours(item.hours?.toString() || "");
        setIsEditingHours(false);
      }
    },
    [handleHoursBlur, item.hours]
  );

  const handleDelete = useCallback(() => {
    if (confirm("Delete this line item?")) {
      onDelete(item.id);
    }
  }, [item.id, onDelete]);

  return (
    <tr className={`border-t border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-colors ${isUpdating ? "opacity-50" : ""}`}>
      {/* Date */}
      <td className="px-4 py-2 text-sm text-[var(--text-secondary)]">
        {formatDate(item.date)}
      </td>

      {/* Description */}
      <td className="px-4 py-2">
        {isEditingDescription ? (
          <input
            ref={descriptionInputRef}
            type="text"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            onKeyDown={handleDescriptionKeyDown}
            className="w-full px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--accent-pink)] rounded text-[var(--text-primary)] focus:outline-none"
          />
        ) : (
          <div
            onClick={handleDescriptionClick}
            className={`text-sm text-[var(--text-primary)] ${
              isEditable ? "cursor-pointer hover:bg-[var(--bg-surface)] px-2 py-1 -mx-2 -my-1 rounded" : ""
            }`}
            title={hasDescriptionChange ? `Original: ${item.originalDescription}` : undefined}
          >
            <span className={hasDescriptionChange ? "border-b border-dashed border-[var(--warning)]" : ""}>
              {item.description}
            </span>
            {item.fixedAmount !== null && item.fixedAmount > 0 && (
              <span className="ml-2 text-xs text-[var(--text-muted)]">
                (+{item.fixedAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })} BGN)
              </span>
            )}
          </div>
        )}
      </td>

      {/* Hours */}
      <td className="px-4 py-2 text-right">
        {isEditingHours ? (
          <input
            ref={hoursInputRef}
            type="number"
            value={editHours}
            onChange={(e) => setEditHours(e.target.value)}
            onBlur={handleHoursBlur}
            onKeyDown={handleHoursKeyDown}
            className="w-20 px-2 py-1 text-sm text-right bg-[var(--bg-surface)] border border-[var(--accent-pink)] rounded text-[var(--text-primary)] focus:outline-none"
            step="0.25"
            min="0"
          />
        ) : (
          <div
            onClick={handleHoursClick}
            className={`text-sm text-[var(--text-secondary)] ${
              isEditable ? "cursor-pointer hover:bg-[var(--bg-surface)] px-2 py-1 -mx-2 -my-1 rounded inline-block" : ""
            }`}
            title={hasHoursChange ? `Original: ${formatHours(item.originalHours ?? null)}` : undefined}
          >
            <span className={hasHoursChange ? "border-b border-dashed border-[var(--warning)]" : ""}>
              {formatHours(item.hours)}
            </span>
          </div>
        )}
      </td>

      {/* Actions */}
      {isEditable && (
        <td className="px-4 py-2 text-right">
          <button
            onClick={handleDelete}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
            title="Delete line item"
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
