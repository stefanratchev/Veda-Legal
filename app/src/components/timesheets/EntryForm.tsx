"use client";

import { useRef, useState, useEffect } from "react";
import { ClientSelect } from "@/components/ui/ClientSelect";
import {
  TopicCascadeSelect,
  TopicCascadeSelectRef,
} from "@/components/ui/TopicCascadeSelect";
import { DurationPicker, DurationPickerRef } from "@/components/ui/DurationPicker";
import type { Client, Topic, Subtopic, FormData } from "@/types";

interface EntryFormProps {
  clients: Client[];
  topics: Topic[];
  formData: FormData;
  isLoading: boolean;
  error: string | null;
  onFormChange: (updates: Partial<FormData>) => void;
  onSubmit: () => void;
  // Edit mode props
  isEditMode?: boolean;
  onCancel?: () => void;
}

export function EntryForm({
  clients,
  topics,
  formData,
  isLoading,
  error,
  onFormChange,
  onSubmit,
  isEditMode = false,
  onCancel,
}: EntryFormProps) {
  const topicSelectRef = useRef<TopicCascadeSelectRef>(null);
  const durationPickerRef = useRef<DurationPickerRef>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const [highlightDescription, setHighlightDescription] = useState(false);

  // Clear highlight after 1 second
  useEffect(() => {
    if (highlightDescription) {
      const timer = setTimeout(() => setHighlightDescription(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [highlightDescription]);

  const canSubmit =
    formData.clientId &&
    formData.subtopicId &&
    (formData.hours > 0 || formData.minutes > 0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSubmit && !isLoading) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleSubtopicSelect = (
    subtopicId: string,
    subtopic: Subtopic
  ) => {
    // Pre-fill description with subtopic name
    const description = subtopic.isPrefix ? `${subtopic.name} ` : subtopic.name;
    onFormChange({ subtopicId, description });

    // Always open duration picker after subtopic selection
    // For prefix subtopics, highlight description to indicate user should add details later
    if (subtopic.isPrefix) {
      setHighlightDescription(true);
    }
    setTimeout(() => durationPickerRef.current?.open(), 0);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear highlight when user starts typing
    if (highlightDescription) {
      setHighlightDescription(false);
    }
    onFormChange({ description: e.target.value });
  };

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-3 lg:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Client Selector */}
        <ClientSelect
          clients={clients}
          value={formData.clientId}
          onChange={(clientId) => {
            onFormChange({ clientId });
            // Auto-open topic picker after client selection
            setTimeout(() => topicSelectRef.current?.open(), 0);
          }}
          placeholder="Select client..."
          className="w-full lg:w-[160px] lg:flex-shrink-0"
        />

        {/* Topic/Subtopic Cascade Selector */}
        <TopicCascadeSelect
          ref={topicSelectRef}
          topics={topics}
          value={formData.subtopicId}
          onChange={handleSubtopicSelect}
          placeholder="Select topic..."
          className="w-full lg:w-[160px] lg:flex-shrink-0"
        />

        {/* Duration + Actions Row (mobile) / inline (desktop) */}
        <div className="flex items-center gap-2 lg:contents">
          <DurationPicker
            ref={durationPickerRef}
            hours={formData.hours}
            minutes={formData.minutes}
            onChange={(hours, minutes) => {
              onFormChange({ hours, minutes });
              // Auto-focus description after duration selection
              setTimeout(() => descriptionInputRef.current?.focus(), 0);
            }}
            className="w-[100px] flex-shrink-0"
          />

          {/* Action Buttons - visible on mobile in this row */}
          <div className="flex items-center gap-2 lg:hidden ml-auto">
            {isEditMode && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="
                  px-3 py-2 rounded flex-shrink-0
                  text-[var(--text-secondary)] text-sm
                  bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                  hover:border-[var(--border-accent)]
                  transition-colors
                "
              >
                Cancel
              </button>
            )}
            <button
              onClick={onSubmit}
              disabled={!canSubmit || isLoading}
              className="
                px-4 py-2 rounded flex-shrink-0
                bg-[var(--accent-pink)] text-[var(--bg-deep)]
                font-semibold text-sm
                hover:bg-[var(--accent-pink-dim)]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
                shadow-lg shadow-[var(--accent-pink-glow)]
              "
            >
              {isLoading ? "..." : isEditMode ? "Save" : "Log"}
            </button>
          </div>
        </div>

        {/* Description */}
        <input
          ref={descriptionInputRef}
          type="text"
          value={formData.description}
          onChange={handleDescriptionChange}
          onKeyDown={handleKeyDown}
          placeholder="What did you work on?"
          className={`
            w-full lg:flex-1 lg:min-w-[200px] px-3 py-2 rounded text-sm
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[var(--text-primary)] placeholder-[var(--text-muted)]
            focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
            focus:outline-none transition-all duration-200
            ${highlightDescription ? "ring-[2px] ring-[var(--accent-pink-glow)] border-[var(--border-accent)]" : ""}
          `}
        />

        {/* Action Buttons - desktop only (inline) */}
        <div className="hidden lg:flex items-center gap-2">
          {isEditMode && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="
                px-3 py-2 rounded flex-shrink-0
                text-[var(--text-secondary)] text-sm
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                hover:border-[var(--border-accent)]
                transition-colors
              "
            >
              Cancel
            </button>
          )}
          <button
            onClick={onSubmit}
            disabled={!canSubmit || isLoading}
            className="
              px-4 py-2 rounded flex-shrink-0
              bg-[var(--accent-pink)] text-[var(--bg-deep)]
              font-semibold text-sm
              hover:bg-[var(--accent-pink-dim)]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              shadow-lg shadow-[var(--accent-pink-glow)]
            "
          >
            {isLoading ? "..." : isEditMode ? "Save" : "Log"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 px-3 py-2 rounded bg-[var(--danger-bg)] text-[var(--danger)] text-[13px]">
          {error}
        </div>
      )}
    </div>
  );
}
