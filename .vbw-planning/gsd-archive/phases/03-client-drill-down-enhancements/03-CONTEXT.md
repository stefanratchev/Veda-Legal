# Phase 3: Client Drill-Down Enhancements - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance the client drill-down view in Reports with a topic breakdown summary, full entry table with topic column, and sortable/paginated entries. The data layer (Phase 1) already provides `topics` array and `topicName` on entries — this phase renders that data.

**Dropped from phase:** Hours-over-time trend chart (CDR-02) — user decided it's not needed.

</domain>

<decisions>
## Implementation Decisions

### Topic Breakdown Display
- Horizontal bar chart (matches existing Hours by Employee chart style)
- Show all topics — no cap/grouping into "Other"
- Each bar label shows hours + percentage of total (e.g. "12.5h (34%)")
- Hide topics with zero hours in the selected period
- Reuse existing `BarChart` component from `components/reports/charts/`

### Entry Table & Pagination
- Show ALL entries for the selected date range (replacing the current 10-entry limit)
- Page numbers pagination at bottom ("Page 1 of 5" with prev/next)
- ~50 entries per page (per success criteria threshold)
- Default sort: newest first (most recent date at top)
- Sortable columns — click any column header to sort
- Columns in order: Date, Employee, Topic, Description, Hours

### Layout & Section Ordering
- Section order top-to-bottom:
  1. Header (back button, client name, total hours, revenue)
  2. Topic Breakdown + Hours by Employee (side-by-side on desktop, stacked on mobile)
  3. Entry Table (full width)
- Each section has a visible heading label (e.g. "Topic Breakdown", "Hours by Employee", "Entries")
- No hours trend chart — removed per user decision

### Claude's Discretion
- Exact page size (somewhere around 50, per success criteria)
- Responsive breakpoint for side-by-side → stacked chart transition
- Chart heights and spacing
- Pagination component styling (matching existing dark theme)
- Sort indicator styling on column headers

</decisions>

<specifics>
## Specific Ideas

- Topic breakdown should show percentage alongside hours — user wants to see proportional distribution at a glance
- Keep visual consistency with existing charts (accent pink bars, dark theme, muted axis labels)
- The employee drill-down (Phase 4) will follow a similar pattern, so reusable components are a plus

</specifics>

<deferred>
## Deferred Ideas

- **Hours-over-time trend chart (CDR-02)** — User decided this isn't needed for the client drill-down. Could be revisited in a future milestone if activity patterns become important.

</deferred>

---

*Phase: 03-client-drill-down-enhancements*
*Context gathered: 2026-02-24*
