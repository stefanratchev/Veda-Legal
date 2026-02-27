# Roadmap: Veda Legal Timesheets

## Milestones

- ✅ **v1.0 Reports Improvements** — Phases 1-4 (shipped 2026-02-24)
- ✅ **v1.1 E2E Timesheets** — Phases 5-7 (shipped 2026-02-25)
- ✅ **v1.2 Reports Detail View** — Phases 8-11 (shipped 2026-02-26)
- **v1.3 Billing Tabs** — Phases 12-13 (in progress)

## Phases

<details>
<summary>v1.0 Reports Improvements (Phases 1-4) -- SHIPPED 2026-02-24</summary>

- [x] Phase 1: Data Layer (2/2 plans) -- completed 2026-02-24
- [x] Phase 2: Overview Revenue Charts (2/2 plans) -- completed 2026-02-24
- [x] Phase 3: Client Drill-Down Enhancements (3/3 plans) -- completed 2026-02-24
- [x] Phase 4: Employee Drill-Down Enhancements (3/3 plans) -- completed 2026-02-24

See: [milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>v1.1 E2E Timesheets (Phases 5-7) -- SHIPPED 2026-02-25</summary>

- [x] Phase 5: Test Infrastructure (2/2 plans) -- completed 2026-02-25
- [x] Phase 6: Core Timesheet Workflow Tests (3/3 plans) -- completed 2026-02-25
- [x] Phase 7: CI Integration (1/1 plan) -- completed 2026-02-25

See: [milestones/v1.1-ROADMAP.md](./milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>v1.2 Reports Detail View (Phases 8-11) -- SHIPPED 2026-02-26</summary>

- [x] Phase 8: Data Layer Foundation (2/2 plans) -- completed 2026-02-25
- [x] Phase 9: Filter Component (2/2 plans) -- completed 2026-02-25
- [x] Phase 10: Detail Tab Assembly (2/2 plans) -- completed 2026-02-25
- [x] Phase 11: Polish & Interactivity (1/1 plan) -- completed 2026-02-26

See: [milestones/v1.2-ROADMAP.md](./milestones/v1.2-ROADMAP.md)

</details>

### v1.3 Billing Tabs (In Progress)

**Milestone Goal:** Split the billing page into tabbed sections with date range filtering for service descriptions.

- [x] **Phase 12: Tab Navigation** - Refactor billing page into two tabs with URL-persisted state (completed 2026-02-27)
- [x] **Phase 13: Date Range Filtering** - Add date range picker with server-side filtering to Service Descriptions tab (completed 2026-02-27)

## Phase Details

### Phase 12: Tab Navigation
**Goal**: Users navigate billing workflows through distinct tabs instead of a single monolithic page
**Depends on**: Nothing (first phase in milestone)
**Requirements**: TABS-01, TABS-02, TABS-03, TABS-04, TABS-05
**Success Criteria** (what must be TRUE):
  1. User sees a tab bar on the billing page with "Ready to Bill" and "Service Descriptions" tabs
  2. Clicking "Ready to Bill" shows the unbilled clients grid with create/continue actions
  3. Clicking "Service Descriptions" shows the SD table with status filter and search
  4. Navigating directly to `?tab=service-descriptions` opens that tab; no query param defaults to Ready to Bill
  5. Tab state survives page refresh (URL is the source of truth)
**Plans**: 1 plan

Plans:
- [ ] 12-01-PLAN.md — Refactor BillingContent into tabbed layout with URL-persisted tab state + tests

### Phase 13: Date Range Filtering
**Goal**: Users can scope the Service Descriptions tab to a specific time period
**Depends on**: Phase 12 (requires Service Descriptions tab to exist)
**Requirements**: FILT-01, FILT-02, FILT-03, FILT-04
**Success Criteria** (what must be TRUE):
  1. Service Descriptions tab displays a date range picker with This Month, Last Month, and custom range presets
  2. Opening the Service Descriptions tab defaults to This Month date range
  3. Changing the date range fetches only matching service descriptions from the server (not client-side filtering)
  4. Status filter (All/Draft/Finalized) and date range filter work together -- both constraints apply simultaneously
**Plans**: 1 plan

Plans:
- [ ] 13-01-PLAN.md — DateRangePicker component + API date range params + BillingContent integration + tests

## Progress

**Execution Order:**
Phases execute in numeric order: 12 -> 13

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
| 11. Polish & Interactivity | v1.2 | 1/1 | Complete | 2026-02-26 |
| 12. Tab Navigation | 1/1 | Complete    | 2026-02-27 | - |
| 13. Date Range Filtering | 1/1 | Complete   | 2026-02-27 | - |
