# Team Timesheets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable ADMIN/PARTNER users to view all employees' timesheets for the selected day, with collapsible lazy-loaded sections per team member.

**Architecture:** Extend existing timesheets API to return team summaries for privileged users. New endpoint for lazy-loading individual employee entries. New UI components render collapsible team sections below user's own entries.

**Tech Stack:** Next.js API routes, Drizzle ORM, React components with Tailwind CSS

---

## Task 1: Add TeamSummary Type

**Files:**
- Modify: `app/src/types/index.ts`

**Step 1: Add the TeamSummary interface**

Add after the `TimeEntry` interface (around line 52):

```typescript
/**
 * Summary of an employee's time entries for team view.
 */
export interface TeamSummary {
  userId: string;
  userName: string;
  position: string;
  totalHours: number;
}
```

**Step 2: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat(types): add TeamSummary interface for team timesheets"
```

---

## Task 2: Add Team View Authorization Helper

**Files:**
- Modify: `app/src/lib/api-utils.ts`

**Step 1: Add the TEAM_VIEW_POSITIONS constant and helper**

Add after line 17 (after `WRITE_POSITIONS`):

```typescript
// Positions that can view team timesheets
const TEAM_VIEW_POSITIONS = ["ADMIN", "PARTNER"] as const;

/**
 * Check if a position can view team timesheets.
 */
export function canViewTeamTimesheets(position: string): boolean {
  return TEAM_VIEW_POSITIONS.includes(position as (typeof TEAM_VIEW_POSITIONS)[number]);
}
```

**Step 2: Commit**

```bash
git add app/src/lib/api-utils.ts
git commit -m "feat(api-utils): add canViewTeamTimesheets authorization helper"
```

---

## Task 3: Extend getUserFromSession to Return Position

**Files:**
- Modify: `app/src/lib/api-utils.ts`

**Step 1: Add position to the columns returned**

Change the `getUserFromSession` function (around line 98-105) to include position:

```typescript
/**
 * Get user from session email.
 */
export async function getUserFromSession(email: string | null | undefined) {
  if (!email) return null;

  return db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, email: true, name: true, position: true },
  });
}
```

**Step 2: Commit**

```bash
git add app/src/lib/api-utils.ts
git commit -m "feat(api-utils): include position in getUserFromSession result"
```

---

## Task 4: Modify Timesheets GET Endpoint for Team Summaries

**Files:**
- Modify: `app/src/app/api/timesheets/route.ts`

**Step 1: Add imports**

Add to the imports at the top of the file:

```typescript
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { users } from "@/lib/schema";
import { canViewTeamTimesheets } from "@/lib/api-utils";
```

Note: `eq`, `and`, `desc` already imported - just add `sql`, `ne`.

**Step 2: Add team summaries query and response logic**

Replace the GET function's try block (lines 64-100) with:

```typescript
  try {
    // Fetch current user's entries
    const entries = await db.query.timeEntries.findMany({
      where: and(
        eq(timeEntries.userId, user.id),
        eq(timeEntries.date, dateStr)
      ),
      columns: {
        id: true,
        date: true,
        hours: true,
        description: true,
        clientId: true,
        subtopicId: true,
        topicName: true,
        subtopicName: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        client: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [desc(timeEntries.createdAt)],
    });

    const serializedEntries = entries.map(serializeTimeEntry);

    // For ADMIN/PARTNER: also fetch team summaries
    if (user.position && canViewTeamTimesheets(user.position)) {
      const teamSummaries = await db
        .select({
          userId: users.id,
          userName: users.name,
          position: users.position,
          totalHours: sql<string>`COALESCE(SUM(CAST(${timeEntries.hours} AS DECIMAL)), 0)`,
        })
        .from(users)
        .leftJoin(
          timeEntries,
          and(
            eq(timeEntries.userId, users.id),
            eq(timeEntries.date, dateStr)
          )
        )
        .where(
          and(
            ne(users.id, user.id),
            eq(users.status, 'ACTIVE')
          )
        )
        .groupBy(users.id, users.name, users.position)
        .having(sql`SUM(CAST(${timeEntries.hours} AS DECIMAL)) > 0`)
        .orderBy(sql`SUM(CAST(${timeEntries.hours} AS DECIMAL)) DESC`);

      return NextResponse.json({
        entries: serializedEntries,
        teamSummaries: teamSummaries.map((s) => ({
          ...s,
          userName: s.userName || "Unknown",
          totalHours: Number(s.totalHours),
        })),
      });
    }

    // For regular users: return entries array directly (backward compatible)
    return NextResponse.json(serializedEntries);
  } catch (error) {
    console.error("Database error fetching time entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch time entries" },
      { status: 500 }
    );
  }
