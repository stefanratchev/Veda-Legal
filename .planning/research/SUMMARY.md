# Project Research Summary

**Project:** Legal Practice Reporting Dashboard — Advanced Charts, Revenue Views, Topic Breakdowns
**Domain:** Legal practice management reporting (Next.js + Recharts + Drizzle ORM)
**Researched:** 2026-02-24
**Confidence:** HIGH (stack/architecture), MEDIUM (features)

## Executive Summary

This milestone enhances an existing, working reporting system in a Next.js legal practice app serving ~10 employees and ~200 clients. Research confirms that zero new dependencies are required — Recharts 3.6.0, Drizzle ORM 0.45.1, and the existing billing calculation functions in `lib/billing-pdf.tsx` cover every feature requirement. The work is pattern-based: new aggregation queries, extended API response shapes, new Recharts chart instances using existing patterns, and removing the artificial 10-entry limit from drill-down tables. The recommended stack decision is to keep everything as-is (optional Recharts 3.7.0 bump for minor improvements).

The recommended approach is a phased build that respects data-layer dependencies: topic data must flow through the API before any topic-related UI can be built, and revenue data from finalized service descriptions requires a dedicated endpoint (not merged into the existing reports endpoint) because it queries a completely different table hierarchy with different caching characteristics. Actual billed revenue should be deferred to after the core charts are validated, both because it is the highest-complexity feature and because it carries significant UX risk if the estimated vs. actual delta confuses partners.

The key risks are: (1) the estimated vs. actual revenue numbers will never match due to six billing adjustment mechanisms (caps, discounts, waivers, retainer logic, FIXED-fee topics, SD-level discounts) — the UI must clearly label both figures and handle periods with no finalized SDs as "no data" rather than zero; (2) the existing pattern of fetching all raw entries into Node.js for in-memory aggregation needs to be evaluated before adding topic dimensions — for the current firm size it is still fine, but the warning signs are documented; (3) null `topicId` entries (legacy or deleted topics) must resolve to "Uncategorized" rather than crash the aggregation.

## Key Findings

### Recommended Stack

No new packages. The existing stack handles every requirement. Recharts' `BarChart` (grouped mode for revenue), `AreaChart` (time trends), and the existing `BarChart` component with `layout="vertical"` (topic breakdowns) cover all chart types. Drizzle ORM's `groupBy` + `sum()` cover all aggregation needs. The canonical billing functions `calculateGrandTotal` and `calculateRetainerGrandTotal` in `lib/billing-pdf.tsx` must be reused for actual revenue calculation — they already handle every billing complexity and are already called from `GET /api/billing`. See `.planning/research/STACK.md` for chart implementation patterns and data shape definitions.

**Core technologies:**
- Recharts 3.6.0: All chart rendering — Grouped `BarChart` for revenue, `AreaChart` for time trends, existing `BarChart` component for topic breakdowns. No changes required.
- Drizzle ORM 0.45.1: SQL aggregation for topic breakdowns (`groupBy` + `sum()`). Already at latest version.
- `lib/billing-pdf.tsx` (existing): Canonical billing total functions — must reuse, not re-implement, for actual revenue calculation.
- Next.js 16 / React 19 / TypeScript 5: No changes to framework.

**What NOT to add:** `date-fns`, `@tanstack/react-table`, `react-window`, `shadcn/ui charts`, `d3-scale`. Each was evaluated and rejected based on codebase review.

### Expected Features

Research against Clio, MyCase, Smokeball, and direct codebase analysis established a clear P1/P2 split. See `.planning/research/FEATURES.md` for the full prioritization matrix and competitor comparison.

**Must have (table stakes — P1):**
- Revenue by Client chart (estimated: rate x hours) — every legal PM tool has this; data already in API
- Revenue by Employee chart (estimated) — standard attorney productivity metric; needs new aggregation
- Topic breakdown in client drill-down — "what work was done?" is the first question when viewing a client
- Topic breakdown in employee drill-down — cross-client practice-area distribution per attorney
- Hours over time trend in client drill-down — client workload trend; employee trend already exists
- All entries in drill-down tables (remove 10-entry limit) — current limit prevents real analysis
- Topic column in entry tables — `topicName` already on DB rows, just not in response or UI

