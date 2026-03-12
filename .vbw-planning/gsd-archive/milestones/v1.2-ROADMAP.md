# Roadmap: Veda Legal Timesheets

## Milestones

- ✅ **v1.0 Reports Improvements** — Phases 1-4 (shipped 2026-02-24)
- ✅ **v1.1 E2E Timesheets** — Phases 5-7 (shipped 2026-02-25)
- 🚧 **v1.2 Reports Detail View** — Phases 8-11 (in progress)

## Phases

<details>
<summary>✅ v1.0 Reports Improvements (Phases 1-4) — SHIPPED 2026-02-24</summary>

- [x] Phase 1: Data Layer (2/2 plans) — completed 2026-02-24
- [x] Phase 2: Overview Revenue Charts (2/2 plans) — completed 2026-02-24
- [x] Phase 3: Client Drill-Down Enhancements (3/3 plans) — completed 2026-02-24
- [x] Phase 4: Employee Drill-Down Enhancements (3/3 plans) — completed 2026-02-24

See: [milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 E2E Timesheets (Phases 5-7) — SHIPPED 2026-02-25</summary>

- [x] Phase 5: Test Infrastructure (2/2 plans) — completed 2026-02-25
- [x] Phase 6: Core Timesheet Workflow Tests (3/3 plans) — completed 2026-02-25
- [x] Phase 7: CI Integration (1/1 plan) — completed 2026-02-25

See: [milestones/v1.1-ROADMAP.md](./milestones/v1.1-ROADMAP.md)

</details>

### 🚧 v1.2 Reports Detail View (In Progress)

**Milestone Goal:** Add a Detail tab to Reports with multi-select filters, six paired charts (Hours + Revenue by Client/Employee/Topic), and a full entry table for deep data exploration.

- [x] **Phase 8: Data Layer Foundation** (2/2 plans) - completed 2026-02-25
- [x] **Phase 9: Filter Component** (2/2 plans) - completed 2026-02-25
- [x] **Phase 10: Detail Tab Assembly** (2/2 plans) - completed 2026-02-25
- [x] **Phase 11: Polish & Interactivity** - Summary stats row and chart-click-to-filter interaction (completed 2026-02-26)

## Phase Details

### Phase 8: Data Layer Foundation
**Goal**: All data shapes, aggregation logic, and filter utilities are ready for the Detail tab -- types compile, pure functions pass tests, and the API returns per-entry revenue and subtopic names
**Depends on**: Phase 7 (v1.1 complete)
**Requirements**: None (infrastructure enabling CHRT-01-06, TABL-01-02, FILT-06)
**Success Criteria** (what must be TRUE):
  1. `ReportEntry` type includes `subtopicName` and `revenue` (number | null) fields, and the report-utils query populates them from the database
  2. Per-entry revenue is computed server-side and returned as `null` for non-admin users (no client-side rate exposure)
  3. Pure utility functions (`filterEntries`, `aggregateByClient`, `aggregateByEmployee`, `aggregateByTopic`) exist with full unit test coverage, using "empty Set = show all" convention
  4. All existing report tests still pass after type and query changes (zero regressions)
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md — Extend ReportEntry with subtopicName and per-entry revenue (TDD)
- [x] 08-02-PLAN.md — Filter and aggregation utility functions (TDD)

### Phase 9: Filter Component
**Goal**: Users have a polished, reusable multi-select filter component that supports searching, selecting, and clearing options -- tested in isolation before integration
**Depends on**: Phase 8
**Requirements**: FILT-01, FILT-02, FILT-03, FILT-04, FILT-05
**Success Criteria** (what must be TRUE):
  1. User can open a searchable dropdown, type to narrow options, and select multiple items via checkboxes (FILT-01, FILT-02, FILT-03)
  2. User can clear an individual selection or clear all selections at once (FILT-04)
  3. User sees active filter indicators (pill badges or count) showing which filters are currently applied (FILT-05)
  4. Component works with any option list (clients, employees, topics) via props -- one component, three instances
**Plans**: 2 plans

Plans:
- [x] 09-01-PLAN.md — MultiSelectFilter component with search, checkboxes, keyboard nav, and active indicators (TDD)
- [x] 09-02-PLAN.md — FilterBar wrapper composing three MultiSelectFilter instances with "Clear all" (TDD)

### Phase 10: Detail Tab Assembly
**Goal**: Users can navigate to the Detail tab and explore filtered data through six charts and a full entry table, with all visualizations updating simultaneously when filters change
**Depends on**: Phase 9
**Requirements**: DTAB-01, FILT-06, CHRT-01, CHRT-02, CHRT-03, CHRT-04, CHRT-05, CHRT-06, TABL-01, TABL-02, TABL-03
**Success Criteria** (what must be TRUE):
  1. User can navigate to a "Detail" tab in Reports alongside the existing Overview, By Client, and By Employee tabs (DTAB-01)
  2. User sees Hours by Client, Hours by Employee, and Hours by Topic horizontal bar charts; admins additionally see Revenue by Client, Revenue by Employee, and Revenue by Topic charts (CHRT-01-06)
  3. User sees an entry table with Date, Employee, Client, Topic, Subtopic, Description, Hours columns; admins additionally see a Revenue column (TABL-01, TABL-02)
  4. User can sort and paginate the entry table at 50 entries per page (TABL-03)
  5. All six charts and the entry table update simultaneously when any filter is applied or removed (FILT-06)
**Plans**: 2 plans

Plans:
- [x] 10-01-PLAN.md — DetailTab with FilterBar and six paired charts (TDD)
- [x] 10-02-PLAN.md — Entry table with columns, sorting, pagination, admin revenue (TDD)

### Phase 11: Polish & Interactivity
**Goal**: Users get at-a-glance summary stats and can explore data by clicking chart bars to drive filters, completing the interactive analytics experience
**Depends on**: Phase 10
**Requirements**: DTAB-02, CHRT-07
**Success Criteria** (what must be TRUE):
  1. User sees a summary stats row (entry count, total hours; admins see total revenue) that updates in real-time as filters change (DTAB-02)
  2. User can click a chart bar to toggle that entity as a filter, and clicking again removes it (CHRT-07)
**Plans**: 1 plan

Plans:
- [ ] 11-01-PLAN.md — Summary stats row, chart activeIds visual feedback, and click-to-filter interaction (TDD)

## Progress

**Execution Order:**
Phases execute in numeric order: 8 -> 9 -> 10 -> 11

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Data Layer | v1.0 | 2/2 | Complete | 2026-02-24 |
| 2. Overview Revenue Charts | v1.0 | 2/2 | Complete | 2026-02-24 |
| 3. Client Drill-Down Enhancements | v1.0 | 3/3 | Complete | 2026-02-24 |
| 4. Employee Drill-Down Enhancements | v1.0 | 3/3 | Complete | 2026-02-24 |
| 5. Test Infrastructure | v1.1 | 2/2 | Complete | 2026-02-25 |
| 6. Core Timesheet Workflow Tests | v1.1 | 3/3 | Complete | 2026-02-25 |
| 7. CI Integration | v1.1 | 1/1 | Complete | 2026-02-25 |
| 8. Data Layer Foundation | v1.2 | 2/2 | Complete | 2026-02-25 |
| 9. Filter Component | v1.2 | 2/2 | Complete | 2026-02-25 |
| 10. Detail Tab Assembly | v1.2 | 2/2 | Complete | 2026-02-25 |
| 11. Polish & Interactivity | 1/1 | Complete    | 2026-02-26 | - |
