"use client";

interface SubmitPromptModalProps {
  date: string;
  totalHours: number;
  onSubmit: () => void;
  onDismiss: () => void;
}

export function SubmitPromptModal({
  date,
  totalHours,
  onSubmit,
  onDismiss,
}: SubmitPromptModalProps) {
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-elevated)] rounded-lg p-6 max-w-md w-full mx-4 shadow-xl animate-fade-up">
        <h3 className="text-lg font-heading font-semibold text-[var(--text-primary)] mb-2">
          Submit Timesheet?
        </h3>
        <p className="text-[var(--text-secondary)] mb-4">
          You&apos;ve logged {totalHours.toFixed(1)} hours for {formattedDate}. Ready to submit?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 py-2 px-4 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            Not yet
          </button>
          <button
            onClick={onSubmit}
            className="flex-1 py-2 px-4 rounded-lg bg-[var(--success)] text-white hover:bg-[var(--success)]/90 transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
