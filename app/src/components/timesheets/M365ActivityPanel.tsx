"use client";

import type { M365ActivityResponse, M365CalendarEvent, M365Email } from "@/types";

interface M365ActivityPanelProps {
  data: M365ActivityResponse | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  date: string;
}

/**
 * Format a date string for display in the panel header.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format an ISO timestamp to display time only.
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format duration in minutes for display.
 */
function formatDuration(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours}h`;
  }
  return `${minutes} min`;
}

/**
 * Arrow up icon for sent emails.
 */
function ArrowUpIcon() {
  return (
    <svg
      data-testid="arrow-up-icon"
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      style={{ color: "var(--success)" }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 10l7-7m0 0l7 7m-7-7v18"
      />
    </svg>
  );
}

/**
 * Arrow down icon for received emails.
 */
function ArrowDownIcon() {
  return (
    <svg
      data-testid="arrow-down-icon"
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      style={{ color: "var(--info)" }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 14l-7 7m0 0l-7-7m7 7V3"
      />
    </svg>
  );
}

/**
 * Close (X) icon.
 */
function CloseIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

/**
 * Loading spinner.
 */
function LoadingSpinner() {
  return (
    <div data-testid="loading-spinner" className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-pink)]"></div>
      <span className="ml-3 text-[var(--text-muted)]">Loading...</span>
    </div>
  );
}

/**
 * Calendar event item component.
 */
function CalendarEventItem({ event }: { event: M365CalendarEvent }) {
  return (
    <div className="p-3 rounded bg-[var(--bg-surface)] mb-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[var(--text-primary)] truncate">
            {event.subject}
          </div>
          <div className="text-sm text-[var(--text-muted)] mt-1">
            {formatTime(event.start)} - {formatDuration(event.durationMinutes)}
          </div>
          {event.attendees.length > 0 && (
            <div className="text-sm text-[var(--text-muted)] mt-1">
              {event.attendees.join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Email item component.
 */
function EmailItem({ email }: { email: M365Email }) {
  const isSent = email.direction === "sent";

  return (
    <div className="p-3 rounded bg-[var(--bg-surface)] mb-2">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">
          {isSent ? <ArrowUpIcon /> : <ArrowDownIcon />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[var(--text-primary)] truncate">
            {email.subject}
          </div>
          <div className="text-sm text-[var(--text-muted)] mt-1">
            {isSent ? `To: ${email.to.join(", ")}` : `From: ${email.from}`}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {formatTime(email.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * M365ActivityPanel - Displays Microsoft 365 calendar events and emails for a specific date.
 */
export function M365ActivityPanel({
  data,
  isLoading,
  error,
  onClose,
  date,
}: M365ActivityPanelProps) {
  const hasNoData = data && data.calendar.length === 0 && data.emails.length === 0;

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
        <h3 className="font-heading text-lg text-[var(--text-primary)]">
          M365 Activity - {formatDate(date)}
        </h3>
        <button
          onClick={onClose}
          aria-label="Close"
          data-testid="close-button"
          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Loading state */}
        {isLoading && <LoadingSpinner />}

        {/* Error state */}
        {error && !isLoading && (
          <div className="text-center py-8 text-[var(--danger)]">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && hasNoData && (
          <div className="text-center py-8 text-[var(--text-muted)]">
            No activity found for this date.
          </div>
        )}

        {/* Data display */}
        {!isLoading && !error && data && !hasNoData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Calendar Events Column */}
            <div>
              <h4 className="font-heading text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
                Calendar Events
              </h4>
              {data.calendar.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)]">No events</div>
              ) : (
                <div className="space-y-2">
                  {data.calendar.map((event, index) => (
                    <CalendarEventItem key={`${event.start}-${index}`} event={event} />
                  ))}
                </div>
              )}
            </div>

            {/* Emails Column */}
            <div>
              <h4 className="font-heading text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
                Emails
              </h4>
              {data.emails.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)]">No emails</div>
              ) : (
                <div className="space-y-2">
                  {data.emails.map((email, index) => (
                    <EmailItem key={`${email.timestamp}-${index}`} email={email} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
