# Pitfalls Research

**Domain:** Adding multi-select filter-driven Detail tab to existing Reports (charts + table)
**Researched:** 2026-02-25
**Confidence:** HIGH (based on codebase analysis + documented Recharts/React patterns)

## Critical Pitfalls

### Pitfall 1: Cascading Re-renders Across All Charts When Any Filter Changes

**What goes wrong:**
The Detail tab will have 6 charts (Hours by Client, Revenue by Client, Hours by Employee, Revenue by Employee, Hours by Topic, Revenue by Topic) plus a DataTable. When a single multi-select filter changes (e.g., adding one client), ALL 6 charts and the table re-render because filter state lives in a shared parent. Recharts charts are SVG-heavy -- each chart teardown and rebuild is expensive. With 6 charts rendering simultaneously, a single filter click creates visible lag.

**Why it happens:**
The existing `ReportsContent.tsx` holds all state at the top level (lines 36-58). Adding filter state (`selectedClients`, `selectedEmployees`, `selectedTopics`) to this same component means every filter change triggers a re-render of the entire component tree. Recharts `ResponsiveContainer` re-renders its chart even when the chart's data has not changed, because the parent re-rendered and new prop references were created. This is a documented Recharts issue (recharts/recharts#300).

**How to avoid:**
1. Wrap each chart in `React.memo()` and memoize the data arrays passed to them with `useMemo`. The current OverviewTab already uses `useMemo` for revenue data (lines 85-111) -- follow that pattern for ALL chart data in the Detail tab.
2. Memoize callback handlers with `useCallback` so chart `onBarClick` props maintain stable references.
3. Compute filtered data ONCE at the Detail tab level, then derive each chart's data from that single filtered dataset. Do NOT filter independently in each chart component.
4. Consider isolating the filter bar into its own component that communicates via a callback, so typing in a filter search box does not cascade to charts until a selection is committed.

**Warning signs:**
- Visible flicker or animation restart on charts when clicking a filter checkbox
- React DevTools Profiler showing all chart components re-rendering on every filter interaction
- User-perceptible delay (>100ms) between clicking a filter and seeing the UI update

**Phase to address:**
Phase 1 (component architecture) -- must establish the memoization pattern before building individual charts, not as a retrofit.

---

### Pitfall 2: Filter State and DataTable Pagination Desync

**What goes wrong:**
User is on page 3 of the entry table, then changes a filter. The filtered dataset shrinks from 200 to 15 entries, but pagination state still says "page 3" -- showing an empty page or crashing. The existing `DataTable` (line 72) does handle this via `validCurrentPage = Math.min(currentPage, totalPages)` but the EXTERNAL state driving which entries reach the DataTable might not reset properly.

**Why it happens:**
The DataTable component manages its own pagination internally. But filters are external to it. When the `data` prop changes (due to filter), DataTable correctly clamps the page. The real pitfall is if filter changes are batched or debounced, causing a brief moment where the table renders with stale data but updated pagination, or vice versa. Also, if the Detail tab's entry table adds its own external pagination state (instead of relying on DataTable's internal state), the two can desync.

**How to avoid:**
1. Let `DataTable` own pagination state internally -- do NOT add external page state for the Detail tab's table. The existing DataTable already handles this correctly.
2. Pass the fully-filtered dataset as `data` to DataTable. Let DataTable handle sorting and pagination internally.
3. Do NOT debounce the data prop to DataTable while the filter state has already updated -- this creates a frame where filters and table are inconsistent.

**Warning signs:**
- Empty table page after applying a filter
- "Showing 101-150 of 15" display in pagination
- Table content flashing between filtered and unfiltered states

**Phase to address:**
Phase 2 (filter integration) -- when connecting filters to the table, use DataTable's existing internal pagination rather than adding new state.

---

### Pitfall 3: Creating New Object/Array References on Every Render for Chart Data

**What goes wrong:**
Chart data arrays like `clientChartData`, `employeeChartData`, `topicChartData` are computed inline using `.map()` and `.filter()` during render. Each render creates new array references even when the underlying data has not changed. This defeats `React.memo()` on chart components because props appear to have changed (referential inequality). Result: memoization of chart components is useless.

**Why it happens:**
The current ByClientTab (lines 102-129) and ByEmployeeTab (lines 113-135) compute chart data with inline `.reduce()` and `.map()` calls inside the component body, NOT inside `useMemo`. OverviewTab gets it right for revenue (line 85) but not for hours chart data (lines 73-83). Copying the wrong pattern to the Detail tab means 6 charts with unstable data references.

