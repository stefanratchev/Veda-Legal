# Feature Research

**Domain:** Reports Detail View with multi-select filters for legal timesheet analytics
**Researched:** 2026-02-25
**Confidence:** HIGH -- based on analysis of existing codebase (ReportsContent, OverviewTab, ByClientTab, ByEmployeeTab, DataTable, report-utils, ReportData types), legal reporting tool patterns (Clio, Bill4Time, Smokeball), dashboard filter UX research, and Recharts component architecture.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist once they see a "Detail" tab in a reporting dashboard. Missing these makes the tab feel broken or pointless.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Detail tab in tab bar** | Users see Overview, By Employee, By Client tabs already. A Detail tab fits the existing mental model. Clicking it should show an "everything at once" view. | LOW | Add `"detail"` to the `TabType` union in `ReportsContent.tsx`. Reuse the existing tab bar rendering pattern (active state with accent-pink underline). Place it as the last tab since it is the deepest drill-down. |
| **Hours by Topic horizontal bar chart** | Overview shows Hours by Client and Hours by Employee. The missing dimension is Topic. Partners want to know "where is time being spent across work categories?" without drilling into individual clients or employees. Every legal reporting tool (Clio, Bill4Time, Smokeball) supports filtering/grouping by practice area or matter type -- Topic is this app's equivalent. | MEDIUM | Aggregate `entries` by `topicName` (already on `ReportEntry`). Reuse `BarChart` component with `layout="vertical"` and `maxBars={15}`. Data is already available -- `report-utils.ts` returns all entries with `topicName`. Client-side aggregation in useMemo is sufficient (~200 clients, ~10 employees, maybe 2000 entries/month max). |
| **Revenue by Topic horizontal bar chart (admin-only)** | Revenue by Client and Revenue by Employee exist in Overview. Revenue by Topic completes the triplet. Partners asking "which practice areas generate revenue?" is a standard legal analytics question. | MEDIUM | Filter entries to REGULAR clients with `clientRate > 0` and `!isWrittenOff`, aggregate `hours * rate` by `topicName`. Reuse `RevenueBarChart` component. Admin-only gating matches existing pattern (`isAdmin` prop). Note: revenue data is rate x hours (not SD-based), consistent with existing approach. |
| **Hours by Client horizontal bar chart** | The Detail tab should show all three dimensions together. Hours by Client already exists in Overview but the Detail tab version responds to filters. | LOW | Reuse `BarChart` component with the same data shape (`byClient` array from `ReportData`). When filters are active, re-aggregate from filtered entries. |
| **Hours by Employee horizontal bar chart** | Same rationale as Hours by Client. The Detail tab presents all dimensions simultaneously so the user can see the full picture. | LOW | Reuse `BarChart` component with `byEmployee` data. Filtered version aggregates from filtered entries. |
| **Revenue by Client chart (admin-only)** | Present in Overview. Detail tab should mirror these when no filters are active, and react to filters when they are. | LOW | Reuse `RevenueBarChart` component. |
| **Revenue by Employee chart (admin-only)** | Same as Revenue by Client. | LOW | Reuse `RevenueBarChart` component. |
| **Full entry table** | CLIENT.md specifies: Date, Employee, Client, Topic, Subtopic, Description, Hours, Revenue (admin). This is the atomic data view -- every other chart is an aggregation of this table. Users need to verify specific entries after filtering. | MEDIUM | Reuse `DataTable` component with new column definitions. `ReportEntry` type already has `date`, `userName`, `clientName`, `topicName`, `hours`, `description`. Missing: `subtopicName` is in the `time_entries` schema but NOT currently returned by `report-utils.ts` -- need to add it to the query and `ReportEntry` type. Revenue column = `hours * client.hourlyRate` for REGULAR, non-written-off entries; null otherwise. Sortable by all columns. 50 rows per page (existing pattern). |
| **Multi-select Client filter** | Users expect to isolate data by client. "Show me only Client A and Client B" is the most natural filter in legal reporting. Every competitor supports this. Single-select is insufficient because comparative analysis across 2-3 clients is a core use case. | MEDIUM | Custom multi-select dropdown component. Derive options from `data.byClient` (clients with entries in period). Show selected count as "N clients" when multiple selected. Filter chips/pills to show active selections. When applied, filter entries array and re-aggregate charts. |
| **Multi-select Employee filter** | Same rationale as Client filter. Partners want to see "what did Associates X and Y work on?" | MEDIUM | Same component pattern as Client filter. Derive options from `data.byEmployee`. Non-admin users only see themselves (match existing access control in `ByEmployeeTab`). |
| **Multi-select Topic filter** | Completes the filter triplet. "Show me only Corporate and M&A work" is a standard legal analytics query. | MEDIUM | Same component pattern. Derive unique topic names from `data.entries` (since topics are denormalized as strings on entries, not a top-level aggregation in ReportData). Sort alphabetically. |
| **Filters update all visualizations simultaneously** | This is the core UX contract of a cross-filter dashboard. Changing a filter must update all 6 charts and the entry table at once. Partial updates (e.g., filters affect table but not charts) break trust in the data. | MEDIUM | Single filter state object: `{ clients: string[], employees: string[], topics: string[] }`. One `useMemo` that filters `data.entries` by all active filters. All charts and table derive from this filtered entry list. No additional API calls -- filter client-side from already-fetched data. |
| **Clear individual filter / Clear all filters** | Users who have applied multiple filters need a way to reset without clicking each one. | LOW | "Clear" button per filter dropdown. "Clear all" link when any filter is active. Reset filter arrays to empty (which means "show all"). |
| **Active filter indicators** | When filters are active, users must see what is filtered at a glance. Without this, users forget filters are applied and misinterpret the data. | LOW | Show filter pills/chips below the filter bar: "Client: Acme Corp, Initech" with X to remove each. Alternatively, show count in the filter trigger button: "Clients (2)". Both patterns are well-established. |
| **Integration with existing date range picker** | The Detail tab must respect the same date range as Overview. Changing dates should clear filters and refresh data. | LOW | Already handled -- `ReportsContent` manages `data` state centrally. The Detail tab receives the same `data` prop. Date changes already trigger `fetchData` which replaces `data`. Filters are local to the Detail tab, so they reference the latest `data.entries`. |
| **Integration with existing comparison period** | Comparison period affects Overview's % change badges. The Detail tab can show comparison data on revenue charts (like Overview does) or skip it. | LOW | Comparison data is already fetched and available. Pass to RevenueBarChart as `comparisonData` like Overview does. Note: comparison must be computed on the UNFILTERED dataset (comparison period entries may not overlap with current filters). Keep comparison badges on charts only; do not compare filtered subsets. |
| **Empty state when filters exclude all data** | If a user selects filters that match zero entries, charts and table should show meaningful empty states, not broken layouts. | LOW | Existing chart components already handle empty data (`"No data"` / `"No revenue data"` messages). DataTable has `emptyMessage` prop. Show "No entries match the selected filters" with a "Clear filters" action. |

