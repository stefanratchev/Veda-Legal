"use client";

interface SubmitButtonProps {
  totalHours: number;
  isSubmitted: boolean;
  isLoading: boolean;
  onSubmit: () => void;
}

const MIN_HOURS = 8;

export function SubmitButton({
  totalHours,
  isSubmitted,
  isLoading,
  onSubmit,
}: SubmitButtonProps) {
  if (isSubmitted) {
    return null;
  }

  const canSubmit = totalHours >= MIN_HOURS;

  return (
    <button
      onClick={onSubmit}
      disabled={!canSubmit || isLoading}
      className={`
        w-full py-3 px-4 rounded-lg font-medium transition-all duration-200
        ${canSubmit
          ? "bg-[var(--success)] text-white hover:bg-[var(--success)]/90"
          : "bg-[var(--bg-surface)] text-[var(--text-muted)] cursor-not-allowed"
        }
      `}
      title={!canSubmit ? `Log ${MIN_HOURS} hours to submit (${totalHours.toFixed(1)} logged)` : undefined}
    >
      {isLoading ? (
        "Submitting..."
      ) : canSubmit ? (
        `Submit (${totalHours.toFixed(1)} hours)`
      ) : (
        `Log ${MIN_HOURS} hours to submit (${totalHours.toFixed(1)} logged)`
      )}
    </button>
  );
}
