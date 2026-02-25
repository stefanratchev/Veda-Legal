# Project Research Summary

**Project:** v1.2 Reports Detail View — Multi-Select Filters, Chart-Filter Interactivity, Topic Aggregation
**Domain:** Legal Timesheet Analytics — Interactive Reporting Dashboard
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

The v1.2 Detail tab is an additive feature built almost entirely on top of existing infrastructure. The app already has all required technologies (React 19, Recharts, Drizzle, Tailwind), all required chart components (BarChart, RevenueBarChart, DataTable), and established patterns for filter state, aggregation, and dropdown UX (ClientSelect). Zero new npm packages are needed. The work is primarily new component composition with two small backward-compatible API additions: `subtopicName` and per-entry `revenue` fields on `ReportEntry`.

The recommended approach is client-side filtering with `useMemo`-derived data, matching the pattern already in use in `OverviewTab`, `ByClientTab`, and `ByEmployeeTab`. All entries for the selected date range are already in memory when the Detail tab renders — no additional API calls are needed for filtering. A new reusable `MultiSelectFilter` component (built on the `ClientSelect` pattern) drives three independent filters (Client, Employee, Topic) whose combined selection is AND-composed into a single `filteredEntries` array that feeds all six charts and the entry table simultaneously.

The primary implementation risk is Recharts performance: six charts re-rendering simultaneously on every filter interaction can cause visible lag if `useMemo` and `React.memo` are not applied correctly from the start. This must be established as the architectural baseline before building individual charts, not retrofitted later. A secondary concern is the `isAdmin` access control: revenue data must be conditionally excluded from rendering (not merely hidden with CSS), following the pattern already established in existing tabs. Both risks are well-understood and have clear mitigations documented in research.

## Key Findings

### Recommended Stack

No new dependencies are required. The entire Detail tab can be built with React 19 `useState`/`useMemo`/`useCallback`, Recharts 3.6 (existing chart components unchanged), Tailwind CSS 4 (existing design system variables), and TypeScript 5. The rejected alternatives — `react-select` (47KB, incompatible dark theme), `@tanstack/react-table` (rewriting working DataTable for filtering alone), `nuqs` (URL sync adds complexity for 10 internal users), `zustand`/`jotai` (filter state is local, not global) — were each evaluated against the specific data scale (~10 employees, ~200 clients, ~30 topics) and found unnecessary.

**Core technologies:**
- React 19.2.1: `useState` + `useMemo` for filter state and derived data — same pattern as existing OverviewTab
- Recharts 3.6.0: existing `BarChart` and `RevenueBarChart` components, passed filtered/aggregated data — zero changes to chart components
- Tailwind CSS 4.x: existing dark theme CSS variables, `animate-fade-up` pattern for dropdown — no new design tokens
- TypeScript 5.x: `ReportEntry` type extension (add `subtopicName`, `revenue`) — backward compatible, TypeScript propagates errors to all consumers
- Vitest + React Testing Library: existing test infrastructure — `fireEvent` not `userEvent` (not installed per CLAUDE.md)

### Expected Features

All features are achievable within the milestone with no external dependencies. The `MultiSelectFilter` component is the single most important building block — all three filters share the same component with different option sources.

**Must have (table stakes for this milestone):**
- Detail tab in tab bar (4th tab, deepest drill-down) — navigation structure users expect
- Multi-select Client filter with search — core filter for comparative analysis across 2-3 clients
- Multi-select Employee filter with search — core filter; non-admin users see only themselves
- Multi-select Topic filter — completes the filter triplet (Client + Employee + Topic)
- Client-side AND-composed filter logic feeding all visualizations simultaneously — the core UX contract
- Active filter pills with individual remove and Clear All — without this, users forget filters are applied and misread charts
- Hours by Topic horizontal bar chart — the new analytical dimension; Client/Employee already exist in Overview
- Revenue by Topic chart (admin-only) — completes the revenue triplet
- Hours/Revenue by Client and Employee charts (filtered versions) — existing chart types, now filter-responsive
- Full entry table: Date, Employee, Client, Topic, Subtopic, Description, Hours, Revenue (admin-only) — atomic data view
- `subtopicName` added to `ReportEntry` type and `report-utils` query — required for Subtopic table column
- Per-entry `revenue` computed server-side (with admin gating) added to `ReportEntry` — avoids client-side rate exposure
- Empty state when filters match nothing — graceful degradation with "Clear filters" action