### Differentiators (Competitive Advantage)

Features that would elevate the Detail tab beyond standard legal reporting tools. Not required for the milestone, but valuable if time permits.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Searchable multi-select dropdowns** | With ~200 clients, scrolling through a dropdown is painful. Type-ahead search within the multi-select lets users find clients quickly. The existing `ClientSelect` already implements search-within-dropdown -- adapt that pattern for multi-select. | MEDIUM | Existing `ClientSelect` has search input, filtered list, keyboard navigation. Adapt to multi-select by adding checkboxes and allowing multiple selections instead of closing on click. Do not use a third-party library -- the existing pattern is clean and matches the design system. |
| **Filter state reflected in URL** | Sharing a filtered view via URL lets partners send each other specific data slices. "Here is the report for Client X with Topic Y" becomes a copyable link. | MEDIUM | Encode filter selections as URL search params: `?clients=id1,id2&employees=id3&topics=Corporate`. Parse on mount to restore filters. Use `router.replace` (not push) to avoid polluting history on every filter change. Defer to post-MVP -- nice for collaboration but not blocking. |
| **Summary stats that update with filters** | Show a mini summary row above the charts: "Showing X entries, Y hours, Z revenue across N clients" that recalculates when filters change. Gives instant feedback that filters are working. | LOW | Simple `useMemo` computation from filtered entries. Four numbers in a single row. Minimal UI. High value for confirming filters are applied correctly. |
| **Chart click-to-filter interaction** | Clicking a bar in "Hours by Client" adds that client to the Client filter. This creates a natural exploration flow: see the chart, click to focus, see the detail. Matches the existing Overview click-to-drill-down pattern but within the Detail tab's filter model. | MEDIUM | On bar click, toggle the clicked entity in the corresponding filter array. Visual feedback: highlight the bar differently when it matches an active filter. Need to differentiate from Overview's click-to-navigate behavior -- Detail tab's click-to-filter is a different interaction model. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like natural additions but create problems for this specific project and scope.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Subtopic-level filtering** | "We have Topics, so why not filter by Subtopic too?" Granularity sounds good. | Subtopics are numerous (~50-100), context-dependent (belong to specific topics), and subtopic names are stored as prefix strings (e.g., "Client correspondence:") that are concatenated with user text. The filter dropdown would be huge and confusing. The PROJECT.md explicitly scopes this out: "Filtering reports by subtopic -- top-level topic filtering added in v1.2, subtopic filtering deferred." | Show subtopicName in the entry table column so users can see it in context. Topic-level filtering is sufficient for the analytics use case. If a user needs to find a specific subtopic's entries, they filter by topic and scan the table. |
| **Server-side filtering (filter params in API)** | "Send filter params to the API for efficiency." Sounds like good engineering. | The API already returns all entries for the date range in a single call (~2000 entries/month max for 10 employees). Client-side filtering of this dataset is instantaneous. Adding server-side filter params means: new API parameters, new SQL query logic, new tests, and the filters would cause a loading state on every change instead of instant re-rendering. The performance gain is zero for this data volume. | Keep filtering 100% client-side. The existing `data.entries` array is already in memory. Filter with `Array.filter()` in `useMemo`. Instant, no network round-trips, no loading spinners. |
| **Dual-axis charts (Hours + Revenue on one chart)** | "Save space by combining Hours and Revenue." Seems efficient. | PROJECT.md Key Decision: "Separate revenue charts (not dual-axis) -- Different scales; avoid confusing layouts." This was an explicit design decision in v1.0. Dual-axis charts are widely considered a data visualization anti-pattern because they mislead users about correlation when scales differ. | Keep Hours and Revenue as separate paired charts, exactly like Overview. Six charts total (3 dimensions x 2 metrics). Use consistent 2-column grid layout. |
| **Drag-and-drop chart arrangement** | "Let users customize their dashboard layout." Power user feature. | 10 users. The layout is designed by one person (the developer) who knows the user base. Dashboard customization requires persistence (where did user X put their charts?), serialization, localStorage or DB storage, and a drag-and-drop framework. Enormous complexity for zero validated need. | Fixed layout optimized for the most common use case: Charts in priority order (Topic first since it is new, then Client, then Employee), with the entry table at the bottom. |
| **CSV/PDF export of filtered results** | "I want to download this data." Reasonable request. | PROJECT.md explicitly defers this: "CSV/PDF export of reports -- defer to future milestone." Adding export means file generation logic, download triggers, and testing file output. This is a separate feature with its own complexity. | Note this as a natural v1.3 follow-up. The entry table is copy-pasteable into Excel in the meantime. |
| **Real-time filter preview (show result count before applying)** | "Show me '47 entries' before I click Apply." Nice UX polish. | Adds complexity for debatable value. With instant client-side filtering, there is no Apply button -- filters take effect immediately. The result count IS the preview. Adding a "preview before apply" model implies a two-step filter interaction (select, then apply) which is slower than immediate filtering. | Apply filters immediately on selection. Show the filtered entry count in the summary stats area. No Apply button needed. |
| **Saved filter presets** | "Save 'Q4 Corporate clients' as a preset." Power user feature from enterprise BI tools. | 10 users. Most will use the same 2-3 filter combinations. Building a preset system requires: naming UI, persistence (localStorage or DB), CRUD for presets, and a preset selector. The ROI for 10 users is near zero. | If partners use the same filters repeatedly, consider the URL-based filter sharing as a lighter alternative. They can bookmark filtered URLs. |

