"use client";

import { useState, useRef, useEffect } from "react";
import { Topic } from "@/types";

type TopicType = "REGULAR" | "INTERNAL" | "MANAGEMENT";

interface TopicModalProps {
  topic: Topic | null;
  onSave: (data: { name: string; topicType: TopicType }) => void;
  onClose: () => void;
}

export function TopicModal({ topic, onSave, onClose }: TopicModalProps) {
  const [name, setName] = useState(topic?.name || "");
  const [topicType, setTopicType] = useState<TopicType>(topic?.topicType || "REGULAR");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    await onSave({ name: name.trim(), topicType });
    setIsSubmitting(false);
  };

  const canSubmit = name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-xl animate-fade-up">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
            {topic ? "Edit Topic" : "Add Topic"}
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
                placeholder="e.g., Client Meetings/Calls"
                className="
                  w-full px-4 py-2.5 rounded
                  bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                  text-[var(--text-primary)] placeholder-[var(--text-muted)]
                  focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                  focus:outline-none transition-all duration-200
                "
              />
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Category for grouping related subtopics
              </p>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
                Type
              </label>
              <select
                value={topicType}
                onChange={(e) => setTopicType(e.target.value as TopicType)}
                className="
                  w-full px-4 py-2.5 rounded
                  bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                  text-[var(--text-primary)]
                  focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                  focus:outline-none transition-all duration-200
                "
              >
                <option value="REGULAR">Regular</option>
                <option value="INTERNAL">Internal</option>
                <option value="MANAGEMENT">Management</option>
              </select>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Internal/Management topics have no subtopics
              </p>
            </div>
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
              {isSubmitting ? "Saving..." : topic ? "Save Changes" : "Create Topic"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
