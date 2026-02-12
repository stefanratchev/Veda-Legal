"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ServiceDescriptionLineItem } from "@/types";
import { DurationPicker, DurationPickerRef } from "@/components/ui/DurationPicker";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface LineItemRowProps {
  item: ServiceDescriptionLineItem;
  sortableId?: string;
  isEditable: boolean;
  isEvenRow: boolean;
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

function decimalToHoursMinutes(decimal: number | null): { hours: number; minutes: number } {
  if (decimal === null || decimal === 0) return { hours: 0, minutes: 0 };
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  // Round to nearest 15-minute increment
  const roundedMinutes = Math.round(minutes / 15) * 15;
  if (roundedMinutes >= 60) return { hours: hours + 1, minutes: 0 };
  return { hours, minutes: roundedMinutes };
}

function hoursMinutesToDecimal(hours: number, minutes: number): number {
  return hours + minutes / 60;
}

export function LineItemRow({ item, sortableId, isEditable, isEvenRow, onUpdate, onDelete }: LineItemRowProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState(item.description);
  const [isUpdating, setIsUpdating] = useState(false);

  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const durationPickerRef = useRef<DurationPickerRef>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId || item.id, disabled: !isEditable });

  const rowStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

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

  const handleDescriptionClick = useCallback(() => {
    if (!isEditable) return;
    setEditDescription(item.description);
    setIsEditingDescription(true);
  }, [isEditable, item.description]);

  const handleDurationChange = useCallback(async (hours: number, minutes: number) => {
    const newDecimal = hoursMinutesToDecimal(hours, minutes);
    if (newDecimal === item.hours) return;

    setIsUpdating(true);
    try {
      await onUpdate(item.id, { hours: newDecimal || undefined });
    } finally {
      setIsUpdating(false);
    }
  }, [item.id, item.hours, onUpdate]);

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

  const handleDelete = useCallback(() => {
    if (confirm("Delete this line item?")) {
      onDelete(item.id);
    }
  }, [item.id, onDelete]);

  return (
    <tr ref={setNodeRef} style={rowStyle} className={`border-t border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-colors ${isUpdating ? "opacity-50" : ""} ${isEvenRow ? "bg-[var(--bg-deep)]/50" : ""}`}>
      {/* Drag handle */}
      {isEditable && (
        <td className="px-2 py-3 w-8">
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing touch-none"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="5" r="1.5" />
              <circle cx="15" cy="5" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="19" r="1.5" />
              <circle cx="15" cy="19" r="1.5" />
            </svg>
          </button>
        </td>
      )}
      {/* Date */}
      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
        {formatDate(item.date)}
      </td>

      {/* Lawyer */}
      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
        {item.employeeName || "\u2014"}
      </td>

      {/* Description */}
      <td className="px-4 py-3">
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
                (+€{item.fixedAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })})
              </span>
            )}
          </div>
        )}
      </td>

      {/* Hours */}
      <td className="px-4 py-3 text-right">
        {isEditable ? (
          <div
            className="inline-block"
            title={hasHoursChange ? `Original: ${formatHours(item.originalHours ?? null)}` : undefined}
          >
            <DurationPicker
              ref={durationPickerRef}
              hours={decimalToHoursMinutes(item.hours).hours}
              minutes={decimalToHoursMinutes(item.hours).minutes}
              onChange={handleDurationChange}
              align="right"
              className={hasHoursChange ? "[&_button]:border-b [&_button]:border-dashed [&_button]:border-[var(--warning)]" : ""}
            />
          </div>
        ) : (
          <span className="text-sm text-[var(--text-secondary)]">
            {formatHours(item.hours)}
          </span>
        )}
      </td>

      {/* Actions */}
      {isEditable && (
        <td className="px-4 py-3 text-right">
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