```

**Step 3: Commit**

```bash
git add app/src/app/api/timesheets/route.ts
git commit -m "feat(api): add team summaries to timesheets GET for ADMIN/PARTNER"
```

---

## Task 5: Create Team Member Entries Endpoint

**Files:**
- Create: `app/src/app/api/timesheets/team/[userId]/route.ts`

**Step 1: Create the directory structure**

```bash
mkdir -p app/src/app/api/timesheets/team/\[userId\]
```

**Step 2: Create the endpoint file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeEntries, clients } from "@/lib/schema";
import {
  requireAuth,
  getUserFromSession,
  serializeDecimal,
  canViewTeamTimesheets,
} from "@/lib/api-utils";

function serializeTimeEntry(entry: {
  id: string;
  date: string;
  hours: string;
  description: string;
  clientId: string;
  client: { id: string; name: string } | null;
  subtopicId: string | null;
  topicName: string;
  subtopicName: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    ...entry,
    hours: serializeDecimal(entry.hours),
  };
}

// GET /api/timesheets/team/[userId]?date=YYYY-MM-DD
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const currentUser = await getUserFromSession(auth.session.user?.email);
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Authorization: only ADMIN/PARTNER can view team entries
  if (!currentUser.position || !canViewTeamTimesheets(currentUser.position)) {
    return NextResponse.json(
      { error: "You don't have permission to view team timesheets" },
      { status: 403 }
    );
  }

  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  if (!dateParam) {
    return NextResponse.json(
      { error: "Date parameter is required" },
      { status: 400 }
    );
  }

  const date = new Date(dateParam);
  if (isNaN(date.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format" },
      { status: 400 }
    );
  }

  const dateStr = date.toISOString().split("T")[0];

  try {
    const entries = await db.query.timeEntries.findMany({
      where: and(
        eq(timeEntries.userId, userId),
        eq(timeEntries.date, dateStr)
      ),
      columns: {
        id: true,
        date: true,
        hours: true,
        description: true,
        clientId: true,
        subtopicId: true,
        topicName: true,
        subtopicName: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        client: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [desc(timeEntries.createdAt)],
    });

    return NextResponse.json(entries.map(serializeTimeEntry));
  } catch (error) {
    console.error("Database error fetching team member entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch team member entries" },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add app/src/app/api/timesheets/team/
git commit -m "feat(api): add team member entries endpoint with authorization"
```

---

## Task 6: Add readOnly Prop to EntryRow Component

**Files:**
- Modify: `app/src/components/timesheets/EntryRow.tsx`

**Step 1: Update the interface and component**

Replace the entire file with:

```typescript
"use client";

import { formatHours } from "@/lib/date-utils";
import type { TimeEntry } from "@/types";

interface EntryRowProps {
  entry: TimeEntry;
  onDeleteClick?: () => void;
  readOnly?: boolean;
}

export function EntryRow({ entry, onDeleteClick, readOnly = false }: EntryRowProps) {
  return (
    <tr className="hover:bg-[var(--bg-hover)] transition-colors">
      <td
        className="px-4 py-3 text-[13px] text-[var(--text-secondary)] truncate max-w-[150px]"
        title={entry.client.name}
      >
        {entry.client.name}
      </td>
      <td
        className="px-4 py-3 text-[13px] text-[var(--text-secondary)] truncate max-w-[180px]"
        title={entry.topicName || undefined}
      >
        {entry.topicName || "—"}
      </td>
      <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)] text-right whitespace-nowrap">
        {formatHours(entry.hours)}
      </td>
      <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)]">
        {entry.description}
      </td>
      {!readOnly && (
        <td className="px-4 py-3">
          <button
            onClick={onDeleteClick}
            className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
            title="Delete entry"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      )}
    </tr>
  );
}
```

**Step 2: Commit**

```bash
git add app/src/components/timesheets/EntryRow.tsx
git commit -m "feat(EntryRow): add readOnly prop to hide delete button"
```

---

## Task 7: Add readOnly Prop to EntriesList Component

**Files:**
- Modify: `app/src/components/timesheets/EntriesList.tsx`

**Step 1: Update the interface**

Update the interface (around line 9-13):