**Should have (differentiators — P2, add after P1 validation):**
- Actual billed revenue from finalized service descriptions — true realization rate vs. competitor tools
- Estimated vs. actual revenue comparison — surfaces write-offs and discounts at a glance

**Defer (v2+):**
- CSV/PDF export — explicitly out of scope per PROJECT.md
- Utilization rate (billable vs. non-billable) — not requested, data model supports it for later
- Collection tracking / payment recording — requires an entirely new domain
- Real-time dashboards, mobile layouts, custom report builder — anti-features for this firm size

### Architecture Approach

The architecture is an extension of the existing pattern: `ReportsContent` owns all state and fetches, tab components receive data via props, Recharts components render data. The key structural decision is to add a second API endpoint (`GET /api/reports/revenue`) rather than expanding the existing endpoint — because finalized SD data lives in a different table hierarchy, is admin-only, is immutable once finalized, and would double the complexity of an already 250-line aggregation route. Topic data is cheap to add (already denormalized as `topicName` on `time_entries`) and stays in the existing endpoint via an extended single-pass aggregation loop. See `.planning/research/ARCHITECTURE.md` for full component diagram, data flow, and build dependency graph.

**Major components:**
1. `GET /api/reports` (existing, extended) — adds `topicName` to entries, adds `topics[]` to `byEmployee[]` and `byClient[]`, adds per-employee estimated revenue. Single-pass Map aggregation loop.
2. `GET /api/reports/revenue` (new) — queries finalized SDs overlapping date range, computes actual billed totals using canonical billing functions, returns `{ byClient: [{clientId, actualRevenue}] }`. Admin-only.
3. `ReportsContent` (extended) — parallel-fetches both endpoints, merges into unified state, passes revenue data to `OverviewTab`.
4. `OverviewTab` (extended) — adds revenue charts (grouped `BarChart` with estimated + actual bars per client/employee).
5. `ByClientTab` (extended) — adds topic breakdown chart, hours-over-time chart, removes slice limit, adds topic column.
6. `ByEmployeeTab` (extended) — adds topic breakdown chart, removes slice limit, adds topic column.

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for full details, recovery strategies, and a "looks done but isn't" checklist.

1. **Estimated vs. actual revenue numbers will confuse partners** — label both clearly ("Estimated (Rate x Hours)" vs. "Billed (Finalized)"), show "--" or "No finalized bills" when no FINALIZED SDs exist for the period (not 0 EUR), add tooltip explaining why the numbers differ.

2. **Null `topicId` entries will crash aggregation** — old or post-deletion entries can have `topicName = null`. Use `entry.topicName || "Uncategorized"` at every aggregation point without exception.

3. **SD period overlap creates ambiguous revenue attribution** — use `periodEnd` as the attribution date (accounting convention: the bill "lands" at period end). Document this rule. A SD covering Jan 15 - Feb 15 is counted in February only.

4. **Entry tables need pagination before removing the 10-entry limit** — a monthly report for one employee can be 400+ rows; for a wide date range, 1000+. Add simple pagination (50-100 per page) when removing the slice. `React.memo()` on the table component to prevent parent re-renders.

5. **INTERNAL/MANAGEMENT clients must be excluded from revenue** — these clients have `hourlyRate = null`. They must not appear in revenue charts at all (not as 0 EUR), since non-billable work would distort revenue-per-client views.

## Implications for Roadmap

Based on the dependency graph in ARCHITECTURE.md and the pitfall-to-phase mapping in PITFALLS.md:

