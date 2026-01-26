"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface UserOverdue {
  userId: string;
  name: string;
  dates: string[];
}

interface OverdueBannerProps {
  isAdmin: boolean;
  userName?: string;
}

/**
 * Alert icon with subtle pulse animation
 */
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Team icon for admin view
 */
function TeamIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  );
}

/**
 * Chevron icon for expandable sections
 */
function ChevronIcon({ expanded, className }: { expanded: boolean; className?: string }) {
  return (
    <svg
      className={`${className} transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function OverdueBanner({ isAdmin, userName }: OverdueBannerProps) {
  const [overdueData, setOverdueData] = useState<string[] | UserOverdue[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTeamExpanded, setIsTeamExpanded] = useState(false);

  const fetchOverdue = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/timesheets/overdue");
      if (!response.ok) {
        setError("Failed to load overdue status");
        return;
      }
      const data = await response.json();
      setOverdueData(data.overdue);
    } catch (err) {
      console.error("Failed to fetch overdue status:", err);
      setError("Failed to load overdue status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverdue();
    // Poll every 5 minutes
    const interval = setInterval(fetchOverdue, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchOverdue]);

  // Show error state
  if (error) {
    return (
      <div className="bg-gradient-to-r from-[var(--danger)]/10 via-[var(--danger)]/5 to-transparent border-b border-[var(--danger)]/20 px-4 py-2">
        <p className="text-[var(--danger)] text-sm">
          {error}
        </p>
      </div>
    );
  }

  if (isLoading || !overdueData || overdueData.length === 0) {
    return null;
  }

  // Format date for display: "Mon 20"
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
    });
  };

  // Format date range for summary: "Mon 29 Dec - Thu 22 Jan"
  const formatDateRange = (dates: string[]) => {
    if (dates.length === 0) return "";
    if (dates.length === 1) return formatDate(dates[0]);

    const sorted = [...dates].sort();
    const first = new Date(sorted[0] + "T00:00:00");
    const last = new Date(sorted[sorted.length - 1] + "T00:00:00");

    const firstStr = first.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const lastStr = last.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

    return `${firstStr} — ${lastStr}`;
  };

  // Admin view: show team overdue summary AND personal banner if admin has overdue
  if (isAdmin && typeof overdueData[0] === "object" && "userId" in overdueData[0]) {
    const teamOverdue = overdueData as UserOverdue[];

    // Find admin's own overdue dates by matching name
    const adminOverdue = userName
      ? teamOverdue.find((u) => u.name === userName)
      : null;

    const totalTeamOverdue = teamOverdue.reduce((sum, u) => sum + u.dates.length, 0);

    return (
      <div className="border-b border-[var(--danger)]/20">
        {/* Personal overdue banner for admin */}
        {adminOverdue && adminOverdue.dates.length > 0 && (
          <div className="bg-gradient-to-r from-[var(--danger)]/15 via-[var(--danger)]/8 to-transparent">
            <div className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                {/* Icon with glow */}
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-[var(--danger)] blur-md opacity-40 animate-pulse" />
                  <AlertIcon className="relative w-4 h-4 text-[var(--danger)]" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">
                      You have{" "}
                      <span className="text-[var(--danger)] font-semibold">
                        {adminOverdue.dates.length} overdue
                      </span>{" "}
                      {adminOverdue.dates.length === 1 ? "timesheet" : "timesheets"}
                    </span>
                    <span className="text-[var(--text-muted)] text-[12px]">
                      {formatDateRange(adminOverdue.dates)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors p-1"
                    title={isExpanded ? "Collapse" : "Show all dates"}
                  >
                    <ChevronIcon expanded={isExpanded} className="w-4 h-4" />
                  </button>
                  <Link
                    href="/timesheets"
                    className="text-[12px] font-medium px-3 py-1 rounded bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80 transition-colors"
                  >
                    Fix now
                  </Link>
                </div>
              </div>

              {/* Expanded dates */}
              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-[var(--danger)]/10">
                  <div className="flex flex-wrap gap-1.5">
                    {adminOverdue.dates.map((date) => (
                      <span
                        key={date}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--danger)]/20 text-[var(--danger)] font-medium"
                      >
                        {formatDate(date)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Team overdue banner */}
        <div className="bg-gradient-to-r from-[var(--warning)]/10 via-[var(--warning)]/5 to-transparent">
          <div className="px-4 py-2.5">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className="relative flex-shrink-0">
                <TeamIcon className="w-4 h-4 text-[var(--warning)]" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">
                    Team:{" "}
                    <span className="text-[var(--warning)] font-semibold">
                      {totalTeamOverdue} overdue
                    </span>{" "}
                    across {teamOverdue.length} {teamOverdue.length === 1 ? "person" : "people"}
                  </span>
                </div>
              </div>

              {/* Expand button */}
              <button
                onClick={() => setIsTeamExpanded(!isTeamExpanded)}
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors p-1"
                title={isTeamExpanded ? "Collapse" : "Show details"}
              >
                <ChevronIcon expanded={isTeamExpanded} className="w-4 h-4" />
              </button>
            </div>

            {/* Expanded team details */}
            {isTeamExpanded && (
              <div className="mt-2 pt-2 border-t border-[var(--warning)]/10">
                <div className="flex flex-wrap gap-2">
                  {teamOverdue.map((user) => (
                    <span
                      key={user.userId}
                      className="text-[11px] px-2 py-1 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] font-medium"
                    >
                      {user.name.split(" ")[0]}{" "}
                      <span className="text-[var(--warning)]">({user.dates.length})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular user view: show own overdue dates with link
  const userOverdue = overdueData as string[];

  return (
    <div className="bg-gradient-to-r from-[var(--danger)]/15 via-[var(--danger)]/8 to-transparent border-b border-[var(--danger)]/20">
      <div className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          {/* Icon with glow */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-[var(--danger)] blur-md opacity-40 animate-pulse" />
            <AlertIcon className="relative w-4 h-4 text-[var(--danger)]" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-medium text-[var(--text-primary)]">
                You have{" "}
                <span className="text-[var(--danger)] font-semibold">
                  {userOverdue.length} overdue
                </span>{" "}
                {userOverdue.length === 1 ? "timesheet" : "timesheets"}
              </span>
              <span className="text-[var(--text-muted)] text-[12px]">
                {formatDateRange(userOverdue)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors p-1"
              title={isExpanded ? "Collapse" : "Show all dates"}
            >
              <ChevronIcon expanded={isExpanded} className="w-4 h-4" />
            </button>
            <Link
              href="/timesheets"
              className="text-[12px] font-medium px-3 py-1 rounded bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80 transition-colors"
            >
              Fix now
            </Link>
          </div>
        </div>

        {/* Expanded dates */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-[var(--danger)]/10">
            <div className="flex flex-wrap gap-1.5">
              {userOverdue.map((date) => (
                <span
                  key={date}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--danger)]/20 text-[var(--danger)] font-medium"
                >
                  {formatDate(date)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