## Feature Dependencies

```
[Detail tab in tab bar]
    └──requires──> nothing (pure UI addition to ReportsContent)

[Multi-select filter component]
    └──requires──> nothing (new reusable UI component)

[Multi-select Client filter]
    └──requires──> [Multi-select filter component]

[Multi-select Employee filter]
    └──requires──> [Multi-select filter component]

[Multi-select Topic filter]
    └──requires──> [Multi-select filter component]

[Client-side filter logic]
    └──requires──> [Multi-select Client filter]
    └──requires──> [Multi-select Employee filter]
    └──requires──> [Multi-select Topic filter]

[Hours by Topic chart]
    └──requires──> [Client-side filter logic] (aggregates from filtered entries)

[Revenue by Topic chart]
    └──requires──> [Client-side filter logic]

[Hours by Client chart (Detail)]
    └──requires──> [Client-side filter logic]

[Revenue by Client chart (Detail)]
    └──requires──> [Client-side filter logic]

[Hours by Employee chart (Detail)]
    └──requires──> [Client-side filter logic]

[Revenue by Employee chart (Detail)]
    └──requires──> [Client-side filter logic]

[Full entry table]
    └──requires──> [Client-side filter logic]
    └──requires──> [subtopicName added to ReportEntry type + report-utils query]

[Active filter indicators / pills]
    └──requires──> [Multi-select Client filter]
    └──requires──> [Multi-select Employee filter]
    └──requires──> [Multi-select Topic filter]

[Clear all filters]
    └──requires──> [Active filter indicators]

[Empty state for zero-match filters]
    └──requires──> [Client-side filter logic]

[Summary stats row]
    └──enhances──> [Client-side filter logic] (shows filtered counts)

[Chart click-to-filter]
    └──enhances──> [Multi-select Client filter]
    └──enhances──> [Multi-select Employee filter]
```

