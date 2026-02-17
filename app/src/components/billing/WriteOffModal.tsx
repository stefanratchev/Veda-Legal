"use client";

import { useEffect } from "react";
import type { WriteOffAction } from "@/types";

interface WriteOffModalProps {
  onAction: (action: "remove" | WriteOffAction) => void;
  onCancel: () => void;
}

export function WriteOffModal({ onAction, onCancel }: WriteOffModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal Content */}
      <div className="relative bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded w-full max-w-sm mx-2 md:mx-4 animate-fade-up text-left">
        {/* Header */}
        <div className="px-4 py-3 md:px-5 md:py-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
            Line Item Action
          </h2>
        </div>

        {/* Options */}
        <div className="p-4 md:p-5 space-y-2">
          <button
            onClick={() => onAction("remove")}
            className="w-full text-left px-4 py-3 rounded border border-[var(--border-subtle)] hover:border-[var(--border-accent)] hover:bg-[var(--bg-surface)] transition-all duration-200 group"
          >
            <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-pink)]">
              Remove from invoice
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              Entry stays available for future invoices
            </div>
          </button>

          <button
            onClick={() => onAction("VISIBLE")}
            className="w-full text-left px-4 py-3 rounded border border-[var(--border-subtle)] hover:border-[var(--warning)] hover:bg-[var(--warning-bg)] transition-all duration-200 group"
          >
            <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--warning)]">
              Write off &mdash; show as waived
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              Permanently billed. Listed at zero on invoice
            </div>
          </button>

          <button
            onClick={() => onAction("HIDDEN")}
            className="w-full text-left px-4 py-3 rounded border border-[var(--border-subtle)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-deep)] transition-all duration-200 group"
          >
            <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-secondary)]">
              Write off &mdash; hide from invoice
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              Permanently billed. Hidden from client
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 md:px-5 md:py-3 border-t border-[var(--border-subtle)] flex items-center justify-end">
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
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
