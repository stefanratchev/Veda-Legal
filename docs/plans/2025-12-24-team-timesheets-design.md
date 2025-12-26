# Team Timesheets View for Partners/Admins

## Overview

Enable ADMIN and PARTNER users to view all employees' timesheets for the selected day on the timesheets page. Their own timesheet appears at the top, with collapsible sections for each team member below.

## Requirements

- Partners/admins see their own entries at the top (unchanged behavior)
- Below that, a "Team Timesheets" section shows other employees
- Each employee appears as a collapsible row showing name, position, and total hours
- Clicking expands to show full entry details (lazy-loaded)
- View-only access: cannot delete other employees' entries
- Employees with zero entries for the day are hidden
- Sorted by total hours descending
- Only ADMIN and PARTNER positions have team view access

## API Design

### Modified: `GET /api/timesheets?date=YYYY-MM-DD`

**For regular users:** Returns `TimeEntry[]` (unchanged)

**For ADMIN/PARTNER:** Returns new shape:

```typescript
{
  entries: TimeEntry[];           // Current user's entries
  teamSummaries?: TeamSummary[];  // Other employees' summaries
}

interface TeamSummary {
  userId: string;
  userName: string;
  position: string;
  totalHours: number;
}
```

Team summaries:
- Exclude current user (already shown in `entries`)
- Exclude employees with 0 hours for the date
- Sorted by `totalHours` descending
- Uses aggregate query: `SUM(hours) GROUP BY userId`

### New: `GET /api/timesheets/team/[userId]?date=YYYY-MM-DD`

Returns `TimeEntry[]` for the specified user on the given date.

**Access control:** Only ADMIN/PARTNER can call this endpoint.

## Component Architecture

```
TimesheetsContent.tsx (modified)
├── WeekStrip (unchanged)
├── EntryForm (unchanged)
├── EntriesList (unchanged - "Your Entries")
└── TeamTimesheets (new)
    └── TeamMemberRow (new, repeated)
        └── EntriesList (reused when expanded)
```

### TimesheetsContent Changes

- Detect if response includes `teamSummaries`
- Pass summaries to new `TeamTimesheets` component
- No changes to existing form/entry logic

### TeamTimesheets Component

Props:
```typescript
interface TeamTimesheetsProps {
  summaries: TeamSummary[];
  selectedDate: Date;
}
```

Behavior:
- Renders "Team Timesheets" section header
- Maps summaries to `TeamMemberRow` components
- Hidden entirely if `summaries` is empty

### TeamMemberRow Component

Props:
```typescript
interface TeamMemberRowProps {
  summary: TeamSummary;
  selectedDate: Date;
}
```

State:
- `isExpanded: boolean`
- `entries: TimeEntry[] | null`
- `isLoading: boolean`
- `error: string | null`

Behavior:
- Collapsed: shows chevron, name, position badge, total hours
- On expand: fetches entries from `/api/timesheets/team/[userId]`
- Caches entries - doesn't re-fetch on collapse/re-expand
- Re-fetches when `selectedDate` changes

### EntriesList Modification

Add optional prop:
```typescript
interface EntriesListProps {
  entries: TimeEntry[];
  isLoadingEntries: boolean;
  onDeleteEntry: (entryId: string) => void;
  readOnly?: boolean;  // NEW - hides delete buttons when true
}
```

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│ Timesheets                                              │
│ Track your billable hours                               │
├─────────────────────────────────────────────────────────┤
│ [Week Strip]                                            │
├─────────────────────────────────────────────────────────┤
│ [Entry Form]                                            │
├─────────────────────────────────────────────────────────┤
│ ┌─ Your Entries ──────────────────────────────────────┐ │
│ │ [Entries table]                                     │ │
│ │ Daily Total: 6.5h                                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ─── Team Timesheets ────────────────────────────────── │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ▶ Jane Smith (Partner)                      7.25h   │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ▼ John Doe (Associate)                      5.0h    │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Client      │ Topic    │ Hours │ Work          │ │ │
│ │ │ Acme Corp   │ M&A      │ 3.0   │ Due diligence │ │ │
│ │ │ Beta Ltd    │ Contract │ 2.0   │ Review        │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Security

### Authorization Checks

Both endpoints must verify the caller has team view access:

```typescript
const TEAM_VIEW_ROLES = ['ADMIN', 'PARTNER'];

function canViewTeamTimesheets(userPosition: string): boolean {
  return TEAM_VIEW_ROLES.includes(userPosition);
}
```

### `GET /api/timesheets`

- Authentication: `requireAuth()` (existing)
- Team data: Only include `teamSummaries` if `canViewTeamTimesheets(user.position)`
- No change for regular users - they simply don't receive team data

### `GET /api/timesheets/team/[userId]`

- Authentication: `requireAuth()`
- Authorization: Return 403 if `!canViewTeamTimesheets(user.position)`
- Prevents regular employees from fetching others' entries via direct API call

### Data Isolation

- Team summaries query excludes the current user (no duplicate data)
- No write operations exposed - view-only by design
- Delete endpoint unchanged - still enforces `userId === currentUser.id`

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| ADMIN/PARTNER with 0 personal entries | "Your Entries" shows empty state, Team section still visible |
| No other employees logged time | "Team Timesheets" section hidden |
| User's own entry in team query | Excluded from `teamSummaries` |
| API error fetching team entries | Error message with retry button in expanded area |

## Loading States

1. **Page load:** Team summaries fetched with user's entries (single request)
2. **Expanding row:** Spinner in expanded area while fetching
3. **Caching:** Entries cached per user - no re-fetch on collapse/expand
4. **Date change:** Clear cache, re-fetch summaries and any expanded entries

## Files to Modify

1. `app/src/app/api/timesheets/route.ts` - Add team summaries to GET response
2. `app/src/app/api/timesheets/team/[userId]/route.ts` - New endpoint (create)
3. `app/src/components/timesheets/TimesheetsContent.tsx` - Handle new response shape, render TeamTimesheets
4. `app/src/components/timesheets/TeamTimesheets.tsx` - New component (create)
5. `app/src/components/timesheets/TeamMemberRow.tsx` - New component (create)
6. `app/src/components/timesheets/EntriesList.tsx` - Add `readOnly` prop
7. `app/src/types/index.ts` - Add `TeamSummary` type
