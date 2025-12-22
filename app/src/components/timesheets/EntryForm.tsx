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
}

export function EntryForm({
  clients,
  topics,
  formData,
  isLoading,
  error,
  onFormChange,
  onSubmit,
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

    if (subtopic.isPrefix) {
      // For prefix subtopics: highlight description and focus it for user to add details
      setHighlightDescription(true);
      setTimeout(() => {
        descriptionInputRef.current?.focus();
        // Place cursor at end of text
        const input = descriptionInputRef.current;
        if (input) {
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 0);
    } else {
      // For regular subtopics: auto-open duration picker
      setTimeout(() => durationPickerRef.current?.open(), 0);
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear highlight when user starts typing
    if (highlightDescription) {
      setHighlightDescription(false);
    }
    onFormChange({ description: e.target.value });
  };

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
      <div className="flex items-center gap-3">
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
          className="w-[220px] flex-shrink-0"
        />

        {/* Topic/Subtopic Cascade Selector */}
        <TopicCascadeSelect
          ref={topicSelectRef}
          topics={topics}
          value={formData.subtopicId}
          onChange={handleSubtopicSelect}
          placeholder="Select topic..."
          className="w-[260px] flex-shrink-0"
        />

        {/* Duration Picker */}
        <DurationPicker
          ref={durationPickerRef}
          hours={formData.hours}
          minutes={formData.minutes}
          onChange={(hours, minutes) => {
            onFormChange({ hours, minutes });
            // Auto-focus description after duration selection
            setTimeout(() => descriptionInputRef.current?.focus(), 0);
          }}
          className="w-[120px] flex-shrink-0"
        />

        {/* Description */}
        <input
          ref={descriptionInputRef}
          type="text"
          value={formData.description}
          onChange={handleDescriptionChange}
          onKeyDown={handleKeyDown}
          placeholder="What did you work on?"
          className={`
            flex-1 min-w-[200px] px-3 py-2 rounded text-sm
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[var(--text-primary)] placeholder-[var(--text-muted)]
            focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
            focus:outline-none transition-all duration-200
            ${highlightDescription ? "ring-[2px] ring-[var(--accent-pink-glow)] border-[var(--border-accent)]" : ""}
          `}
        />

        {/* Submit Button */}
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
          {isLoading ? "..." : "Log"}
        </button>
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
