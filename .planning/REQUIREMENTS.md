# Requirements: Veda Legal Timesheets

**Defined:** 2026-02-26
**Core Value:** Partners and admins can quickly understand firm performance — who worked on what, how much revenue was generated, and where time was spent — without leaving the reports page.

## v1.3 Requirements

Requirements for Billing Tabs milestone. Each maps to roadmap phases.

### Tab Navigation

- [ ] **TABS-01**: User sees a tab bar with "Ready to Bill" and "Service Descriptions" on the billing page
- [ ] **TABS-02**: Ready to Bill tab displays the existing unbilled clients grid with create/continue actions
- [ ] **TABS-03**: Service Descriptions tab displays the existing SD table with status filter and search
- [ ] **TABS-04**: Active tab is persisted in the URL query param (e.g., `?tab=service-descriptions`)
- [ ] **TABS-05**: Ready to Bill is the default tab when no query param is present

### Date Range Filtering

- [ ] **FILT-01**: Service Descriptions tab has a date range picker with This Month, Last Month, and custom range presets
- [ ] **FILT-02**: This Month is the default date range when opening the Service Descriptions tab
- [ ] **FILT-03**: Date range filters service descriptions server-side (only matching SDs are fetched)
- [ ] **FILT-04**: Status filter (All/Draft/Finalized) works alongside the date range filter

## Future Requirements

None identified for this milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Service Descriptions as separate page | Tabs sufficient for current complexity |
| Sub-tabs within Service Descriptions (Draft/Finalized) | Status filter covers this |
| Date range on Ready to Bill tab | Unbilled clients are always current — no historical view needed |
| Billing analytics/dashboard | Not requested |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TABS-01 | — | Pending |
| TABS-02 | — | Pending |
| TABS-03 | — | Pending |
| TABS-04 | — | Pending |
| TABS-05 | — | Pending |
| FILT-01 | — | Pending |
| FILT-02 | — | Pending |
| FILT-03 | — | Pending |
| FILT-04 | — | Pending |

**Coverage:**
- v1.3 requirements: 9 total
- Mapped to phases: 0
- Unmapped: 9 ⚠️

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after initial definition*