**How to avoid:**
1. ALL chart data derivations in the Detail tab MUST be wrapped in `useMemo` with correct dependencies.
2. The dependency should be the filtered entries array (itself memoized), NOT raw props.
3. Pattern:
```typescript
const filteredEntries = useMemo(() =>
  data.entries.filter(e =>
    (selectedClients.length === 0 || selectedClients.includes(e.clientId)) &&
    (selectedEmployees.length === 0 || selectedEmployees.includes(e.userId)) &&
    (selectedTopics.length === 0 || selectedTopics.includes(e.topicName))
  ),
  [data.entries, selectedClients, selectedEmployees, selectedTopics]
);

const clientChartData = useMemo(() =>
  aggregateByField(filteredEntries, 'clientId', 'clientName'),
  [filteredEntries]
);
```
4. Use a shared aggregation helper to avoid duplicating reduce logic across 6 chart data computations.

**Warning signs:**
- React DevTools shows chart components re-rendering even when their visible data has not changed
- Profiler shows consistent ~50ms+ render times for the Detail tab on every filter interaction

**Phase to address:**
Phase 1 (component architecture) -- establish memoized data derivation as the pattern from the start.

---

### Pitfall 4: Multi-Select Filter Arrays Causing Infinite useMemo Invalidation

**What goes wrong:**
Filter state is stored as arrays (e.g., `selectedClients: string[]`). When creating new arrays on state update (even with the same contents), useMemo dependencies see a new reference and recompute. Worse: if a parent component reconstructs the filter arrays on each render (e.g., from URL params), every render invalidates every useMemo that depends on filters.