```typescript
interface EntriesListProps {
  entries: TimeEntry[];
  isLoadingEntries: boolean;
  onDeleteEntry?: (entryId: string) => void;
  readOnly?: boolean;
}
```

**Step 2: Update the component props destructuring**

Update the function signature (around line 15-19):

```typescript
export function EntriesList({
  entries,
  isLoadingEntries,
  onDeleteEntry,
  readOnly = false,
}: EntriesListProps) {
```

**Step 3: Conditionally render the delete column header**

Update the table header row (inside thead, around line 56-70). Replace the last th:

```typescript
                {!readOnly && (
                  <th className="w-[50px] px-4 py-2"></th>
                )}
```

**Step 4: Update EntryRow usage**

Update the EntryRow component usage (around line 74-78):

```typescript
              {entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onDeleteClick={readOnly ? undefined : () => setEntryToDelete(entry)}
                  readOnly={readOnly}
                />
              ))}
```

**Step 5: Conditionally render delete modal**

Wrap the ConfirmModal (around line 96-105):

```typescript
      {/* Delete Confirmation Modal */}
      {!readOnly && entryToDelete && (
        <ConfirmModal
          title="Delete Entry"
          message={`Are you sure you want to delete this ${formatHours(entryToDelete.hours)} entry for ${entryToDelete.client.name}? This action cannot be undone.`}
          confirmLabel="Delete"
          isDestructive
          onConfirm={handleConfirmDelete}
          onCancel={() => setEntryToDelete(null)}
        />
      )}
```

**Step 6: Commit**

```bash
git add app/src/components/timesheets/EntriesList.tsx
git commit -m "feat(EntriesList): add readOnly prop to hide delete functionality"
```

---

## Task 8: Create TeamMemberRow Component

**Files:**
- Create: `app/src/components/timesheets/TeamMemberRow.tsx`

**Step 1: Create the component file**

```typescript
"use client";

import { useState, useEffect } from "react";
import { formatDateISO, formatHours } from "@/lib/date-utils";
import { EntriesList } from "./EntriesList";
import type { TimeEntry, TeamSummary } from "@/types";

interface TeamMemberRowProps {
  summary: TeamSummary;
  selectedDate: Date;
}

const POSITION_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PARTNER: "Partner",
  SENIOR_ASSOCIATE: "Senior Associate",
  ASSOCIATE: "Associate",
  CONSULTANT: "Consultant",
};

export function TeamMemberRow({ summary, selectedDate }: TeamMemberRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [entries, setEntries] = useState<TimeEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset entries cache when date changes
  useEffect(() => {
    setEntries(null);
    setIsExpanded(false);
    setError(null);
  }, [selectedDate]);

  const handleToggle = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);

    // If we already have entries cached, don't re-fetch
    if (entries !== null) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/timesheets/team/${summary.userId}?date=${formatDateISO(selectedDate)}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch entries");
      }

      const data = await response.json();
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch entries");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setEntries(null);
    setError(null);
    handleToggle();
  };

  const positionLabel = POSITION_LABELS[summary.position] || summary.position;

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
      {/* Collapsed Header */}
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5l7 7-7 7"
            />
          </svg>

          {/* Name */}
          <span className="text-[14px] font-medium text-[var(--text-primary)]">
            {summary.userName}
          </span>

          {/* Position Badge */}
          <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">
            {positionLabel}
          </span>
        </div>

        {/* Total Hours */}
        <span className="text-[14px] font-medium text-[var(--accent-pink)]">
          {formatHours(summary.totalHours)}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-[var(--border-subtle)]">
          {error ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-[var(--danger)] text-sm mb-2">{error}</p>
              <button
                onClick={handleRetry}
                className="text-[13px] text-[var(--accent-pink)] hover:underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <EntriesList
              entries={entries || []}
              isLoadingEntries={isLoading}
              readOnly
            />
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/src/components/timesheets/TeamMemberRow.tsx
git commit -m "feat(TeamMemberRow): create collapsible team member entry row"
```

---

## Task 9: Create TeamTimesheets Component

**Files:**
- Create: `app/src/components/timesheets/TeamTimesheets.tsx`

**Step 1: Create the component file**

```typescript
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
```

**Step 2: Commit**

```bash
git add app/src/components/timesheets/TeamTimesheets.tsx
git commit -m "feat(TeamTimesheets): create team timesheets section component"
```

---

## Task 10: Update TimesheetsContent to Handle Team Data

**Files:**
- Modify: `app/src/components/timesheets/TimesheetsContent.tsx`

