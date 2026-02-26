# Phase 10: Detail Tab Assembly - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Detail" tab to the Reports page alongside Overview, By Client, and By Employee. The tab contains a FilterBar (clients, employees, topics — already built in Phase 9), six horizontal bar charts (Hours + Revenue by Client/Employee/Topic), and a full entry table with sorting and pagination. All visualizations update simultaneously when filters change. Summary stats row and chart-click-to-filter interaction are Phase 11.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation decisions are at Claude's discretion. The user trusts the builder to make sensible choices guided by these defaults:

**Chart arrangement:**
- Pair charts by dimension: Hours by Client + Revenue by Client side-by-side, then Hours by Employee + Revenue by Employee, then Hours by Topic + Revenue by Topic
- 2-column grid on desktop (hours left, revenue right); single column on mobile
- Non-admins see only the 3 hours charts — use full width when revenue chart is absent
- Reuse existing `BarChart` component from `components/reports/charts/BarChart.tsx` with horizontal layout
- Cap visible bars using existing `maxBars` prop; "Other" grouping for overflow

**Entry table design:**
- Default sort by date descending (most recent first)
- Columns: Date, Employee, Client, Topic, Subtopic, Description, Hours; admins additionally see Revenue
- Truncate long descriptions with ellipsis; show full text on hover/tooltip
- 50 entries per page with pagination controls
- Reuse existing `DataTable` component from `components/ui/` if it fits, or build a focused table component

**Page structure:**
- Top: FilterBar (Phase 9 component)
- Middle: Charts section (3 paired rows)
- Bottom: Entry table with pagination
- FilterBar does NOT need to be sticky — the tab content is the exploration area
- No collapsible sections — keep everything visible

**Empty & loading states:**
- When filters return zero results: centered message like "No entries match the selected filters" with a "Clear filters" link
- No skeleton loaders needed — filtering is client-side and instant (data already loaded)
- Initial load uses server-fetched data passed from the page component

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow existing patterns from Overview, By Client, and By Employee tabs.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-detail-tab-assembly*
*Context gathered: 2026-02-25*
