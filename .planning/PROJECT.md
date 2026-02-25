# Veda Legal Timesheets

## What This Is

A legal practice management app used by ~10 employees and ~200 clients. Features timesheet tracking, billing/invoicing, and reports with revenue visibility and rich drill-downs. Includes browser-level e2e regression protection for the revenue-critical timesheet workflow.

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
- ✓ Playwright e2e test infrastructure with auth bypass — v1.1
- ✓ E2e tests for core timesheet entry workflows (create, edit, delete) — v1.1
- ✓ E2e tests for date navigation via WeekStrip — v1.1
- ✓ E2e tests for daily submission/revoke flow — v1.1
- ✓ CI integration: e2e tests on every PR with PostgreSQL + Chromium caching — v1.1

### Active

(None — define in next milestone)

### Out of Scope

- CSV/PDF export of reports — defer to future milestone
- Utilization % or billable vs non-billable breakdown — not requested
- Filtering reports by topic/subtopic — not requested
- Non-admin revenue visibility changes — current access control stays as-is
- Mobile-specific report layouts — not requested
- Actual billed revenue from service descriptions — user decided rate x hours only
- Revenue in drill-down views — user chose hours and activity patterns for drill-downs
- Hours trend chart in client drill-down — dropped by user decision (CDR-02)
- Admin/billing e2e tests — separate milestone
- Reports e2e tests — Recharts hard to assert on
- Multi-browser e2e testing — internal app, all Chrome
- Visual regression testing — dynamic data + Tailwind = false positives
- Parallel e2e execution — only warranted if >50 tests

## Context

Shipped v1.0 Reports Improvements and v1.1 E2E Timesheets.

**Reports** (v1.0): Overview with summary cards + paired Hours/Revenue charts by Client and Employee. Client and Employee drill-downs with topic breakdowns, side-by-side charts, and full entry DataTables. 965 unit tests across 46 files.

**E2E Testing** (v1.1): 15 Playwright e2e tests covering entry CRUD, date navigation, and daily submission. JWT cookie auth bypass (zero production changes). CI integration running on every PR with PostgreSQL 17, Chromium caching, and HTML report artifacts.

Tech stack: Next.js 16, Recharts, Drizzle ORM, PostgreSQL, Tailwind CSS v4, Playwright.

## Constraints

- **Tech stack**: Next.js 16 + Recharts 3.6.0 + Drizzle ORM + Playwright for e2e
- **Access control**: Revenue data must remain admin/partner only
- **Performance**: Reports API returns all data in one call — must stay fast for ~200 clients
- **Currency**: Euros (EUR)
- **E2e**: Chromium-only, serial execution — multi-browser and parallel deferred

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
| Full e2e suite over lighter alternatives | User decision — browser-level confidence for revenue-critical workflow | ✓ Good |
| Auth bypass via JWT cookie injection | Skip Azure AD SSO in test env — zero production code changes | ✓ Good |
| Hardcoded deterministic seed data IDs | global-setup and test specs run in separate processes | ✓ Good |
| drizzle-kit push --force for CI schema | Broken Prisma-to-Drizzle migration chain in legacy migrations | ✓ Good |
| POM with portal-aware locators | DurationPicker renders via createPortal at body level | ✓ Good |

---
*Last updated: 2026-02-25 after v1.1 milestone*