### Dependency Notes

- **Multi-select filter component is the key building block:** All three filters (Client, Employee, Topic) use the same component with different option sources. Build it once as a reusable `MultiSelect` component in `components/ui/`, following the same pattern as `ClientSelect` (search input, dropdown, keyboard nav) but with checkbox-based multi-selection.
- **Client-side filter logic is the central orchestrator:** A single filtered entries array feeds all charts and the table. This is a pure React state + useMemo concern -- no API changes needed for filtering.
- **subtopicName requires a data pipeline change:** The `report-utils.ts` query currently fetches `topicName` but not `subtopicName` from time_entries. The schema has it. Adding it to the query, the ReportEntry type, and the response is a small but necessary change for the entry table's Subtopic column.
- **Revenue column in entry table requires per-entry calculation:** Revenue is `hours * client.hourlyRate` for REGULAR, non-written-off entries. The client hourly rate is available in `byClient` data but not directly on each `ReportEntry`. Either enrich entries with rate data from the API, or look up from `byClient` on the client side.

## MVP Definition

### Launch With (v1.2 -- This Milestone)

The complete Detail tab as specified in PROJECT.md Active requirements.

- [ ] Detail tab added to ReportsContent tab bar -- navigation structure
- [ ] Multi-select filter component (`MultiSelect`) in `components/ui/` -- reusable building block
- [ ] Multi-select Client filter with search -- core filter
- [ ] Multi-select Employee filter with search -- core filter
- [ ] Multi-select Topic filter -- core filter
- [ ] Client-side filter logic (single useMemo, all filters AND-composed) -- filter engine
- [ ] Active filter pills with individual remove -- UX clarity
- [ ] Clear all filters button -- reset mechanism
- [ ] Hours by Topic horizontal bar chart -- new visualization
- [ ] Revenue by Topic horizontal bar chart (admin-only) -- new visualization
- [ ] Hours by Client horizontal bar chart (filtered) -- existing chart pattern, filtered data
- [ ] Revenue by Client horizontal bar chart (admin-only, filtered) -- existing chart pattern, filtered data
- [ ] Hours by Employee horizontal bar chart (filtered) -- existing chart pattern, filtered data
- [ ] Revenue by Employee horizontal bar chart (admin-only, filtered) -- existing chart pattern, filtered data
- [ ] Full entry table with all columns (Date, Employee, Client, Topic, Subtopic, Description, Hours, Revenue) -- atomic data view
- [ ] subtopicName added to report-utils query and ReportEntry type -- data pipeline for Subtopic column
- [ ] Revenue column in entry table (admin-only) -- matches PROJECT.md spec
- [ ] Empty state when filters match nothing -- graceful degradation
- [ ] Integration with existing date range picker and comparison period -- consistency

