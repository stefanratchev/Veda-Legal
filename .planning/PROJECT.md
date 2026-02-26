# Veda Legal Timesheets

## What This Is

A legal practice management app used by ~10 employees and ~200 clients. Features timesheet tracking, billing/invoicing, and reports with revenue visibility, rich drill-downs, and a Detail analytics tab with multi-select filters, paired charts, and a full entry table. Includes browser-level e2e regression protection for the revenue-critical timesheet workflow.

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
- ✓ Detail tab in Reports with Hours & Revenue charts by Client, Employee, and Topic — v1.2
- ✓ Multi-select filters (Client, Employee, Topic) that update charts and entry table simultaneously — v1.2
- ✓ Full entry table with Date, Employee, Client, Topic, Subtopic, Description, Hours, Revenue (admin) — v1.2
- ✓ Summary stats row (entry count, total hours, admin revenue) updating with filters — v1.2
- ✓ Chart bar click-to-filter interaction with visual dimming — v1.2

### Active

## Current Milestone: v1.3 Billing Tabs

**Goal:** Split the billing page into tabbed sections with date range filtering for service descriptions.

**Target features:**
- Tab-based billing page (Ready to Bill / Service Descriptions)
- Date range picker on Service Descriptions tab (This Month default, Last Month, custom)
- Status filter preserved alongside date range

### Out of Scope

- CSV/PDF export of reports — defer to future milestone
- Utilization % or billable vs non-billable breakdown — not requested
- Filtering reports by subtopic — top-level topic filtering added in v1.2, subtopic filtering deferred
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
- Server-side report filtering — data volume trivially small (~2000 entries/month)
- Dual-axis charts — separate charts for different scales (v1.0 decision)

## Context

Shipped v1.0 Reports Improvements, v1.1 E2E Timesheets, v1.2 Reports Detail View, and starting v1.3 Billing Tabs.

**Reports** (v1.0): Overview with summary cards + paired Hours/Revenue charts by Client and Employee. Client and Employee drill-downs with topic breakdowns, side-by-side charts, and full entry DataTables.

**E2E Testing** (v1.1): 15 Playwright e2e tests covering entry CRUD, date navigation, and daily submission. JWT cookie auth bypass (zero production changes). CI integration running on every PR.

**Detail Analytics** (v1.2): Detail tab with multi-select filter bar (Client, Employee, Topic), six paired bar charts (3 Hours + 3 Revenue, admin-gated), full entry table with sorting/pagination, summary stats row, and chart bar click-to-filter interaction. 94 new tests (1059 total).

Tech stack: Next.js 16, Recharts, Drizzle ORM, PostgreSQL, Tailwind CSS v4, Playwright.
Codebase: ~46,400 LOC TypeScript.

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
| Client-side filtering for Detail tab | Data volume trivially small (~2000 entries/month) | ✓ Good |
| No new npm packages for MultiSelectFilter | Built on existing ClientSelect pattern | ✓ Good |
| Per-entry revenue server-computed with admin gating | No client-side rate exposure | ✓ Good |
| Comparison badges excluded from Detail tab | Unfiltered comparison data would mislead | ✓ Good |
| FilterState as single source of truth | Bar selection and FilterBar dropdowns share state (no separate chart state) | ✓ Good |
| getBarOpacity duplicated in both chart files | 4-line function, avoids cross-component coupling | ✓ Good |

---
*Last updated: 2026-02-26 after v1.3 milestone start*
