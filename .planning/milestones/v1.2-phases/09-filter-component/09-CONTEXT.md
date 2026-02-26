# Phase 9: Filter Component - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Reusable multi-select filter component with search, selection, clearing, and active filter indicators. Built and tested in isolation — wiring into the Detail tab happens in Phase 10. One component definition, three instances (Clients, Employees, Topics) driven by props.

</domain>

<decisions>
## Implementation Decisions

### Filter bar layout
- Horizontal row of three filter dropdowns: Clients | Employees | Topics
- Compact trigger buttons showing label + selection count badge (e.g., "Clients (3)")
- "Clear all" link at the right end of the filter bar, only visible when any filter is active
- Filter bar component wraps the three MultiSelectFilter instances — exported as a composed unit for Phase 10

### Dropdown design
- Follow existing `ClientSelect` pattern: trigger button opens a dropdown panel with search input at top
- Checkboxes next to each option (not highlight-based selection like ClientSelect's single-select)
- Search input auto-focused on open, case-insensitive substring matching
- Max height ~280px with overflow scroll, consistent with existing `max-h-56` pattern
- "No results" message when search yields nothing
- Close on click-outside (reuse `useClickOutside` hook) and Escape key
- Dropdown stays open after selecting/deselecting (multi-select UX — user checks multiple items then clicks away)

### Active filter indicators
- Count badge on the trigger button: coral pink background with count number (e.g., "(3)")
- No individual pill badges per selection — the dropdown itself shows checked items; trigger stays compact
- When filters are active, trigger button gets a subtle accent border to visually distinguish from inactive filters

### Selection shortcuts
- No "Select all" / "Deselect all" inside dropdown — the option lists are small enough (~10 employees, ~200 clients, ~20 topics) that manual selection is fine
- Keyboard: Arrow keys navigate, Space toggles checkbox, Escape closes
- Click outside dismisses dropdown and preserves selections

### Claude's Discretion
- Exact spacing, padding, and font sizes (follow existing component conventions)
- Animation for dropdown open/close (likely `animate-fade-up` per design system rule)
- Whether to group clients by type (REGULAR/INTERNAL/MANAGEMENT) in the dropdown — researcher can check if grouping adds value given the list sizes
- Internal component structure and state management approach

</decisions>

<specifics>
## Specific Ideas

- Match the visual style of the existing `ClientSelect` component — same bg colors, border styles, shadow, and rounded corners
- The component should be generic: `MultiSelectFilter<T>` accepting `options: { id: string; label: string }[]`, `selected: Set<string>`, `onChange: (selected: Set<string>) => void`, `label: string`
- Filter bar is a separate wrapper component that composes three MultiSelectFilter instances

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-filter-component*
*Context gathered: 2026-02-25*
