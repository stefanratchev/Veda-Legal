# Phase 12: Tab Navigation - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorganize the billing page into a tabbed layout with "Ready to Bill" and "Service Descriptions" tabs. URL query param (`?tab=`) is the source of truth for active tab state. No new features — this restructures existing content into tabs.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- Tab bar visual design (style, placement, active indicator) — should match existing dark theme design system
- Content arrangement within each tab — "Ready to Bill" wraps existing UnbilledClientsSection, "Service Descriptions" wraps existing SD table with filters/search
- Page header relationship to tabs — header stays above tabs
- Tab switching behavior — instant swap, no animation (per project animation rule)
- Whether tab-specific state (filters, search) resets on tab switch or persists
- Create SD flow — stays within the "Ready to Bill" tab via UnbilledClientsSection
- Whether to use a reusable tab component or inline the tab logic

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User deferred all design decisions to Claude.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-tab-navigation*
*Context gathered: 2026-02-27*
