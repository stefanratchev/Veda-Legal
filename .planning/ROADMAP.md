# Roadmap: Reports Improvements

## Overview

This milestone enriches the existing Reports section with revenue visibility and richer drill-downs. The work flows from data layer (extend the API with topic and revenue aggregations) through overview UI (revenue charts) to drill-down UI (topic breakdowns, time trends, and full entry tables). Revenue is calculated as `hourlyRate x hours` only -- no service description integration.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Layer** - Extend reports API with topic aggregations and revenue calculations
- [ ] **Phase 2: Overview Revenue Charts** - Add Revenue by Client and Revenue by Employee charts to the overview tab
- [ ] **Phase 3: Client Drill-Down Enhancements** - Add topic breakdown, hours trend, full entry table with topic column to client drill-down
- [ ] **Phase 4: Employee Drill-Down Enhancements** - Add cross-client topic breakdown, full entry table with topic column to employee drill-down

## Phase Details

### Phase 1: Data Layer
**Goal**: The reports API returns topic and revenue data so all downstream UI phases have the data they need
**Depends on**: Nothing (first phase)
**Requirements**: DAT-01, DAT-02, DAT-03
**Success Criteria** (what must be TRUE):
  1. API response includes `topicName` on every entry in the entries array (null topics resolve to "Uncategorized")
  2. API response includes a `topics` array (with hours per topic) inside each `byClient` and `byEmployee` item
  3. API response includes `revenue` (hourlyRate x hours) on each `byClient` item
  4. API response includes `revenue` (proportional: employee hours on client x client rate, summed across clients) on each `byEmployee` item
  5. INTERNAL/MANAGEMENT clients have `revenue: 0` and are excluded from revenue-related aggregations
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Overview Revenue Charts
**Goal**: Partners and admins can see revenue distribution across clients and employees directly in the overview tab
**Depends on**: Phase 1
**Requirements**: REV-01, REV-02
**Success Criteria** (what must be TRUE):
  1. A "Revenue by Client" bar chart appears in the overview tab showing EUR revenue per client (rate x hours), visible only to Admin/Partner users
  2. A "Revenue by Employee" bar chart appears in the overview tab showing proportional EUR revenue per employee, visible only to Admin/Partner users
  3. Revenue charts are separate from the existing hours charts (not dual-axis)
  4. Revenue charts respect the selected date range and comparison period (showing % change when comparison is active)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Client Drill-Down Enhancements
**Goal**: When drilling into a client, admins can see what topics work was spent on, how hours trended over time, and browse all entries for the period
**Depends on**: Phase 1
**Requirements**: CDR-01, CDR-02, CDR-03, CDR-04
**Success Criteria** (what must be TRUE):
  1. Client drill-down shows a topic breakdown summary (hours per topic) at the top of the detail view
  2. Client drill-down shows an hours-over-time trend chart for the selected date range
  3. Client drill-down entry table shows ALL entries for the selected date range (not limited to 10), with pagination if the list exceeds ~50 entries
  4. Client drill-down entry table includes a topic column showing the topic name for each entry
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Employee Drill-Down Enhancements
**Goal**: When drilling into an employee, admins can see their topic distribution across all clients and browse all entries for the period
**Depends on**: Phase 1
**Requirements**: EDR-01, EDR-02, EDR-03
**Success Criteria** (what must be TRUE):
  1. Employee drill-down shows a topic breakdown chart showing hours per topic across all clients the employee worked on
  2. Employee drill-down entry table shows ALL entries for the selected date range (not limited to 10), with pagination if the list exceeds ~50 entries
  3. Employee drill-down entry table includes a topic column showing the topic name for each entry
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4
Note: Phases 3 and 4 both depend on Phase 1 only (not on each other or Phase 2). They could execute in parallel after Phase 1, but are sequenced for simplicity.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Layer | 0/? | Not started | - |
| 2. Overview Revenue Charts | 0/? | Not started | - |
| 3. Client Drill-Down Enhancements | 0/? | Not started | - |
| 4. Employee Drill-Down Enhancements | 0/? | Not started | - |