**Should have (add within milestone if time permits):**
- Summary stats row (filtered totals: entries, hours, revenue, clients count) — instant confirmation that filters are working
- Chart click-to-filter interaction — clicking a bar adds that entity to the corresponding filter (natural exploration flow)

**Defer (v1.3+):**
- CSV/PDF export of filtered results — explicitly deferred in PROJECT.md
- Subtopic-level filtering — explicitly deferred in PROJECT.md; subtopics are prefix strings that would produce a confusing 50-100 item dropdown
- Filter state in URL search params (shareable filtered views) — low ROI for 10 internal users; can be added without architecture changes
- Saved filter presets — enterprise feature with near-zero ROI at this scale

### Architecture Approach

The Detail tab slots into `ReportsContent` as a fourth tab type, receiving the same `data: ReportData` and `comparisonData` props already passed to existing tabs. All filter state lives inside `DetailTab` (not in the shared `ReportsContent`), isolated via three `useState<Set<string>>` calls using the "empty Set = no filter = show all" convention. A single `filteredEntries` `useMemo` feeds six chart data `useMemo` calls and the DataTable directly. Filter options derive from the unfiltered dataset (not from filtered results), preventing cascading filter option narrowing. Two existing files require small modifications (`types/reports.ts`, `lib/report-utils.ts`); three new logic files are created (`detail-tab-utils.ts`, `MultiSelectFilter.tsx`, `DetailTab.tsx`), each with a companion test file; and `ReportsContent.tsx` receives a tab registration change.

**Major components:**
1. `MultiSelectFilter` (new, `components/ui/`) — reusable dropdown with checkboxes, search, select-all/clear, pill display; modeled directly on existing `ClientSelect` pattern with `useClickOutside` and `animate-fade-up`
2. `DetailTab` (new, `components/reports/`) — owns filter state, derives filtered data via `useMemo`, renders filter bar + 6 charts + entry table; receives `key` prop tied to date range for automatic state reset on date change
3. `detail-tab-utils.ts` (new, `lib/`) — pure `filterEntries`, `aggregateByClient`, `aggregateByEmployee`, `aggregateByTopic` functions; unit-testable without React; single source of aggregation logic for all 6 charts

### Critical Pitfalls

1. **Cascading re-renders across all 6 charts on every filter change** — Recharts SVG rebuilds are expensive; 6 simultaneous re-renders cause visible lag. Prevent by wrapping chart components in `React.memo`, memoizing all chart data arrays with `useMemo`, and computing filtered data once in `DetailTab`. Must be the baseline architecture from the start, not a retrofit.

2. **Unstable object/array references defeating memoization** — Inline `.map()`/`.filter()` calls during render create new array references every render, making `React.memo` useless. All chart data derivations must be inside `useMemo` with `filteredEntries` (itself memoized) as the dependency. The existing `ByClientTab` has this bug — do not copy that pattern.

3. **Revenue data leaking to non-admin users** — Per-entry `revenue` must be computed server-side with admin gating (returned as `null` for non-admins). Revenue chart components must be conditionally excluded from rendering (`isAdmin &&`), not hidden with CSS. Never compute revenue from `hourlyRate` client-side.

4. **Inconsistent "empty filter = show all" semantics** — Establish one convention (empty `Set` = no filter active = show all) enforced through a shared `filterEntries` utility. Inconsistent implementations produce charts showing all data while the table shows nothing.

