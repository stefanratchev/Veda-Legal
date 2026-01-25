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
}

export function OverdueBanner({ isAdmin }: OverdueBannerProps) {
  const [overdueData, setOverdueData] = useState<string[] | UserOverdue[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="bg-[var(--danger-bg)] border-b border-[var(--danger)] px-4 py-2">
        <p className="text-[var(--danger)] text-sm font-medium">
          {error}
        </p>
      </div>
    );
  }

  if (isLoading || !overdueData || overdueData.length === 0) {
    return null;
  }

  // Format date for display: "Mon Jan 20"
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  // Admin view: show team overdue summary
  if (isAdmin && typeof overdueData[0] === "object" && "userId" in overdueData[0]) {
    const teamOverdue = overdueData as UserOverdue[];
    const summaryText = teamOverdue
      .map((u) => `${u.name} (${u.dates.length} day${u.dates.length > 1 ? "s" : ""})`)
      .join(", ");

    return (
      <div className="bg-[var(--danger-bg)] border-b border-[var(--danger)] px-4 py-2">
        <p className="text-[var(--danger)] text-sm font-medium">
          Overdue timesheets: {summaryText}
        </p>
      </div>
    );
  }

  // Regular user view: show own overdue dates with link
  const userOverdue = overdueData as string[];
  const datesText = userOverdue.map(formatDate).join(", ");

  return (
    <Link
      href="/timesheets"
      className="block bg-[var(--danger-bg)] border-b border-[var(--danger)] px-4 py-2 hover:bg-[var(--danger)]/20 transition-colors"
    >
      <p className="text-[var(--danger)] text-sm font-medium">
        You have overdue timesheets for: {datesText}
      </p>
    </Link>
  );
}
