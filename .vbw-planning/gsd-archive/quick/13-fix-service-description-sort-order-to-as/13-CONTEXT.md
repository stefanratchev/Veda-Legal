# Quick Task 13: Fix service description line item sort order - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Task Boundary

Within a service description, line items (timesheet entries) from the same day appear in the wrong order. Fix so they are sorted ascending by creation time.

</domain>

<decisions>
## Implementation Decisions

### Sort field and direction
- Sort line items by date ascending, then by createdAt ascending as tiebreaker for same-day entries
- This affects the initial displayOrder assignment when creating a new service description

### Claude's Discretion
- None — decision locked by user

</decisions>

<specifics>
## Specific Ideas

- `api/billing/route.ts` POST handler line 215: currently `orderBy: [asc(timeEntries.topicName), asc(timeEntries.date)]`
- Add `asc(timeEntries.createdAt)` as third sort key to break ties for same-day entries
- The `displayOrder` assigned at creation (line 282) will then reflect correct chronological order

</specifics>