5. **Comparison period badges showing unfiltered percentages alongside filtered charts** — The comparison data from the API is pre-aggregated and cannot be trivially re-filtered per the multi-select state. Exclude comparison badges from the Detail tab entirely, or re-filter `comparisonData.entries` using the same `filterEntries` function.

## Implications for Roadmap

Based on research, the build has a clear dependency order with four natural phases. No phase requires a research spike — all patterns are established in the existing codebase and verified against installed package versions.

### Phase 1: Data Layer Foundation

**Rationale:** All downstream work depends on correct data shapes. Establishing these first surfaces TypeScript errors early and ensures subsequent code is built on stable foundations. The pitfalls research identifies unstable references, filter array invalidation, and revenue security as "Phase 1" issues that cannot be cheaply retrofitted. Defining the "empty Set = show all" convention here prevents inconsistency in all subsequent phases.

**Delivers:** Extended `ReportEntry` type (with `subtopicName` and `revenue: number | null`), updated `report-utils.ts` query computing per-entry revenue with admin gating, and the `detail-tab-utils.ts` pure function library (`filterEntries`, `aggregateByClient`, `aggregateByEmployee`, `aggregateByTopic`) with full unit test coverage.

**Addresses:** Entry table Subtopic column (requires `subtopicName`), revenue aggregation without client-side rate exposure (requires per-entry `revenue`), correct filter logic with "empty = all" semantics.

**Avoids:** Client-side revenue computation from `hourlyRate` (security pitfall), inline filter logic duplicated across 6 charts (maintainability pitfall).

**Modified files:** `types/reports.ts`, `lib/report-utils.ts`
**New files:** `lib/detail-tab-utils.ts`, `lib/detail-tab-utils.test.ts`

### Phase 2: MultiSelectFilter Component

**Rationale:** The reusable `MultiSelectFilter` component is the building block for all three filters. Building and testing it in isolation (before `DetailTab`) produces a cleaner `DetailTab` assembly and verifiable standalone behavior. Search within the dropdown is a table-stakes feature for ~200 clients and belongs here, not deferred.

**Delivers:** A reusable `MultiSelectFilter` component in `components/ui/` with search input (typeahead), checkbox-based item selection, select-all/clear-all actions, pill display of selections in the trigger button, `useClickOutside` to close on outside click, and `animate-fade-up` on dropdown open. Full unit tests covering: render with no selection, open/close, search filtering, toggle single item, select all, clear all, keyboard navigation.

**Uses:** `useClickOutside` hook (existing), Tailwind dark theme variables (existing), `animate-fade-up` convention (existing animation rule), `ClientSelect` as the direct pattern reference.

**Avoids:** Third-party select libraries (`react-select`: 47KB + dark theme incompatibility; Headless UI: multi-select requires combining two components with no search).

**New files:** `components/ui/MultiSelectFilter.tsx`, `components/ui/MultiSelectFilter.test.tsx`

### Phase 3: DetailTab Assembly

**Rationale:** With data shapes correct (Phase 1) and the filter component ready (Phase 2), `DetailTab` is primarily wiring: compose three `MultiSelectFilter` instances, derive `filteredEntries` and six chart data arrays via `useMemo`, pass to existing chart components which require zero changes.

**Delivers:** The complete Detail tab — filter bar (3 filters with active pills + Clear All), 6 charts in a 3-column grid (Hours by Client, Employee, Topic in row 1; Revenue by Client, Employee, Topic in row 2, admin-only), full entry table (8 columns, 50-row pagination, Date defaultSort). Revenue charts and Revenue table column are admin-only via conditional rendering, not CSS. `key` prop on `DetailTab` tied to date range string triggers automatic filter state reset on date change. Comparison period badges excluded from Detail tab.

**Implements:** `React.memo` on chart consumers with stable `useMemo`-derived data arrays, DataTable receiving pre-filtered data array with no external pagination state (DataTable owns pagination internally).

