"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import type { ServiceDescriptionLineItem } from "@/types";
import { DurationPicker, DurationPickerRef } from "@/components/ui/DurationPicker";
import { formatHours as formatHoursUtil, parseHoursToComponents, toDecimalHours } from "@/lib/date-utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useClickOutside } from "@/hooks/useClickOutside";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface LineItemRowProps {
  item: ServiceDescriptionLineItem;
  sortableId?: string;
  isEditable: boolean;
  isEvenRow: boolean;
  onUpdate: (itemId: string, updates: { description?: string; hours?: number }) => Promise<void>;
  onDelete: (itemId: string) => void;
  onWaive: (itemId: string, waiveMode: "EXCLUDED" | "ZERO" | null) => Promise<void>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatHoursDisplay(hours: number | null): string {
  if (hours === null || hours === 0) return "-";
  return formatHoursUtil(hours);
}

export const LineItemRow = memo(function LineItemRow({ item, sortableId, isEditable, isEvenRow, onUpdate, onDelete, onWaive }: LineItemRowProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState(item.description);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showWaiveMenu, setShowWaiveMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const durationPickerRef = useRef<DurationPickerRef>(null);
  const waiveMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(waiveMenuRef, () => setShowWaiveMenu(false), showWaiveMenu);

  const isWaived = item.waiveMode !== null;
  const isExcluded = item.waiveMode === "EXCLUDED";
  const isZero = item.waiveMode === "ZERO";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId || item.id, disabled: !isEditable });

  const rowStyle = {
    transform: (transform?.x || transform?.y) ? CSS.Transform.toString(transform) : undefined,
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
    if (!isEditable || isWaived) return;
    setEditDescription(item.description);
    setIsEditingDescription(true);
  }, [isEditable, isWaived, item.description]);

  const handleDurationChange = useCallback(async (hours: number, minutes: number) => {
    const newDecimal = toDecimalHours(hours, minutes);
    if (newDecimal === item.hours) return;

    setIsUpdating(true);
    try {
      await onUpdate(item.id, { hours: newDecimal });
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
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    onDelete(item.id);
  }, [item.id, onDelete]);

  const handleWaive = useCallback(async (waiveMode: "EXCLUDED" | "ZERO" | null) => {
    setShowWaiveMenu(false);
    setIsUpdating(true);
    try {
      await onWaive(item.id, waiveMode);
    } finally {
      setIsUpdating(false);
    }
  }, [item.id, onWaive]);

  return (
    <tr ref={setNodeRef} style={rowStyle} className={`border-t border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-colors ${isUpdating ? "opacity-50" : ""} ${isEvenRow ? "bg-[var(--bg-deep)]/50" : ""} ${isExcluded ? "opacity-40" : ""}`}>
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
              isEditable && !isWaived ? "cursor-pointer hover:bg-[var(--bg-surface)] px-2 py-1 -mx-2 -my-1 rounded" : ""
            }`}
            title={hasDescriptionChange ? `Original: ${item.originalDescription}` : undefined}
          >
            <span className={`${hasDescriptionChange ? "border-b border-dashed border-[var(--warning)]" : ""} ${isExcluded ? "line-through" : ""}`}>
              {item.description}
            </span>
            {isZero && (
              <span className="ml-2 text-xs bg-[var(--warning-bg)] text-[var(--warning)] px-1.5 py-0.5 rounded">Waived</span>
            )}
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
        {isExcluded ? (
          <span className="text-sm text-[var(--text-muted)]">
            {formatHoursDisplay(item.hours)}
          </span>
        ) : isEditable && !isWaived ? (
          <div
            className="inline-block"
            title={hasHoursChange ? `Original: ${formatHoursDisplay(item.originalHours ?? null)}` : undefined}
          >
            <DurationPicker
              ref={durationPickerRef}
              {...parseHoursToComponents(item.hours ?? 0)}
              onChange={handleDurationChange}
              align="right"
              className={hasHoursChange ? "[&_button]:border-b [&_button]:border-dashed [&_button]:border-[var(--warning)]" : ""}
            />
          </div>
        ) : (
          <span className={`text-sm text-[var(--text-secondary)] ${isZero ? "line-through" : ""}`}>
            {formatHoursDisplay(item.hours)}
          </span>
        )}
      </td>

      {/* Actions */}
      {isEditable && (
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {/* Waive / Restore */}
            {isWaived ? (
              <button
                onClick={() => handleWaive(null)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--success)] hover:bg-[var(--success-bg)] transition-colors"
                title="Restore line item"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h10a5 5 0 010 10H9m4-10l-4-4m4 4l-4 4" />
                </svg>
              </button>
            ) : (
              <div className="relative" ref={waiveMenuRef}>
                <button
                  onClick={() => setShowWaiveMenu((prev) => !prev)}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--warning)] hover:bg-[var(--warning-bg)] transition-colors"
                  title="Waive line item"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </button>
                {showWaiveMenu && (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-lg py-1 min-w-[170px] animate-fade-up">
                    <button
                      onClick={() => handleWaive("EXCLUDED")}
                      className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                      Exclude from billing
                    </button>
                    <button
                      onClick={() => handleWaive("ZERO")}
                      className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                      Include at $0
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Delete - hidden for excluded rows */}
            {!isExcluded && (
              <button
                onClick={handleDelete}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
                title="Delete line item"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
          {showDeleteConfirm && (
            <ConfirmModal
              title="Delete Line Item"
              message="Delete this line item? This action cannot be undone."
              confirmLabel="Delete"
              isDestructive
              onConfirm={handleConfirmDelete}
              onCancel={() => setShowDeleteConfirm(false)}
            />
          )}
        </td>
      )}
    </tr>
  );
});
