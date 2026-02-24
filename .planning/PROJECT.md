# Veda Legal Timesheets

## What This Is

A legal practice management app used by ~10 employees and ~200 clients. Features timesheet tracking, billing/invoicing, and reports with revenue visibility and rich drill-downs.

## Core Value

Partners and admins can quickly understand firm performance — who worked on what, how much revenue was generated, and where time was spent — without leaving the reports page.

## Requirements

### Validated

- ✓ Time entry logging with client, topic, subtopic, hours, description — existing
- ✓ Reports overview with Total Hours, Total Revenue, Active Clients summary cards — existing
- ✓ Hours by Employee bar chart in overview — existing
- ✓ Hours by Client bar chart in overview — existing (upgraded from donut to horizontal bar in v1.0)
- ✓ Date range picker with presets (This Month, Last Month, custom) — existing
- ✓ Comparison picker (Previous Period, Previous Year) with % change — existing
- ✓ Admin/non-admin access control on revenue data — existing
- ✓ Billing system with service descriptions, line items, discounts, waivers, retainers — existing
- ✓ Client hourly rates stored on client records — existing
- ✓ Revenue by Client chart in overview (rate x hours) — v1.0
- ✓ Revenue by Employee chart in overview (proportional) — v1.0
- ✓ Client drill-down: topic breakdown summary — v1.0
- ✓ Employee drill-down: topic breakdown across clients — v1.0
- ✓ Drill-down entry tables show ALL entries with pagination — v1.0
- ✓ Entry tables include topic column — v1.0
- ✓ Reports API includes topic and revenue data — v1.0

### Active

(No active requirements — define with `/gsd:new-milestone`)

### Out of Scope

- CSV/PDF export of reports — defer to future milestone
- Utilization % or billable vs non-billable breakdown — not requested
- Filtering reports by topic/subtopic — not requested
- Non-admin revenue visibility changes — current access control stays as-is
- Mobile-specific report layouts — not requested
- Actual billed revenue from service descriptions — user decided rate x hours only
- Revenue in drill-down views — user chose hours and activity patterns for drill-downs
- Hours trend chart in client drill-down — dropped by user decision (CDR-02)

## Context

Shipped v1.0 Reports Improvements. Reports section now has:
- Overview: summary cards + paired rows of Hours/Revenue charts by Client and Employee
- Client drill-down: topic breakdown + hours by employee (side-by-side) + full entry DataTable
- Employee drill-down: topic breakdown + hours by client (side-by-side) + full entry DataTable
- 965 tests across 46 files, all passing

Tech stack: Next.js 16, Recharts, Drizzle ORM, PostgreSQL, Tailwind CSS v4.

## Constraints

- **Tech stack**: Next.js 16 + Recharts 3.6.0 + Drizzle ORM — no new dependencies needed
- **Access control**: Revenue data must remain admin/partner only
- **Performance**: Reports API returns all data in one call — must stay fast for ~200 clients
- **Currency**: Euros (EUR)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate revenue charts (not dual-axis) | Different scales; avoid confusing layouts | ✓ Good |
| Revenue = rate x hours only (no SD integration) | Keep reporting simple for this milestone | ✓ Good |
| No revenue in drill-downs | Hours and activity patterns sufficient for drill-downs | ✓ Good |
| All entries in drill-down tables (DataTable, 50/page) | Last-10 limit too restrictive for analysis | ✓ Good |
| Horizontal bars for all charts | Better scalability with many items | ✓ Good |
| Teal #4ECDC4 as revenue accent color | Distinct from coral pink hours | ✓ Good |
| CDR-02 hours trend chart dropped | User decision — not needed | ✓ Good |
| Top-15 with "Other" grouping | Prevents chart overflow with many clients | ✓ Good |

---
*Last updated: 2026-02-24 after v1.0 milestone*