**Avoids:** Pagination desync (DataTable owns state), revenue leak (conditional rendering), comparison badge confusion (excluded), chart re-animation on filter change (`isAnimationActive={false}` on filter-driven renders).

**Modified files:** `components/reports/ReportsContent.tsx` (add `"detail"` to `TabType`, add tab button, render `<DetailTab key={dateRangeKey} .../>`)
**New files:** `components/reports/DetailTab.tsx`, `components/reports/DetailTab.test.tsx`

### Phase 4: Polish (if time permits within milestone)

**Rationale:** P2 features from the prioritization matrix that add meaningful value but do not block the core milestone. Each is self-contained and can be added after core functionality is validated with the team.

**Delivers:** Summary stats row above the charts showing filtered totals (entries count, total hours, total revenue for admin, distinct client count) — calculated from `filteredEntries` via `useMemo`. Optionally: chart click-to-filter interaction (clicking a bar adds that entity to the corresponding filter).

**Note:** URL filter state (`nuqs` or `URLSearchParams`) is explicitly P3 and should not be attempted within this milestone.

### Phase Ordering Rationale

- Phase 1 before Phase 3: TypeScript type changes (`ReportEntry` additions) propagate errors to all consumers — catch them before writing the component, not during integration.
- Phase 2 before Phase 3: `MultiSelectFilter` is a hard dependency of `DetailTab`. Building it first means `DetailTab` assembly is straightforward import-and-compose rather than build-and-wire simultaneously.
- Phase 3 is pure assembly: all pieces verified individually. The "wiring" phase is easier to reason about and test when each piece has independent test coverage.
- Phase 4 last: polish on a working foundation, not before validation.
- No research spikes needed: every pattern (filter state, `useMemo` aggregation, dropdown UX, chart props, DataTable columns) has a verified codebase precedent at the file and line level.

### Research Flags

Phases with standard patterns (no additional research needed):

- **Phase 1:** Type extension and query addition are mechanical. TypeScript guides the changes; `report-utils.ts` revenue computation follows the existing `billing-utils.ts` pattern.
- **Phase 2:** Component pattern established directly by existing `ClientSelect` (202 lines). Adaptation, not invention.
- **Phase 3:** Chart and table components unchanged. Wiring pattern established by `OverviewTab`. `React.memo` and `useMemo` patterns are standard React.
- **Phase 4:** Summary stats is a single `useMemo` computation. Chart click-to-filter follows the existing `BarChart` `onBarClick` prop pattern.

