# Phase 4: Employee Drill-Down Enhancements - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Enrich the employee drill-down view with a cross-client topic distribution chart and a full, paginated entry table with topic and client columns. The data layer (Phase 1) already provides `topicName` on entries and `topics` arrays on `byEmployee` items — this phase is purely UI work on the `ByEmployeeTab` component.

</domain>

<decisions>
## Implementation Decisions

### Topic chart design
- Simple sum aggregation: merge hours across clients into a single bar per topic (no per-client breakdown within bars)
- Horizontal bar chart using the same `BarChart` component from Phase 3
- Bar labels show hours + percentage (e.g., "M&A Advisory 8.0h (45%)")
- Include "Uncategorized" entries (null topic) in the chart — same treatment as Phase 1 data layer
- Dynamic height scaling: same formula as Phase 3 (`Math.max(256, items * 40)`)

### Chart layout
- Side-by-side with the existing "Hours by Client" chart (Topic Breakdown on left, Hours by Client on right)
- Same responsive pattern as Phase 3: stack vertically on mobile
- Same side-by-side grid layout implementation

### Entry table columns
- Columns: Date, Client, Topic, Description, Hours
- Default sort: Date descending (most recent first)
- Sortable columns: Date, Client, Topic, Hours (Description excluded — same decision as Phase 3)
- Pagination: 50 entries per page (consistent with Phase 3)
- Uses the existing DataTable component (same as Phase 3's entry table)

### Development approach
- TDD pattern matching Phase 3: test scaffold first (wave 0), then implementation
- Plan structure: ~3 plans (test scaffold, topic chart + layout, DataTable entry table)

### Edge states
- Always show topic chart even with a single topic (one bar communicating "100% on one topic")
- Empty date range: show "No entries for this period" in chart and table areas (same layout, empty content)
- Include INTERNAL/MANAGEMENT client entries in both chart and table (revenue already excluded by Phase 1 rules)

### Claude's Discretion
- Exact chart color palette (match existing or adapt)
- Empty state message wording
- Test data factory structure for ByEmployeeTab tests

</decisions>

<specifics>
## Specific Ideas

- Mirror Phase 3's visual patterns as closely as possible — the employee drill-down should feel like the natural counterpart to the client drill-down
- Reuse the BarChart component directly with no visual modifications
- All three success criteria (EDR-01, EDR-02, EDR-03) are in scope — nothing dropped

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-employee-drill-down-enhancements*
*Context gathered: 2026-02-24*
