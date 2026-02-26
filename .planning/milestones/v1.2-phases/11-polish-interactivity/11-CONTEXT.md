# Phase 11: Polish & Interactivity - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Add summary stats row and chart-to-filter click interaction to the Detail tab. Two requirements: DTAB-02 (summary stats updating with filters) and CHRT-07 (click chart bar to toggle as filter). No new pages, tabs, or data sources.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User granted full discretion on all implementation decisions. Key areas to resolve during planning:

**Summary stats row:**
- Placement relative to FilterBar and charts
- Visual style (inline compact row vs stat cards)
- Which stats to display (entry count, total hours, total revenue for admins)
- How stats update when filters change (they should react to filtered data)

**Chart click-to-filter interaction:**
- Visual feedback for active/selected bars (highlight, dim others, border, etc.)
- Toggle mechanics (click to add filter, click again to remove)
- Handling of "Other" aggregated bar (not clickable since it represents multiple entities)
- How click-to-filter integrates with existing FilterBar state

**Active state indication on charts:**
- How filtered charts visually distinguish active vs inactive bars
- Whether dimming unselected bars, adding borders, or highlighting selected
- Coordination across all chart types (BarChart + RevenueBarChart)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The existing BarChart already has `onBarClick` prop support and cursor styling wired up. FilterBar manages filter state via `FilterState` (clientIds, employeeIds, topicNames Sets).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-polish-interactivity*
*Context gathered: 2026-02-26*
