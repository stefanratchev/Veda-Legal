"use client";

import { useRef } from "react";
import { ClientSelect } from "@/components/ui/ClientSelect";
import { DurationPicker, DurationPickerRef } from "@/components/ui/DurationPicker";

interface Client {
  id: string;
  name: string;
  timesheetCode: string;
}

interface FormData {
  clientId: string;
  hours: number;
  minutes: number;
  description: string;
}

interface EntryFormProps {
  clients: Client[];
  formData: FormData;
  isLoading: boolean;
  error: string | null;
  onFormChange: (updates: Partial<FormData>) => void;
  onSubmit: () => void;
}

export function EntryForm({
  clients,
  formData,
  isLoading,
  error,
  onFormChange,
  onSubmit,
}: EntryFormProps) {
  const durationPickerRef = useRef<DurationPickerRef>(null);

  const canSubmit =
    formData.clientId &&
    formData.description.trim().length >= 10 &&
    (formData.hours > 0 || formData.minutes > 0);

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
      <div className="flex items-center gap-3">
        {/* Client Selector */}
        <ClientSelect
          clients={clients}
          value={formData.clientId}
          onChange={(clientId) => {
            onFormChange({ clientId });
            // Auto-open duration picker after client selection
            setTimeout(() => durationPickerRef.current?.open(), 0);
          }}
          placeholder="Select client..."
          className="w-[220px] flex-shrink-0"
        />

        {/* Duration Picker */}
        <DurationPicker
          ref={durationPickerRef}
          hours={formData.hours}
          minutes={formData.minutes}
          onChange={(hours, minutes) => onFormChange({ hours, minutes })}
          className="w-[120px] flex-shrink-0"
        />

        {/* Description */}
        <input
          type="text"
          value={formData.description}
          onChange={(e) => onFormChange({ description: e.target.value })}
          placeholder="What did you work on? (min 10 chars)"
          className="
            flex-1 min-w-[200px] px-3 py-2 rounded text-sm
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[var(--text-primary)] placeholder-[var(--text-muted)]
            focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
            focus:outline-none transition-all duration-200
          "
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