**Step 1: Add TeamSummary import and TeamTimesheets component**

Update imports (around line 1-9):

```typescript
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { formatDateISO, toDecimalHours } from "@/lib/date-utils";
import { WeekStrip } from "./WeekStrip";
import { EntryForm } from "./EntryForm";
import { EntriesList } from "./EntriesList";
import { TeamTimesheets } from "./TeamTimesheets";
import type { Client, Topic, TimeEntry, FormData, TeamSummary } from "@/types";
import { initialFormData } from "@/types";
```

**Step 2: Add teamSummaries state**

Add after the `entries` state (around line 19):

```typescript
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [teamSummaries, setTeamSummaries] = useState<TeamSummary[]>([]);
```

**Step 3: Update fetchEntries to handle new response shape**

Update the fetchEntries callback (around line 27-40):

```typescript
  // Fetch entries for selected date
  const fetchEntries = useCallback(async (date: Date) => {
    setIsLoadingEntries(true);
    try {
      const response = await fetch(`/api/timesheets?date=${formatDateISO(date)}`);
      if (response.ok) {
        const data = await response.json();
        // Handle both response shapes:
        // - Array for regular users (backward compatible)
        // - Object with entries + teamSummaries for ADMIN/PARTNER
        if (Array.isArray(data)) {
          setEntries(data);
          setTeamSummaries([]);
        } else {
          setEntries(data.entries || []);
          setTeamSummaries(data.teamSummaries || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch entries:", err);
    } finally {
      setIsLoadingEntries(false);
    }
  }, []);
```

**Step 4: Add TeamTimesheets to the render**

Add after the EntriesList component (around line 190-194):

```typescript
      {/* Entries List */}
      <EntriesList
        entries={entries}
        isLoadingEntries={isLoadingEntries}
        onDeleteEntry={deleteEntry}
      />

      {/* Team Timesheets (only shown for ADMIN/PARTNER) */}
      <TeamTimesheets
        summaries={teamSummaries}
        selectedDate={selectedDate}
      />
    </div>
```

**Step 5: Commit**

```bash
git add app/src/components/timesheets/TimesheetsContent.tsx
git commit -m "feat(TimesheetsContent): integrate team timesheets for ADMIN/PARTNER"
```

---

## Task 11: Run Build and Fix Any Issues

**Step 1: Run the build**

```bash
cd app && npm run build
```

**Step 2: Fix any TypeScript or build errors**

Address issues as they arise.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address build issues"
```

---

## Task 12: Manual Testing Checklist

**Step 1: Start development server**

```bash
npm run dev
```

**Step 2: Test as regular user (ASSOCIATE)**

- [ ] Navigate to /timesheets
- [ ] Verify only your entries appear
- [ ] Verify no "Team Timesheets" section appears
- [ ] Verify you can still add/delete your own entries

**Step 3: Test as ADMIN/PARTNER user**

- [ ] Navigate to /timesheets
- [ ] Verify your entries appear at top
- [ ] Verify "Team Timesheets" section appears below
- [ ] Verify team members are sorted by hours (highest first)
- [ ] Verify employees with 0 hours don't appear
- [ ] Click to expand a team member - verify entries load
- [ ] Collapse and re-expand - verify entries are cached (no re-fetch)
- [ ] Change date - verify expanded sections collapse and cache clears
- [ ] Verify no delete buttons on team member entries

**Step 4: Test API security**

```bash
# As regular user, try to access team endpoint (should 403)
curl "http://localhost:3000/api/timesheets/team/[some-user-id]?date=2025-12-24" \
  -H "Cookie: [your-session-cookie]"
```

---

## Task 13: Final Commit and Summary

**Step 1: Ensure all changes are committed**

```bash
git status
git log --oneline -10
```

**Step 2: Verify branch is clean and tests pass**

```bash
npm run test -- --run
npm run build
```

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `app/src/types/index.ts` |
| Modify | `app/src/lib/api-utils.ts` |
| Modify | `app/src/app/api/timesheets/route.ts` |
| Create | `app/src/app/api/timesheets/team/[userId]/route.ts` |
| Modify | `app/src/components/timesheets/EntryRow.tsx` |
| Modify | `app/src/components/timesheets/EntriesList.tsx` |
| Create | `app/src/components/timesheets/TeamMemberRow.tsx` |
| Create | `app/src/components/timesheets/TeamTimesheets.tsx` |
| Modify | `app/src/components/timesheets/TimesheetsContent.tsx` |