No phase requires a `gsd:research-phase` call — the existing codebase is the domain reference and all relevant patterns have been verified.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified from `package.json`. All patterns verified from direct component code reading. Zero new packages. Rejected libraries evaluated against specific data scale (~10 employees, ~200 clients). |
| Features | HIGH | Derived from existing codebase analysis + competitor feature review (Clio, Bill4Time, Smokeball). Scope explicitly bounded by PROJECT.md Active requirements. Anti-features validated against explicit PROJECT.md decisions (no dual-axis, no subtopic filter, no export). |
| Architecture | HIGH | Patterns verified against existing `OverviewTab`, `ByClientTab`, `ByEmployeeTab`, `ClientSelect`, `DataTable`, `report-utils`. Direct file reading at line level, not inference. Build order derived from TypeScript dependency chain. |
| Pitfalls | HIGH | Recharts re-render issues verified against documented GitHub issues (#300, #1266). React memoization semantics verified against official docs. Codebase-specific pitfalls identified from direct code reading (ByClientTab's inline reduce outside useMemo, existing revenue exclusion pattern in report-utils line 303). |

**Overall confidence:** HIGH

### Gaps to Address

- **Revenue column requires `hourlyRate` available at query time:** The `report-utils.ts` query joins `timeEntries` with `clients`. The `clients.hourlyRate` field is a Decimal/numeric type. The per-entry revenue computation `Number(entry.hours) * Number(entry.client.hourlyRate)` must use consistent casting to avoid floating-point rounding differences from the billing module. Validate the exact casting during Phase 1 implementation against test entries with known hourly rates.

- **Comparison period behavior in Detail tab:** Research recommends excluding comparison badges from the Detail tab when any filter is active (to avoid showing unfiltered comparison percentages alongside filtered current data). The exact implementation decision — always exclude vs. conditionally exclude based on filter state — should be confirmed at the start of Phase 3. If `comparisonData.entries` is available as a flat array (same shape as `data.entries`), re-filtering is straightforward using the same `filterEntries` function.

- **Filter state preservation across tab navigation:** The current recommendation (using a `key` prop on `DetailTab` tied to the date range) resets filter state on date change but also on any unmount/remount including tab switches. If the desired UX is "preserve filter state when switching between tabs," filter state would need to lift to `ReportsContent`. Confirm the desired behavior before Phase 3 implementation.

## Sources

### Primary (HIGH confidence)

- `app/src/components/reports/ReportsContent.tsx` — Tab architecture, date range state, data fetching, tab rendering pattern
- `app/src/components/reports/OverviewTab.tsx` — Correct `useMemo` for revenue data (lines 85-111); chart data derivation pattern
- `app/src/components/reports/ByClientTab.tsx` — `Array.reduce()` aggregation pattern (lines 102-129); anti-pattern example: inline reduce outside `useMemo`
- `app/src/components/reports/ByEmployeeTab.tsx` — Same aggregation pattern; employee filter single-select precedent
- `app/src/components/ui/ClientSelect.tsx` — Dropdown with search, keyboard nav, `useClickOutside`, `animate-fade-up` (202 lines) — direct pattern for `MultiSelectFilter`
- `app/src/lib/report-utils.ts` — Query shape, entry mapping, revenue exclusion for non-admins (line 303)
- `app/src/types/reports.ts` — `ReportData`, `ReportEntry`, `ClientStats`, `EmployeeStats`, `TopicAggregation` types
- `app/src/components/ui/DataTable.tsx` — `ColumnDef`, internal pagination state, `defaultSort`, `emptyMessage`
- `app/src/lib/schema.ts` — `timeEntries.subtopicName` field confirmed present; ready to query
- `app/package.json` — Verified: React 19.2.1, Recharts 3.6.0; no state management or select libraries installed

### Secondary (MEDIUM confidence)

- [Clio Law Firm Insights](https://www.clio.com/features/law-firm-insights/) — Feature benchmark for legal reporting; filter by client/attorney/practice area
- [Bill4Time Advanced Reports](https://www.bill4time.com/blog/bill4times-advanced-customizable-reports/) — Filter by user, group by matter type; attorney filtering patterns
- [Smokeball Billing Reports](https://support.smokeball.com/hc/en-us/articles/5885848282135-Billing-Reports) — Practice area filter on billing reports
- [PatternFly Filter Design Guidelines](https://www.patternfly.org/patterns/filters/design-guidelines/) — Multi-select filter UX patterns; "empty = all" convention
- [Pencil & Paper Dashboard UX](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards) — Cross-filter dashboard patterns; filter pill indicators

### Tertiary (for pitfall verification)

- [Recharts GitHub #300](https://github.com/recharts/recharts/issues/300) — Chart redraw on parent state change (confirms Pitfall 1: cascading re-renders)
- [Recharts GitHub #1266](https://github.com/recharts/recharts/issues/1266) — Multiple chart performance issue
- [React useMemo docs](https://react.dev/reference/react/useMemo) — Dependency comparison semantics with `Object.is` (confirms Pitfall 3: unstable references)
- [DigitalOcean React performance guide](https://www.digitalocean.com/community/tutorials/how-to-avoid-performance-pitfalls-in-react-with-memo-usememo-and-usecallback) — `React.memo`/`useMemo`/`useCallback` interaction patterns

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
