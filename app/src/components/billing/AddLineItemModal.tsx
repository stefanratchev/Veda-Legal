"use client";

import { useState, useEffect } from "react";

interface AddLineItemModalProps {
  isLoading: boolean;
  error: string | null;
  onSubmit: (data: { date?: string; description: string; hours?: number }) => void;
  onClose: () => void;
}

export function AddLineItemModal({ isLoading, error, onSubmit, onClose }: AddLineItemModalProps) {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setValidationError("Description is required");
      return;
    }

    const data: { date?: string; description: string; hours?: number } = {
      description: trimmedDescription,
    };

    if (date) {
      data.date = date;
    }

    const hoursValue = parseFloat(hours);
    if (hours && !isNaN(hoursValue) && hoursValue > 0) {
      data.hours = hoursValue;
    }

    onSubmit(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 w-full max-w-md bg-[var(--bg-elevated)] rounded-lg shadow-xl animate-fade-up"
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
            Add Line Item
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {(error || validationError) && (
            <div className="p-3 text-sm text-[var(--danger)] bg-[var(--danger-bg)] rounded">
              {error || validationError}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Date <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Description <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
              className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
            />
          </div>

          {/* Hours */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Hours
            </label>
            <div className="relative">
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 pr-8 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
                step="0.25"
                min="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">h</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium bg-[var(--accent-pink)] text-[var(--bg-deep)] rounded hover:bg-[var(--accent-pink-dim)] transition-colors disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
