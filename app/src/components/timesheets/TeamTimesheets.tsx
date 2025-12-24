"use client";

import { TeamMemberRow } from "./TeamMemberRow";
import type { TeamSummary } from "@/types";

interface TeamTimesheetsProps {
  summaries: TeamSummary[];
  selectedDate: Date;
}

export function TeamTimesheets({ summaries, selectedDate }: TeamTimesheetsProps) {
  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        <span className="text-[12px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
          Team Timesheets
        </span>
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      </div>

      {/* Team Member Rows */}
      <div className="space-y-2">
        {summaries.map((summary) => (
          <TeamMemberRow
            key={summary.userId}
            summary={summary}
            selectedDate={selectedDate}
          />
        ))}
      </div>
    </div>
  );
}
