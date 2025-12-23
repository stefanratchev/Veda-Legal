"use client";

import { useState, useRef, useEffect } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

interface Client {
  id: string;
  name: string;
  timesheetCode: string;
}

interface CreateServiceDescriptionModalProps {
  clients: Client[];
  isLoading: boolean;
  error: string | null;
  onSubmit: (clientId: string, periodStart: string, periodEnd: string) => void;
  onClose: () => void;
}

function getLastMonthRange(): { start: string; end: string } {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    start: lastMonth.toISOString().split("T")[0],
    end: lastDay.toISOString().split("T")[0],
  };
}

export function CreateServiceDescriptionModal({
  clients,
  isLoading,
  error,
  onSubmit,
  onClose,
}: CreateServiceDescriptionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const lastMonth = getLastMonthRange();

  const [clientId, setClientId] = useState("");
  const [periodStart, setPeriodStart] = useState(lastMonth.start);
  const [periodEnd, setPeriodEnd] = useState(lastMonth.end);
  const [validationError, setValidationError] = useState<string | null>(null);

  useClickOutside(modalRef, onClose);

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

    if (!clientId) {
      setValidationError("Please select a client");
      return;
    }
    if (!periodStart || !periodEnd) {
      setValidationError("Please select a date range");
      return;
    }
    if (new Date(periodStart) > new Date(periodEnd)) {
      setValidationError("Start date must be before end date");
      return;
    }

    onSubmit(clientId, periodStart, periodEnd);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-md bg-[var(--bg-elevated)] rounded-lg shadow-xl animate-fade-up"
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
            New Service Description
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

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Client <span className="text-[var(--danger)]">*</span>
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.timesheetCode})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Period Start
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Period End
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
              />
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
              {isLoading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
