"use client";

import { useEffect } from "react";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal Content */}
      <div className="relative bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded w-full max-w-sm mx-4 animate-fade-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-[var(--text-secondary)] text-[13px]">{message}</p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="
              px-3 py-1.5 rounded
              bg-[var(--bg-surface)] border border-[var(--border-subtle)]
              text-[var(--text-secondary)] text-[13px] font-medium
              hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]
              transition-all duration-200
            "
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`
              px-3 py-1.5 rounded text-[13px] font-medium
              transition-all duration-200
              ${
                isDestructive
                  ? "bg-[var(--danger)] text-white hover:opacity-90"
                  : "bg-[var(--accent-pink)] text-[var(--bg-deep)] hover:bg-[var(--accent-pink-dim)]"
              }
            `}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
