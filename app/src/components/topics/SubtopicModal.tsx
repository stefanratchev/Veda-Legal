"use client";

import { useState, useRef, useEffect } from "react";
import { Subtopic } from "@/types";

interface SubtopicModalProps {
  subtopic: Subtopic | null;
  onSave: (data: { name: string }) => void;
  onClose: () => void;
}

export function SubtopicModal({ subtopic, onSave, onClose }: SubtopicModalProps) {
  const [name, setName] = useState(subtopic?.name || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    await onSave({ name: name.trim() });
    setIsSubmitting(false);
  };

  const canSubmit = name.trim().length > 0;
  const isPrefix = name.trim().endsWith(":");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-xl animate-fade-up">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
            {subtopic ? "Edit Subtopic" : "Add Subtopic"}
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Name <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Preparation of:"
                className="
                  w-full px-4 py-2.5 rounded
                  bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                  text-[var(--text-primary)] placeholder-[var(--text-muted)]
                  focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                  focus:outline-none transition-all duration-200
                "
              />
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                End with &apos;:&apos; if lawyers should add specifics (e.g., &quot;Preparation of:&quot;)
              </p>
            </div>

            {/* Prefix indicator */}
            {name.trim().length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                {isPrefix ? (
                  <>
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--info-bg)] text-[var(--info)] rounded">
                      prefix
                    </span>
                    <span className="text-[12px] text-[var(--text-secondary)]">
                      Lawyers will add details after this text
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--bg-deep)] text-[var(--text-muted)] rounded">
                      complete
                    </span>
                    <span className="text-[12px] text-[var(--text-secondary)]">
                      This text will be used as-is
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="
                px-4 py-2 rounded
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                text-[var(--text-secondary)] text-sm font-medium
                hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]
                transition-all
              "
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="
                px-4 py-2 rounded
                bg-[var(--accent-pink)] text-[var(--bg-deep)]
                text-sm font-semibold
                hover:bg-[var(--accent-pink-dim)]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all
              "
            >
              {isSubmitting ? "Saving..." : subtopic ? "Save Changes" : "Create Subtopic"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