**Why it happens:**
JavaScript arrays are compared by reference in useMemo dependencies (`Object.is`). `['a', 'b'] !== ['a', 'b']`. If the filter state setter creates a new array each time (which React's `useState` does correctly for actual changes), this is fine. But problems arise when:
- Filter arrays are derived from another data source on each render
- "Clear all" creates `[]` which IS a new reference each time (though this is benign since the empty-array useMemo result is cheap to recompute)
- URL search params are parsed to arrays on each render

**How to avoid:**
1. Store filter state with `useState` directly -- this naturally gives stable references when values have not actually changed.
2. Do NOT derive filter arrays from URL params or other sources inside the render body without memoizing them.
3. If adding URL sync later, parse params in a `useMemo` or custom hook that only updates when the URL actually changes.
4. For "select all" / "clear all" operations, set the state to a new array only once -- do not toggle each item individually in a loop (which would cause N state updates and N re-renders).

**Warning signs:**
- useMemo dependencies array in DevTools shows filter arrays changing on every render
- Selecting "clear all" causes a visible cascade of re-renders instead of one
- Performance degrades when more filters are active (more array comparisons)

**Phase to address:**
Phase 1 (filter state design) -- get the state shape right before building filter UI.

---

### Pitfall 5: Revenue Data Leaking to Non-Admin Users in Filtered Views

**What goes wrong:**
The existing reports API already strips revenue data for non-admins (report-utils.ts lines 293-303). But client-side filtering in the Detail tab could accidentally expose revenue by computing `hours * hourlyRate` locally, or by including a Revenue column in the table that is conditionally hidden but still present in the DOM (inspectable via DevTools).

**Why it happens:**
The current pattern passes `isAdmin` throughout the component tree (OverviewTab line 129, ByClientTab line 283). But adding a new Detail tab with 6 charts and a table creates more places where the `isAdmin` check can be forgotten. The revenue charts and revenue column must be COMPLETELY absent for non-admins, not just visually hidden.

**How to avoid:**
1. Follow the existing pattern: the API returns `revenue: null` for non-admins. Chart components should not render at all when data is empty/null, not render with hidden values.
2. Revenue columns in the Detail table must be conditionally EXCLUDED from the columns array (not hidden with CSS), matching the ByClientTab pattern (line 283-285 uses `{isAdmin && <th>}`).
3. The "Revenue by X" charts should not mount at all when `isAdmin` is false -- use conditional rendering, not `display: none`.
4. Do NOT compute revenue client-side from hourlyRate. Use the server-computed values.

**Warning signs:**
- Non-admin view shows revenue chart containers (even if empty)
- DOM inspection reveals revenue values in hidden elements
- Client-side code references `hourlyRate` directly instead of using pre-computed `revenue` field

**Phase to address:**
Phase 2 (chart implementation) -- enforce during code review that revenue components are excluded, not hidden.

---

### Pitfall 6: Inconsistent "No Filter = Show All" vs "No Filter = Show None" Semantics

**What goes wrong:**
Multi-select filters have an ambiguous empty state. Does `selectedClients = []` mean "no clients selected, show nothing" or "no filter applied, show all clients"? If different parts of the codebase interpret this differently, the charts show all data while the table shows nothing (or vice versa).

**Why it happens:**
There is no established convention in the existing codebase for multi-select filter semantics because the current drill-down tabs use single-select (one employee or one client at a time). The transition from single-select to multi-select introduces this new ambiguity. Different developers (or the same developer at different times) may implement opposite interpretations.

**How to avoid:**
1. Establish ONE convention and document it: **empty array = no filter = show all**. This is the standard UX pattern for dashboard filters and avoids the confusing state where the user opens the Detail tab and sees nothing because no filters are selected.
2. Implement filtering with a single guard pattern used everywhere:
```typescript
const matchesFilter = (items: string[], value: string) =>
  items.length === 0 || items.includes(value);
```
3. Extract this into a shared utility, not inline in each component.
4. Test the empty-filter case explicitly in unit tests.

**Warning signs:**
- Opening the Detail tab for the first time shows empty charts/table
- Clearing all filters shows nothing instead of everything
- Different charts show different data when all filters are cleared

**Phase to address:**
Phase 1 (filter state design) -- define and document the convention before any implementation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline filter logic in each chart component | Faster initial implementation | 6 copies of filtering logic that can drift apart; bug fixes need 6 changes | Never -- extract shared filtering from the start |
| Filtering entries client-side without memoization | Works for ~200 clients, ~10 employees | Re-filtering on every keystroke in filter search; becomes slow with more data | Acceptable for MVP but useMemo should be trivial to add |
| Duplicating column definitions across Detail tab and drill-down tabs | Avoids prop-threading of column configs | Column formatting changes need updates in 3+ places | Acceptable if extracted to shared config within same milestone |
| Skipping `React.memo` on chart wrapper components | Fewer lines of code | Every parent re-render causes 6 SVG chart teardown/rebuilds | Never for charts with >50 data points |
| Computing revenue per-entry client-side instead of using API data | Avoids API changes to add entry-level revenue | Different rounding, different written-off logic, different billable checks vs API; numbers will not match | Never -- always use server-computed revenue |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Detail tab + existing date picker | Detail tab filters reset when date range changes, but date picker does not reset filters -- user expects both to be independent | Keep filter state independent of date/comparison state. Date change refetches data but preserves filter selections. Only clear filters that reference items no longer in the new data range. |
| Detail tab + existing OverviewTab data | Duplicating the data fetch for the Detail tab (two API calls for same period) | Both tabs consume the same `data` state from `ReportsContent`. Detail tab filters data CLIENT-SIDE from the already-fetched `data.entries` array. No new API calls needed. |
| Multi-select filters + comparison period | Comparison data lacks the same filter dimensions, leading to broken % change calculations | Do NOT show comparison badges on the Detail tab charts initially. The comparison data from the API is pre-aggregated and cannot be re-filtered to match the Detail tab's multi-select filter state. |
| Topic filter + "Uncategorized" entries | Entries with `topicName: null` become "Uncategorized" (report-utils.ts line 128). Topic filter dropdown may not include "Uncategorized" as an option | Include "Uncategorized" in the topic filter dropdown if any entries have null topicName. Filter matching must handle the "Uncategorized" string, not null. |
| DataTable `defaultSort` + filter changes | DataTable preserves sort state across data changes (it is internal state). After filtering, the sort column may not make sense (e.g., sorted by revenue but revenue column removed for non-admins) | Always use `defaultSort={{ columnId: "date", direction: "desc" }}` which is always present regardless of admin status or filters. |
| Existing tab navigation + new Detail tab | Adding a fourth tab to the `tabs` array in ReportsContent but not handling `activeTab === "detail"` routing to the selected drill-down or filter state | The Detail tab is independent of the drill-down tabs. Switching from Detail to By-Employee should NOT carry over filter selections. Each tab owns its own state. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-aggregating chart data on every render without memoization | ~10-30ms per chart data computation x 6 charts = ~60-180ms frame time | useMemo on all aggregation. Single filtered dataset, derived chart data. | At current scale (~2000 entries/month) this is borderline; at 3+ months of data it becomes noticeable |
| Recharts ResponsiveContainer resize listener firing on every parent layout shift | Chart animation restarts on unrelated DOM changes | Set `debounce` prop on ResponsiveContainer (e.g., `debounce={100}`) | When filter bar expand/collapse changes layout |
| Rendering all 6 charts even when only 2-3 are visible (non-admin sees only hours charts) | 2x SVG nodes for invisible admin-only charts | Conditional rendering with `isAdmin &&`, not CSS visibility | Immediate -- always render only what is needed |
| DataTable sorting 2000+ entries on every filter change | Table sort runs on new data array even if sort criteria unchanged | DataTable's useMemo on sortedData (line 39) already handles this IF the data reference is stable when filters have not changed; ensure parent memoizes the entries passed to DataTable | With 6-month date ranges (~12000 entries) |
| Creating multi-select filter dropdowns that render all 200 client names without virtualization | Filter dropdown feels sluggish to open, especially on mobile | For 200 items, native rendering is fine. Virtualization needed only at 500+. But DO include a search/filter within the dropdown (like existing ClientSelect does). | Not at current ~200 client scale |
| Re-rendering the entire Detail tab (charts + table) when only the filter search input text changes | Typing in filter search causes 6 chart re-renders per keystroke | Isolate the filter dropdown component so internal search state does not propagate to parent until a selection is committed | Immediately if filters have search inputs |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Computing revenue client-side from hourlyRate for filtered subsets | Non-admin user could inspect network response or component state to find hourly rates if they are included in the entries response | The API already excludes revenue for non-admins (report-utils.ts line 303). The Detail tab must use pre-computed revenue from the API. If entry-level revenue is needed, add it server-side with admin gating. |
| Including hourlyRate in the entries array sent to non-admins | Non-admin can see billing rates via DevTools | Verify that `ReportEntry` type and the serialized API response do NOT include hourlyRate for non-admin requests. Current `ReportEntry` type does not include hourlyRate -- keep it that way. |
| Rendering revenue columns as `display: none` instead of excluding from DOM | Revenue values visible via DOM inspection | Use conditional rendering (`isAdmin &&`) to exclude revenue elements entirely from the rendered output |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Multi-select dropdown with no search/typeahead for 200 clients | User must scroll through 200 client names to find one | Include a search input in the dropdown (like existing ClientSelect pattern at lines 146-161). Filter options as user types. |
| No visual indicator of active filters | User forgets filters are applied, wonders why charts show less data than Overview tab | Show filter pills/badges above the charts showing active selections (e.g., "Client: Acme Corp, Beta Ltd [x]"). Include a "Clear all filters" action. |
| Charts animate on every filter change | Distracting bounce/slide animation 6 times whenever a filter checkbox is toggled | Disable Recharts entry animations (`isAnimationActive={false}`) on filter-driven updates. Only animate on initial mount or full data refresh. |
| Filter dropdowns covering the charts below them | On smaller screens, a 200-item dropdown overlays chart content | Use `z-50` and absolute positioning with proper overflow scroll (matching existing ClientSelect pattern). Ensure dropdown maxHeight is bounded (`max-h-56` from ClientSelect line 164). |
| Summary cards not reflecting filter state | User applies a client filter expecting totals to update, but summary shows unfiltered period totals | Either omit summary cards from Detail tab (Overview handles that) or show filtered summary that matches the visible charts/table. Recommendation: show filtered totals in a compact header. |
| "All" vs "None" confusion in multi-select | User clicks "Select All" expecting to see everything, but then deselecting one item feels wrong -- are they now filtering or not? | Start with all items unselected (= show all, no filter active). Only show filter as "active" when items are explicitly selected. "Clear filters" returns to empty selection = show all. |

## "Looks Done But Isn't" Checklist

- [ ] **Multi-select filters:** Empty state (no filters applied) shows ALL data, not empty state -- test by opening Detail tab fresh without selecting anything
- [ ] **Revenue charts:** Completely absent (not rendered) for non-admin users -- inspect DOM, not just visual
- [ ] **Topic filter options:** Include "Uncategorized" if any entries have null topicName -- test with data that has entries without topics
- [ ] **DataTable pagination:** Resets to page 1 when filters change the dataset below current page -- test by going to page 3, then applying a restrictive filter
- [ ] **Chart data:** All 6 chart data arrays are memoized with useMemo -- check React DevTools Profiler for unnecessary re-renders
- [ ] **Filter + date range interaction:** Changing date range preserves filter selections (unless a filtered item no longer exists in new range) -- test by filtering to one client, then changing month
- [ ] **"Other" bucket in charts:** When filtered data still has >15 items, the top-15 + "Other" grouping applies correctly -- test with 3+ clients selected that collectively have >15 topics
- [ ] **Comparison period:** Detail tab either hides comparison badges entirely or correctly re-filters comparison data -- do NOT show stale/unfiltered comparison percentages alongside filtered current data
- [ ] **Chart heights:** Topic chart with many topics still gets dynamic height (`Math.max(256, items * 40)` pattern from ByClientTab line 132) -- test with a filter that shows 20+ topics
- [ ] **Loading state:** Filter changes do NOT trigger the loading spinner (they are client-side filtering, not API calls) -- verify no flash of "Loading..." when toggling a filter
- [ ] **Non-admin table columns:** Revenue column excluded from columns array (not hidden with CSS) when isAdmin is false -- verify via DOM inspection
- [ ] **Tab switching:** Switching between Overview and Detail preserves Detail filter state -- navigate away and back

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cascading re-renders across all charts | LOW | Wrap chart components in React.memo, memoize data arrays. No architectural change needed. |
| Pagination desync | LOW | Already handled by DataTable's internal clamping. If external pagination was added, remove it and use DataTable's internal state. |
| Unstable object references defeating memoization | LOW | Add useMemo wrappers around data derivations. Mechanical change, no logic change. |
| Revenue data leaking to non-admins | MEDIUM | Audit all chart/table renders for isAdmin guards. Add unit test that verifies DOM does not contain revenue values for non-admin session. |
| Inconsistent empty-filter semantics | MEDIUM | Find and fix all filter checks to use `items.length === 0 || items.includes(value)`. If some used the opposite, data may have been misinterpreted by users already. |
| Comparison badges showing unfiltered data | LOW | Remove comparison badges from Detail tab or gate them behind "no filters active" check. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cascading re-renders | Phase 1: Component architecture | React DevTools Profiler shows only affected charts re-render when a filter changes |
| Pagination desync | Phase 2: Filter-table integration | DataTable pagination resets when filtered data changes; no external pagination state exists |
| Unstable references | Phase 1: Component architecture | All chart data arrays are inside useMemo; dependency arrays are minimal |
| Filter array invalidation | Phase 1: Filter state design | Filter state uses useState directly; no derived-from-URL-on-each-render pattern |
| Revenue leaking | Phase 2: Chart implementation | Unit test: non-admin render of Detail tab has no revenue elements in DOM |
| Empty-filter semantics | Phase 1: Filter state design | Unit test: Detail tab with no filters shows same data count as Overview tab |
| Topic "Uncategorized" | Phase 2: Filter dropdown population | Filter dropdown includes "Uncategorized" when entries with null topicName exist |
| Comparison badges | Phase 2: Chart implementation | Detail tab does not show comparison % when any filter is active |
| Summary cards consistency | Phase 1: Component architecture | Decision documented; if filtered summaries, they match table row count |
| Chart re-animation | Phase 2: Chart implementation | Charts do not re-animate on filter change (only on initial mount or data fetch) |

## Sources

- Recharts performance guide: https://recharts.github.io/en-US/guide/performance/
- Recharts multiple charts performance issue #1266: https://github.com/recharts/recharts/issues/1266
- Recharts chart redraw on state change issue #300: https://github.com/recharts/recharts/issues/300
- React useMemo documentation: https://react.dev/reference/react/useMemo
- React "You Might Not Need an Effect": https://react.dev/learn/you-might-not-need-an-effect
- DigitalOcean guide on React performance pitfalls with memo/useMemo/useCallback: https://www.digitalocean.com/community/tutorials/how-to-avoid-performance-pitfalls-in-react-with-memo-usememo-and-usecallback
- React rendering bottleneck case study (60% re-render reduction): https://medium.com/@sosohappy/react-rendering-bottleneck-how-i-cut-re-renders-by-60-in-a-complex-dashboard-ed14d5891c72
- Codebase analysis: `ReportsContent.tsx`, `OverviewTab.tsx`, `ByClientTab.tsx`, `ByEmployeeTab.tsx`, `report-utils.ts`, `DataTable.tsx`, `BarChart.tsx`, `RevenueBarChart.tsx`

---
*Pitfalls research for: v1.2 Reports Detail View with multi-select filters*
*Researched: 2026-02-25*
