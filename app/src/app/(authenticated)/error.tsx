"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="w-16 h-16 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
        <svg
          className="w-8 h-8 text-[var(--text-muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-heading font-semibold text-[var(--text-primary)]">
        Something went wrong
      </h2>
      <p className="text-[var(--text-muted)] text-sm max-w-md text-center">
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded text-sm font-medium bg-[var(--accent-pink)] text-[var(--bg-deep)] hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  );
}