### Add After Validation (v1.x)

Features to add once the core Detail tab is working.

- [ ] Summary stats row showing filtered totals (entries, hours, revenue, clients) -- quick feedback
- [ ] Searchable multi-select dropdowns with type-ahead -- UX improvement for ~200 clients
- [ ] Chart click-to-filter interaction -- exploration flow enhancement
- [ ] Filter state in URL search params -- shareable filtered views

### Future Consideration (v2+)

Features to defer to later milestones.

- [ ] CSV/PDF export of filtered report data -- explicitly deferred in PROJECT.md
- [ ] Subtopic-level filtering -- explicitly deferred in PROJECT.md
- [ ] Saved filter presets -- only if repeated filter patterns emerge from usage
- [ ] Utilization rate analysis (billable vs non-billable breakdown) -- out of scope per PROJECT.md

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Detail tab in tab bar | HIGH (navigation structure) | LOW | P1 |
| MultiSelect component | HIGH (blocks all filters) | MEDIUM | P1 |
| Client filter | HIGH (core filter) | LOW (uses MultiSelect) | P1 |
| Employee filter | HIGH (core filter) | LOW (uses MultiSelect) | P1 |
| Topic filter | HIGH (core filter) | LOW (uses MultiSelect) | P1 |
| Client-side filter logic | HIGH (core engine) | MEDIUM | P1 |
| Active filter pills | HIGH (UX clarity) | LOW | P1 |
| Clear all filters | MEDIUM (convenience) | LOW | P1 |
| Hours by Topic chart | HIGH (new dimension) | LOW (reuse BarChart) | P1 |
| Revenue by Topic chart | HIGH (new dimension) | LOW (reuse RevenueBarChart) | P1 |
| Hours by Client chart (filtered) | HIGH (consistency) | LOW | P1 |
| Revenue by Client chart (filtered) | HIGH (consistency) | LOW | P1 |
| Hours by Employee chart (filtered) | HIGH (consistency) | LOW | P1 |
| Revenue by Employee chart (filtered) | HIGH (consistency) | LOW | P1 |
| Full entry table | HIGH (atomic data view) | MEDIUM | P1 |
| subtopicName in ReportEntry | MEDIUM (table column) | LOW | P1 |
| Revenue column in table | MEDIUM (admin feature) | LOW | P1 |
| Empty state for zero matches | MEDIUM (graceful degradation) | LOW | P1 |
| Summary stats row | MEDIUM (filtered feedback) | LOW | P2 |
| Searchable multi-select | MEDIUM (UX for 200 clients) | MEDIUM | P2 |
| Chart click-to-filter | MEDIUM (exploration) | MEDIUM | P2 |
| URL filter state | LOW (sharing) | MEDIUM | P3 |

**Priority key:**
- P1: Must have for this milestone (matches PROJECT.md Active requirements)
- P2: Should have, add when time permits within milestone
- P3: Nice to have, future consideration

## Existing Infrastructure to Leverage

The existing reports infrastructure is substantial. The Detail tab builds on top of it rather than reinventing.