### Phase 1: Data Layer Foundations
**Rationale:** Every downstream feature depends on topic data flowing through the API. This must come first. The two sub-tasks (topic data extension and revenue endpoint) are independent and can be built in parallel.
**Delivers:** Extended API contracts that all UI phases consume. No visible UI changes.
**Addresses:** Topic column feature (data prerequisite), all topic breakdown features (data prerequisite), actual billed revenue (revenue endpoint).
**Avoids:** Building UI on incomplete data contracts; having to retrofit topic aggregation after charts exist.

Sub-tasks:
- 1a: Add `topicName` to entries, add `topics[]` to `byEmployee[]`/`byClient[]`, add per-employee estimated revenue to existing `GET /api/reports`
- 1b: Create `GET /api/reports/revenue` (new file, admin-only, finalized SD query, canonical billing functions)

### Phase 2: Client Data Integration
**Rationale:** `ReportsContent` must be updated to fetch and merge revenue data before any revenue-dependent UI can render. Depends on Phase 1 (both endpoints must exist).
**Delivers:** Revenue data flows from server to client; `ReportsContent` stores it in state and passes to `OverviewTab`.
**Implements:** Parallel fetch pattern (Pattern 2 from ARCHITECTURE.md), `initialRevenueData` prop from server component.
**Avoids:** Anti-Pattern 2 (computing revenue client-side — `billing-pdf.tsx` imports server-only modules).

### Phase 3: UI — Overview Tab Revenue Charts
**Rationale:** Revenue charts are the highest-value visible addition. They depend on Phase 2 (merged state).
**Delivers:** "Revenue by Client" and "Revenue by Employee" grouped bar charts in the overview tab, showing estimated and actual billed revenue side by side.
**Uses:** Recharts `BarChart` with two `Bar` children (grouped pattern), custom `RevenueTooltip`.
**Avoids:** Pitfall 1 (estimated vs. actual confusion) — requires careful labeling, empty-state handling, and tooltip explanation before shipping.

### Phase 4: UI — Client Drill-Down Enhancements
**Rationale:** Three independent UI additions to the client drill-down, all depending on Phase 1a data.
**Delivers:** Topic breakdown chart (horizontal bar), hours-over-time trend chart, full entry table with topic column.
**Addresses:** Topic breakdown in client drill-down, hours over time trend, all entries in tables, topic column in tables.
**Avoids:** Pitfall 4 (entry table performance) — pagination with `React.memo()` must be added when removing the 10-entry limit.

### Phase 5: UI — Employee Drill-Down Enhancements
**Rationale:** Parallel to Phase 4 but for the employee drill-down. Can be developed concurrently with Phase 4.
**Delivers:** Topic breakdown chart, full entry table with topic column (hours-by-day trend already exists).
**Addresses:** Topic breakdown in employee drill-down, all entries in tables, topic column in tables.
**Avoids:** Same entry table pagination pitfall as Phase 4.

### Phase Ordering Rationale

- Phases 1a and 1b are parallel (different data sources, no shared code).
- Phase 2 blocks Phase 3 (revenue state must exist before revenue charts).
- Phases 4 and 5 both depend on Phase 1a but not on Phases 2-3. They can start immediately after Phase 1a.
- Phase 3 is listed before 4/5 because it has a longer dependency chain, but in practice Phases 3, 4, and 5 can all proceed in parallel after Phases 1 and 2.
- Actual billed revenue (Phase 3) is the highest-risk feature. Validating that partners find estimated revenue charts useful before adding actual revenue is the recommended approach — this makes P2 features a follow-on after Phase 3 ships.

### Research Flags

Phases requiring deeper research during task planning:
- **Phase 1b (revenue endpoint):** The interaction between `calculateGrandTotal` / `calculateRetainerGrandTotal` and the serialized SD data shape needs validation against the existing billing list API pattern. The `serializeDecimal` step must be handled correctly.
- **Phase 3 (revenue charts):** The empty-state UX for periods with no finalized SDs needs a design decision before implementation begins — "No finalized bills" vs. "--" vs. hiding the actual column entirely.

