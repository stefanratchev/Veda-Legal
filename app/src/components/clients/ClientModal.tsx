"use client";

import { useEffect } from "react";
import { ClientStatus } from "@prisma/client";

interface FormData {
  name: string;
  invoicedName: string;
  invoiceAttn: string;
  email: string;
  secondaryEmails: string;
  hourlyRate: string;
  status: ClientStatus;
  notes: string;
}

type ModalMode = "create" | "edit" | "delete";

interface ClientModalProps {
  mode: ModalMode;
  formData: FormData;
  selectedClientName?: string;
  isLoading: boolean;
  error: string | null;
  onFormChange: (updates: Partial<FormData>) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function ClientModal({
  mode,
  formData,
  selectedClientName,
  isLoading,
  error,
  onFormChange,
  onSubmit,
  onClose,
}: ClientModalProps) {
  const canSubmit = formData.name.trim();

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal Content */}
      <div className="relative bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded w-full max-w-md mx-4 animate-fade-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
            {mode === "create" && "Add New Client"}
            {mode === "edit" && "Edit Client"}
            {mode === "delete" && "Delete Client"}
          </h2>
        </div>

        {/* Body */}
        <div className="p-5">
          {mode === "delete" ? (
            <div>
              <p className="text-[var(--text-secondary)] text-[13px]">
                Are you sure you want to delete{" "}
                <span className="font-medium text-[var(--text-primary)]">
                  {selectedClientName}
                </span>
                ? This action cannot be undone.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Client Name <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => onFormChange({ name: e.target.value })}
                  className="
                    w-full px-3 py-2 rounded text-[13px]
                    bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                    text-[var(--text-primary)] placeholder-[var(--text-muted)]
                    focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                    focus:outline-none transition-all duration-200
                  "
                  placeholder="Enter client name"
                  autoFocus
                />
              </div>

              {/* Invoiced Name */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Invoiced Name
                </label>
                <input
                  type="text"
                  value={formData.invoicedName}
                  onChange={(e) => onFormChange({ invoicedName: e.target.value })}
                  className="
                    w-full px-3 py-2 rounded text-[13px]
                    bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                    text-[var(--text-primary)] placeholder-[var(--text-muted)]
                    focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                    focus:outline-none transition-all duration-200
                  "
                  placeholder="Name for outgoing invoices"
                />
              </div>

              {/* Invoice Attn */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Invoice Attn
                </label>
                <input
                  type="text"
                  value={formData.invoiceAttn}
                  onChange={(e) => onFormChange({ invoiceAttn: e.target.value })}
                  className="
                    w-full px-3 py-2 rounded text-[13px]
                    bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                    text-[var(--text-primary)] placeholder-[var(--text-muted)]
                    focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                    focus:outline-none transition-all duration-200
                  "
                  placeholder="Contact person for invoices"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => onFormChange({ email: e.target.value })}
                  className="
                    w-full px-3 py-2 rounded text-[13px]
                    bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                    text-[var(--text-primary)] placeholder-[var(--text-muted)]
                    focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                    focus:outline-none transition-all duration-200
                  "
                  placeholder="client@example.com"
                />
              </div>

              {/* Secondary Emails */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Secondary Email(s)
                </label>
                <input
                  type="text"
                  value={formData.secondaryEmails}
                  onChange={(e) => onFormChange({ secondaryEmails: e.target.value })}
                  className="
                    w-full px-3 py-2 rounded text-[13px]
                    bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                    text-[var(--text-primary)] placeholder-[var(--text-muted)]
                    focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                    focus:outline-none transition-all duration-200
                  "
                  placeholder="finance@acme.com, legal@acme.com"
                />
              </div>

              {/* Hourly Rate */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Hourly Rate (EUR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[13px]">
                    €
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.hourlyRate}
                    onChange={(e) => onFormChange({ hourlyRate: e.target.value })}
                    className="
                      w-full pl-7 pr-3 py-2 rounded text-[13px]
                      bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                      text-[var(--text-primary)] placeholder-[var(--text-muted)]
                      focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                      focus:outline-none transition-all duration-200
                    "
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => onFormChange({ status: e.target.value as ClientStatus })}
                  className="
                    w-full px-3 py-2 rounded text-[13px]
                    bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                    text-[var(--text-primary)]
                    focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                    focus:outline-none transition-all duration-200
                    cursor-pointer
                  "
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => onFormChange({ notes: e.target.value })}
                  rows={5}
                  className="
                    w-full px-3 py-2 rounded text-[13px]
                    bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                    text-[var(--text-primary)] placeholder-[var(--text-muted)]
                    focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                    focus:outline-none transition-all duration-200
                    resize-y min-h-[100px]
                  "
                  placeholder="Additional client information..."
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-3 px-3 py-2 rounded bg-[var(--danger-bg)] text-[var(--danger)] text-[13px]">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="
              px-3 py-1.5 rounded
              bg-[var(--bg-surface)] border border-[var(--border-subtle)]
              text-[var(--text-secondary)] text-[13px] font-medium
              hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]
              transition-all duration-200
              disabled:opacity-50
            "
          >
            Cancel
          </button>
          {mode === "delete" ? (
            <button
              onClick={onSubmit}
              disabled={isLoading}
              className="
                px-3 py-1.5 rounded
                bg-[var(--danger)] text-white text-[13px] font-medium
                hover:opacity-90
                transition-all duration-200
                disabled:opacity-50
              "
            >
              {isLoading ? "Deleting..." : "Delete"}
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={isLoading || !canSubmit}
              className="
                px-3 py-1.5 rounded
                bg-[var(--accent-pink)] text-[var(--bg-deep)] text-[13px] font-medium
                hover:bg-[var(--accent-pink-dim)]
                transition-all duration-200
                disabled:opacity-50
              "
            >
              {isLoading
                ? "Saving..."
                : mode === "create"
                ? "Create Client"
                : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