| Existing Asset | How Detail Tab Uses It | Notes |
|----------------|----------------------|-------|
| `ReportsContent.tsx` (tab management, data fetching) | Add `"detail"` to `TabType`. Pass same `data`, `comparisonData`, `isAdmin` props to new `DetailTab` component. Reuse `handleDateChange` and `handleComparisonChange`. | No changes to data fetching logic. Filters are local to DetailTab. |
| `BarChart` component | Reuse for all Hours charts (by Topic, by Client, by Employee). Same `layout="vertical"`, `maxBars={15}`, `valueFormatter={formatHours}` pattern. | Zero changes needed to BarChart component itself. |
| `RevenueBarChart` component | Reuse for all Revenue charts. Same `comparisonData` and `maxBars` pattern. | Zero changes needed. May skip comparison data on filtered views (comparison period may not have same entities). |
| `DataTable` component | Reuse for entry table. New column definitions but same sort, pagination, and empty state infrastructure. | May need minor enhancement: currently no built-in filter support, but filtering happens BEFORE passing data to DataTable (pre-filtered array). |
| `report-utils.ts` (data aggregation) | Add `subtopicName` to the query's column selection. Add to ReportEntry type. Otherwise unchanged. | Small, safe change -- adding one column to existing query. |
| `ReportData` / `ReportEntry` types | Extend `ReportEntry` with `subtopicName: string`. All other types unchanged. | Type-safe -- TypeScript will flag any consumers that need updating. |
| `ClientSelect` component pattern | Adapt the search-within-dropdown pattern for the new `MultiSelect` component. Same dark theme styling, keyboard navigation, click-outside-to-close. | Do not modify `ClientSelect` itself -- create a new `MultiSelect` component that shares the same visual DNA. |
| `TableFilters` component | Reference but do not reuse directly. It supports single-select dropdown + search. The Detail tab needs multi-select filters with a different layout (horizontal filter bar above charts, not inline with table). | The filter bar is a new composition specific to the Detail tab. |
| Design system CSS variables | All new components use `--bg-elevated`, `--bg-surface`, `--border-subtle`, `--text-primary`, `--text-muted`, `--accent-pink` etc. | Consistent with existing dark theme. No new colors needed. |
| `formatHours`, `formatDateISO`, `formatMonthShort` | Reuse in chart labels, table cells, summary stats. | Already imported in existing report components. |

## Competitor Feature Analysis

| Feature | Clio | Bill4Time | Smokeball | Our Approach (v1.2) |
|---------|------|-----------|-----------|---------------------|
| Filter by client | Advanced custom reports with filters | Filter by client, matter, date | Basic client filter | Multi-select client filter with search |
| Filter by attorney/employee | Filter by staff member | Filter by user | Not prominent | Multi-select employee filter |
| Filter by practice area/topic | Practice area dashboard, custom datasets | Group by matter type | Practice Area filter on reports | Multi-select topic filter |
| Cross-filter (filters affect all views) | Custom report builder (separate tool) | Customizable report columns/grouping | Limited to per-report filters | All charts + table update simultaneously from one filter bar |
| Entry-level detail table | Client reports with transaction details | Time detail export | Billing reports with line items | Full entry table with sort, pagination, all columns |
| Revenue analytics | Financial dashboards, separate billing reports | Billing/payment reports | Billing Reports section | Revenue by Topic/Client/Employee charts (admin-only, rate x hours) |

Our approach is simpler but more integrated than competitors. Clio and Bill4Time have more powerful custom report builders, but they separate filtering from visualization. Our Detail tab puts filters, charts, and data table in one view -- more immediate for a 10-person firm that does not need enterprise BI complexity.

## Sources

- [Clio Law Firm Insights & Reporting](https://www.clio.com/features/law-firm-insights/) -- MEDIUM confidence, marketing page but details feature set
- [Bill4Time Advanced Customizable Reports](https://www.bill4time.com/blog/bill4times-advanced-customizable-reports/) -- MEDIUM confidence, feature announcement
- [Bill4Time Legal Reporting Software](https://www.bill4time.com/legal-reporting-software/) -- MEDIUM confidence, product page
- [Smokeball Billing Reports](https://support.smokeball.com/hc/en-us/articles/5885848282135-Billing-Reports) -- MEDIUM confidence, support documentation
- [Pencil & Paper: Filter UX Design Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering) -- MEDIUM confidence, UX analysis
- [Pencil & Paper: Dashboard Design UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards) -- MEDIUM confidence, UX analysis
- [PatternFly: Filter Design Guidelines](https://www.patternfly.org/patterns/filters/design-guidelines/) -- MEDIUM confidence, open-source design system
- [Borstch: Cross-Filtering in Dashboards](https://borstch.com/blog/development/implementing-cross-filtering-in-dashboards-with-tanstack-react-charts) -- LOW confidence, blog post but describes the pattern well
- Existing codebase analysis (ReportsContent, OverviewTab, ByClientTab, ByEmployeeTab, BarChart, RevenueBarChart, DataTable, ClientSelect, report-utils, schema.ts, types/reports.ts) -- HIGH confidence, direct code review

---
*Feature research for: Reports Detail View with multi-select filters for legal timesheet analytics*
*Researched: 2026-02-25*
