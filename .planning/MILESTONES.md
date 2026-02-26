# Milestones

## v1.0 Reports Improvements (Shipped: 2026-02-24)

**Phases completed:** 4 phases, 10 plans, 0 tasks

**Key accomplishments:**
- Reports API extended with topic aggregations and per-client/per-employee revenue (rate x hours)
- Revenue by Client and Revenue by Employee horizontal bar charts added to overview tab (admin-gated, with comparison % badges)
- Client drill-down enhanced with topic breakdown chart, side-by-side layout, and full DataTable with topic column
- Employee drill-down enhanced with cross-client topic breakdown chart and full DataTable with topic column
- 965-test suite with zero regressions across 46 test files
- Polish: top-15 grouping with "Other", truncated Y-axis labels, increased chart heights

---


## v1.1 E2E Timesheets (Shipped: 2026-02-25)

**Phases completed:** 3 phases (5-7), 6 plans, 15 tasks
**Timeline:** 2026-02-25 (single day)
**Git range:** `b42a426..d4eed0a` (30 commits, +4,623/-75 lines across 45 files)

**Key accomplishments:**
- JWT cookie auth bypass for Playwright e2e tests — zero production auth code changes
- 15 e2e tests across 4 spec files covering entry CRUD, date navigation, and daily submission
- TimesheetsPage Page Object Model (23 methods) encapsulating all dropdown and navigation interactions
- GitHub Actions CI job running Playwright against PostgreSQL 17 + production build on every PR
- Chromium browser caching and HTML report artifact upload for CI debugging

---


## v1.2 Reports Detail View (Shipped: 2026-02-26)

**Phases completed:** 4 phases (8-11), 7 plans
**Timeline:** 2026-02-25 → 2026-02-26
**Git range:** `6dcb16f..48ff4ac` (32 commits, +6,156/-81 lines across 41 files)

**Key accomplishments:**
- Extended ReportEntry with subtopicName and per-entry revenue (server-computed, admin-gated)
- Built pure filter & aggregation utilities (filterEntries, aggregateBy*) with "empty Set = show all" convention
- Created reusable MultiSelectFilter component with search, checkboxes, keyboard nav, and active indicators
- Assembled Detail tab with FilterBar and six paired charts (Hours + Revenue by Client/Employee/Topic)
- Added entry table with 7 columns, sorting, pagination (50/page), and admin-only revenue column
- Implemented summary stats row and chart bar click-to-filter interaction with visual dimming
- 94 new tests (1059 total), zero regressions

---

