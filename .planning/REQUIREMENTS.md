# Requirements: Veda Legal Timesheets

**Defined:** 2026-02-25
**Core Value:** Partners and admins can quickly understand firm performance — revenue, hours, and work distribution — from the reports page.

## v1.2 Requirements

Requirements for Reports Detail View milestone. Each maps to roadmap phases.

### Detail Tab

- [ ] **DTAB-01**: User can navigate to a Detail tab in Reports alongside Overview, By Client, By Employee
- [ ] **DTAB-02**: User sees summary stats row (entry count, total hours, total revenue for admins) that updates with filters

### Filters

- [x] **FILT-01**: User can filter by multiple clients using a searchable multi-select dropdown
- [x] **FILT-02**: User can filter by multiple employees using a searchable multi-select dropdown
- [x] **FILT-03**: User can filter by multiple topics using a searchable multi-select dropdown
- [ ] **FILT-04**: User can clear an individual filter or all filters at once
- [x] **FILT-05**: User sees active filter indicators showing which filters are applied
- [ ] **FILT-06**: All charts and the entry table update simultaneously when any filter changes

### Charts

- [ ] **CHRT-01**: User sees Hours by Client horizontal bar chart
- [ ] **CHRT-02**: User sees Hours by Employee horizontal bar chart
- [ ] **CHRT-03**: User sees Hours by Topic horizontal bar chart
- [ ] **CHRT-04**: Admin sees Revenue by Client horizontal bar chart
- [ ] **CHRT-05**: Admin sees Revenue by Employee horizontal bar chart
- [ ] **CHRT-06**: Admin sees Revenue by Topic horizontal bar chart
- [ ] **CHRT-07**: User can click a chart bar to toggle that entity as a filter

### Entry Table

- [ ] **TABL-01**: User sees entry table with Date, Employee, Client, Topic, Subtopic, Description, Hours columns
- [ ] **TABL-02**: Admin sees Revenue column in the entry table
- [ ] **TABL-03**: User can sort and paginate the entry table (50 per page)

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Export

- **EXPORT-01**: User can export filtered results as CSV
- **EXPORT-02**: User can export filtered results as PDF

### Advanced Filtering

- **FILT-07**: User can filter by subtopic within a topic
- **FILT-08**: User can save filter presets for quick access
- **FILT-09**: Filter state is reflected in URL for shareable links

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Subtopic-level filtering | Too many subtopics (~50-100), confusing UX; topic filtering sufficient for analytics |
| Server-side filtering | Data volume trivially small (~2000 entries/month); client-side filtering is instant |
| Dual-axis charts | Explicit v1.0 decision — separate charts for different scales |
| Drag-and-drop chart arrangement | 10 users, fixed layout is optimal |
| Saved filter presets | Low ROI for 10 users |
| Real-time filter preview (count before apply) | Filters apply immediately; no "apply" step |
| CSV/PDF export | Deferred to future milestone per PROJECT.md |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DTAB-01 | Phase 10 | Pending |
| DTAB-02 | Phase 11 | Pending |
| FILT-01 | Phase 9 | Complete |
| FILT-02 | Phase 9 | Complete |
| FILT-03 | Phase 9 | Complete |
| FILT-04 | Phase 9 | Pending |
| FILT-05 | Phase 9 | Complete |
| FILT-06 | Phase 10 | Pending |
| CHRT-01 | Phase 10 | Pending |
| CHRT-02 | Phase 10 | Pending |
| CHRT-03 | Phase 10 | Pending |
| CHRT-04 | Phase 10 | Pending |
| CHRT-05 | Phase 10 | Pending |
| CHRT-06 | Phase 10 | Pending |
| CHRT-07 | Phase 11 | Pending |
| TABL-01 | Phase 10 | Pending |
| TABL-02 | Phase 10 | Pending |
| TABL-03 | Phase 10 | Pending |

**Coverage:**
- v1.2 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation*
