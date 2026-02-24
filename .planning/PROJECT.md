# Veda Legal Timesheets — Reports Improvements

## What This Is

A legal practice management app used by ~10 employees and ~200 clients. This milestone focuses on improving the Reports section — adding revenue visibility to the overview, richer drill-down views for clients and employees, and showing complete time entry data for selected periods.

## Core Value

Partners and admins can quickly understand firm performance — who worked on what, how much revenue was generated, and where time was spent — without leaving the reports page.

## Requirements

### Validated

<!-- Existing capabilities confirmed working in current codebase. -->

- ✓ Time entry logging with client, topic, subtopic, hours, description — existing
- ✓ Reports overview with Total Hours, Total Revenue, Active Clients summary cards — existing
- ✓ Hours by Employee bar chart in overview — existing
- ✓ Hours by Client donut chart in overview — existing
- ✓ Date range picker with presets (This Month, Last Month, custom) — existing
- ✓ Comparison picker (Previous Period, Previous Year) with % change — existing
- ✓ By Employee tab with drill-down (hours by client, hours by day charts) — existing
- ✓ By Client tab with drill-down (hours by employee chart) — existing
- ✓ Admin/non-admin access control on revenue data — existing
- ✓ Billing system with service descriptions, line items, discounts, waivers, retainers — existing
- ✓ Client hourly rates stored on client records — existing

### Active

<!-- Current scope for this milestone. -->

- [ ] Revenue by Client chart in overview (estimated: rate × hours, and actual: from finalized service descriptions)
- [ ] Revenue by Employee chart in overview (estimated: rate × hours, and actual: from finalized service descriptions)
- [ ] Client drill-down: topic breakdown summary at the top (hours per topic)
- [ ] Client drill-down: hours by employee chart (keep existing)
- [ ] Client drill-down: hours over time trend chart
- [ ] Employee drill-down: hours by client chart (keep existing)
- [ ] Employee drill-down: hours over time trend chart (keep existing)
- [ ] Employee drill-down: topic breakdown across clients
- [ ] Drill-down entry tables show ALL entries for selected date range (not just last 10)
- [ ] Entry tables include topic column

### Out of Scope

- CSV/PDF export of reports — defer to future milestone
- Utilization % or billable vs non-billable breakdown — not requested
- Filtering reports by topic/subtopic — not requested
- Non-admin revenue visibility changes — current access control stays as-is
- Mobile-specific report layouts — not requested

## Context

**Existing reports architecture:**
- Server Component (`reports/page.tsx`) fetches current + comparison period data via Drizzle, passes to `ReportsContent` client component
- Client component manages tab state, date range, comparison, and drill-down selection
- Single API endpoint `GET /api/reports?startDate=&endDate=` returns all data (summary, byEmployee, byClient, entries)
- Charts use Recharts 3.6.0 with dark theme styling via CSS variables
- Revenue currently calculated as `hours × client.hourlyRate` only — no integration with finalized service descriptions

**New revenue data source:**
- Service descriptions (DRAFT → FINALIZED) contain actual billed amounts including discounts, caps, waivers, and retainer logic
- Billing calculations centralized in `lib/billing-pdf.tsx` — `calculateGrandTotal()`, `calculateRetainerGrandTotal()`
- Need to query finalized SDs for the selected period to get "actual billed" revenue alongside the existing "estimated" calculation

**Drill-down rethink:**
- Current employee drill-down: Hours by Client (bar) + Hours by Day (bar) + last 10 entries table
- Current client drill-down: Hours by Employee (bar) + last 10 entries table
- Both need richer top sections with topic breakdowns and time trends
- Entry tables need to show all entries for the period with a topic column added

## Constraints

- **Tech stack**: Next.js 16 + Recharts 3.6.0 + Drizzle ORM — no new dependencies needed
- **Access control**: Revenue data (both estimated and actual) must remain admin/partner only
- **Performance**: Reports API already returns all data in one call — adding topic and SD data must not make this unacceptably slow for ~200 clients
- **Currency**: Euros (EUR) — `formatCurrency()` in `billing-pdf.tsx`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate revenue charts (not merged with hours charts) | Revenue and hours have different scales; separate charts avoid confusing dual-axis layouts | — Pending |
| Both estimated and actual billed revenue | Estimated (rate × hours) is always available; actual (from SDs) only exists for finalized periods — showing both gives complete picture | — Pending |
| No revenue in drill-downs | User chose hours and activity patterns for drill-downs; revenue stays at overview level | — Pending |
| All entries in drill-down tables | Last-10 limit was too restrictive for real analysis; full period data needed | — Pending |

---
*Last updated: 2026-02-24 after initialization*
