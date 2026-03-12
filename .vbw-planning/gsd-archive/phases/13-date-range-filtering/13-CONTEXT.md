# Phase 13: Date Range Filtering - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add date range filtering to the Service Descriptions tab. Users can scope the list to a specific time period using presets (This Month, Last Month, All Time) or a custom date range. Filtering is server-side. Works alongside the existing status filter.

</domain>

<decisions>
## Implementation Decisions

### Filter bar layout
- Date range picker sits on the LEFT of the existing filter bar, same row
- Order: Date Range | Search | Status Filter
- Dropdown trigger label reflects the active selection (e.g., "This Month", "Last Month", "Jan 1 - Feb 15" for custom)
- No result counts in the dropdown options — keep it simple

### Presets and ordering
- Preset options in order: This Month, Last Month, All Time, Custom Range
- "This Month" is the default when opening the Service Descriptions tab
- "All Time" removes the date constraint entirely — shows all service descriptions
- Three presets plus custom range; no quarterly or yearly presets needed

### Date matching logic
- An SD is included if its `periodStart` falls within the selected date range
- Simple and predictable: a January SD shows under "This Month" in January

### Claude's Discretion
- Custom range picker interaction (calendar popup vs inline date inputs vs other approach)
- URL persistence of date range state
- Exact dropdown styling and animation

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The existing `TableFilters` component and status filter dropdown provide the design language to match.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-date-range-filtering*
*Context gathered: 2026-02-27*