Phases with standard patterns (can skip research-phase):
- **Phase 1a (topic data):** Straightforward extension of the existing single-pass aggregation loop. Pattern is fully documented in ARCHITECTURE.md with code examples.
- **Phase 4/5 (drill-down UI):** Recharts patterns are well-documented. Chart components already exist in the codebase. Pagination is a standard pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified installed versions via `npm ls`, latest via `npm view`. All rejections based on direct codebase inspection. |
| Features | MEDIUM | Competitor analysis from marketing pages (some blocked, used search snippets). Direct codebase review is HIGH confidence. No user testing data available. |
| Architecture | HIGH | Based on direct inspection of all relevant source files. Patterns verified against existing code. Build dependency graph confirmed against feature dependencies. |
| Pitfalls | HIGH | Grounded in direct codebase analysis (identified specific line numbers for existing issues) plus cross-referenced with CONCERNS.md. |

**Overall confidence:** HIGH

### Gaps to Address

- **Revenue empty-state UX:** The decision on how to display "no finalized SDs" needs to be made before Phase 3 implementation. Options: hide actual column, show "--", show "No finalized bills" badge. No user preference data available — recommend asking the partner before building.
- **SD period attribution rule:** Research recommends using `periodEnd` as attribution date, but this has not been confirmed with the firm. If partners expect a different convention (e.g., `periodStart`), all revenue queries must be updated. Validate before Phase 1b implementation.
- **Topic grouping threshold:** For the topic breakdown charts, PITFALLS.md recommends grouping topics below a threshold into "Other" (like `DonutChart`'s `maxSlices`). The threshold value (8-10 topics shown) should be confirmed — it affects chart readability.
- **Pagination page size:** PITFALLS.md recommends 50-100 entries per page for drill-down tables. The exact page size preference should be confirmed before building the pagination component.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `app/src/app/api/reports/route.ts`, `reports/page.tsx`, `ReportsContent.tsx`, `ByClientTab.tsx`, `ByEmployeeTab.tsx`, `OverviewTab.tsx`, `lib/billing-pdf.tsx`, `lib/schema.ts`, `app/src/app/api/billing/route.ts`
- [Recharts BarChart API](https://recharts.github.io/en-US/api/BarChart/) — grouped bars, barGap, barCategoryGap
- [Recharts AreaChart API](https://recharts.github.io/en-US/api/AreaChart/) — area chart for time trends
- [Recharts Custom Tooltip API](https://recharts.github.io/en-US/api/Tooltip/) — custom content prop
- [Drizzle ORM Select Docs](https://orm.drizzle.team/docs/select) — groupBy, sum, count, having
- npm registry — recharts@3.7.0, drizzle-orm@0.45.1 verified current

### Secondary (MEDIUM confidence)
- [Clio Financial Reporting](https://www.clio.com/features/law-firm-financial-reporting/) — competitor feature set
- [Clio 62 Essential KPIs](https://www.clio.com/blog/law-firm-kpis/) — industry benchmarks (38% utilization, 88% realization)
- [MyCase Financial Dashboard](https://www.mycase.com/blog/law-firm-financial-management/financial-dashboard/) — competitor dashboard features
- [BigHand Revenue Metrics](https://www.bighand.com/en-us/resources/blog/five-revenue-metrics-all-law-firm-leaders-need-to-know-and-track/) — revenue metric definitions
- [Law Firm Financial Dashboards](https://www.lawfirmvelocity.com/post/financial-dashboard) — best practices

### Tertiary (LOW confidence)
- [Smokeball Reporting](https://www.smokeball.com/features/legal-reporting-software) — limited detail from search snippets
- [Rocket Matter Key Reports](https://www.rocketmatter.com/blog/six-key-reports-for-better-law-practice-management/) — limited detail
- [Grouped Stacked Bar Charts with Recharts](https://spin.atomicobject.com/stacked-bar-charts-recharts/) — blog post matching official API

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
