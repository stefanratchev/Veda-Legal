# Phase 1: Add date filter and client name search to Ready to Bill - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Add date range filter and client name search to the "Ready to Bill" tab on the billing page. Currently shows all unbilled clients with no filtering. The existing DateRangePicker component and same filter bar layout from the Service Descriptions tab should be reused.

</domain>

<decisions>
## Implementation Decisions

### Date filter behavior
- Filter unbilled hours by time entry date (when the work was done)
- "This Month" shows only unbilled hours from the current month
- Clients with no unbilled hours in the selected range disappear from the list
- Hours, estimated value, oldest/newest entry dates all recalculate scoped to the filtered date range
- Clicking "Bill Now" on a filtered card uses the filter's date range as the period for the new service description

### Date filter presets
- Same options as Service Descriptions tab: This Month, Last Month, All Time, Custom Range
- Default to "All Time" (show everything unbilled — user narrows down if needed)

### Filter layout
- Same horizontal row as Service Descriptions tab: DateRangePicker + Search input + result count
- Placed above the card grid
- Card grid layout unchanged: 1 col mobile, 2 col tablet, 3 col desktop

### Search behavior
- Client name only (same as SD tab)
- Client-side filtering (filter already-fetched cards in browser — instant, no network delay, works well with ~200 clients)
- Result count badge updates to reflect filtered results

### Empty state
- Filter-aware empty message when filters return no results (e.g., "No unbilled hours in this period") — different from the existing "All caught up!" message for genuinely zero unbilled hours

### Claude's Discretion
- Date filtering implementation: server-side (API params) vs client-side
- Loading state approach when date range changes
- Sort order behavior with active filters

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DateRangePicker` component (`components/billing/DateRangePicker.tsx`): Full date range picker with presets (This Month, Last Month, All Time, Custom Range) + `getDateRange()` helper
- `UnbilledClientsSection` (`components/billing/UnbilledClientsSection.tsx`): Current component that fetches and displays unbilled client cards — needs filter props added
- `UnbilledClientCard`: Card component already exists, renders per-client unbilled data
- `BillingContent` (`components/billing/BillingContent.tsx`): Parent component that manages tab state, already has DateRangePicker + search pattern in the SD tab

### Established Patterns
- SD tab pattern: `DateRangePicker` + search input + status filter in horizontal row, fetch on date change via `useEffect`, client-side search via `useMemo`
- API calls use query params for date filtering (`createdFrom`, `createdTo`)
- `useClickOutside` hook for dropdown close behavior

### Integration Points
- `/api/billing/unbilled-summary` route: May need date range query params added (currently returns all unbilled data with no date filtering)
- `BillingContent.tsx`: Parent needs to pass date range and trigger refetch or pass filter props to `UnbilledClientsSection`
- `onCreateServiceDescription` callback: Needs to receive period dates from the active filter range

</code_context>

<specifics>
## Specific Ideas

- Mirror the Service Descriptions tab filter bar as closely as possible for consistency
- The search input placeholder should say "Search by client name..." (same as SD tab)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-add-date-filter-along-with-search-by-client-name-to-the-ready-to-bill-clients*
*Context gathered: 2026-03-10*
