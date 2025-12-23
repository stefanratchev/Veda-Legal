"use client";

import { Position } from "@prisma/client";

interface FormData {
  email: string;
  name: string;
  position: Position;
}

interface EmployeeModalProps {
  mode: "create" | "edit";
  formData: FormData;
  selectedEmployeeName?: string;
  isLoading: boolean;
  error: string | null;
  onFormChange: (updates: Partial<FormData>) => void;
  onSubmit: () => void;
  onClose: () => void;
}

// Position options available in the UI (Admin is not selectable)
const positionOptions: Array<{ value: Position; label: string; description: string }> = [
  { value: "PARTNER", label: "Partner", description: "Full system access, can manage clients and billing" },
  { value: "SENIOR_ASSOCIATE", label: "Senior Associate", description: "Can log time entries" },
  { value: "ASSOCIATE", label: "Associate", description: "Can log time entries" },
];

export function EmployeeModal({
  mode,
  formData,
  selectedEmployeeName,
  isLoading,
  error,
  onFormChange,
  onSubmit,
  onClose,
}: EmployeeModalProps) {
  const canSubmit = mode === "create"
    ? formData.email.trim().length > 0 && formData.position
    : formData.name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className="relative bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded w-full max-w-md mx-4 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
            {mode === "create" ? "Add Employee" : "Edit Employee"}
          </h2>
          {mode === "edit" && selectedEmployeeName && (
            <p className="text-[var(--text-muted)] text-[12px] mt-0.5">
              {selectedEmployeeName}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="space-y-3">
            {/* Email (create mode only) */}
            {mode === "create" && (
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Email <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => onFormChange({ email: e.target.value })}
                  className="w-full px-3 py-2 rounded text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)] focus:outline-none transition-all duration-200"
                  placeholder="employee@company.com"
                  autoFocus
                />
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                Display Name {mode === "edit" && <span className="text-[var(--danger)]">*</span>}
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
                placeholder={mode === "create" ? "Optional - will use Azure AD name" : "Enter employee name"}
                autoFocus={mode === "edit"}
              />
            </div>

            {/* Position */}
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                Position
              </label>
              <select
                value={formData.position}
                onChange={(e) => onFormChange({ position: e.target.value as Position })}
                className="
                  w-full px-3 py-2 rounded text-[13px]
                  bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                  text-[var(--text-primary)]
                  focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                  focus:outline-none transition-all duration-200
                  cursor-pointer
                "
              >
                {positionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                {positionOptions.find((o) => o.value === formData.position)?.description}
              </p>
            </div>
          </div>

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
            {isLoading ? "Saving..." : mode === "create" ? "Add Employee" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
