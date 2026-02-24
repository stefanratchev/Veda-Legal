# Requirements: Veda Legal Timesheets — Reports Improvements

**Defined:** 2026-02-24
**Core Value:** Partners and admins can quickly understand firm performance — revenue, hours, and work distribution — from the reports page.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Overview Revenue

- [ ] **REV-01**: Admin/Partner can see a Revenue by Client bar chart in the overview tab showing `hourlyRate × hours` per client
- [ ] **REV-02**: Admin/Partner can see a Revenue by Employee bar chart in the overview tab showing proportional revenue per employee (based on hours worked on each client × that client's rate)

### Client Drill-Down

- [ ] **CDR-01**: When drilling into a client, a topic breakdown summary shows hours per topic at the top
- [ ] **CDR-02**: When drilling into a client, an hours-over-time trend chart shows daily activity for the selected period
- [ ] **CDR-03**: When drilling into a client, the entry table shows ALL entries for the selected date range (not just last 10)
- [ ] **CDR-04**: The client drill-down entry table includes a topic column

### Employee Drill-Down

- [ ] **EDR-01**: When drilling into an employee, a topic breakdown shows hours per topic across all clients
- [ ] **EDR-02**: When drilling into an employee, the entry table shows ALL entries for the selected date range (not just last 10)
- [ ] **EDR-03**: The employee drill-down entry table includes a topic column

### Data Layer

- [ ] **DAT-01**: Reports API includes topic data (topicName) in its response for entries and aggregations
- [ ] **DAT-02**: Reports API includes per-client revenue (hourlyRate × hours) in its response
- [ ] **DAT-03**: Reports API includes per-employee revenue (proportional by hours worked on each client) in its response

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Export

- **EXP-01**: Admin can export reports as CSV
- **EXP-02**: Admin can export reports as PDF

### Advanced Metrics

- **MET-01**: Reports show utilization percentage (billable vs non-billable hours)
- **MET-02**: Reports show realization rate (actual billed vs estimated revenue)

### Filtering

- **FLT-01**: Reports can be filtered by topic/subtopic

## Out of Scope

| Feature | Reason |
|---------|--------|
| Actual billed revenue from service descriptions | User decided to keep reporting simple — rate × hours only |
| Custom report builder | Anti-feature for a 10-person firm — negative ROI |
| Mobile-specific report layouts | Not requested |
| Non-admin revenue visibility | Current access control stays as-is |
| Revenue in drill-down views | User chose hours and activity patterns for drill-downs |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DAT-01 | Phase 1 | Pending |
| DAT-02 | Phase 1 | Pending |
| DAT-03 | Phase 1 | Pending |
| REV-01 | Phase 2 | Pending |
| REV-02 | Phase 2 | Pending |
| CDR-01 | Phase 3 | Pending |
| CDR-02 | Phase 3 | Pending |
| CDR-03 | Phase 3 | Pending |
| CDR-04 | Phase 3 | Pending |
| EDR-01 | Phase 4 | Pending |
| EDR-02 | Phase 4 | Pending |
| EDR-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after roadmap creation*
