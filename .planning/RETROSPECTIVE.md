# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.3 — Billing Tabs

**Shipped:** 2026-02-28
**Phases:** 2 | **Plans:** 2 | **Sessions:** 2

### What Was Built
- Two-tab billing page (Ready to Bill / Service Descriptions) with URL-persisted state
- DateRangePicker with 4 presets (This Month, Last Month, All Time, Custom Range)
- Server-side date range filtering on GET /api/billing via periodStartFrom/periodStartTo
- Client-side refetching with loading state transition on date range change

### What Worked
- Small, focused milestone (2 phases, 2 plans) executed cleanly in a single day
- URL-driven tab state pattern (useSearchParams + router.replace) was simple and robust
- SSR pre-filtering to match client default eliminated visual flash on initial load
- Audit passed first time with 9/9 requirements — tight scope definition paid off

### What Was Inefficient
- Minor: useEffect fires redundantly on mount for Ready to Bill tab (noted as tech debt in audit)
- gsd-tools milestone complete counted all phases (6) instead of just v1.3's (2) — had to manually fix MILESTONES.md stats

### Patterns Established
- Inlined filter bar pattern when TableFilters doesn't support custom layout elements
- Primitive useEffect dependencies (from/to strings) instead of object references for date-driven fetching
- Suspense boundary required for useSearchParams consumers in Next.js App Router

### Key Lessons
1. Small milestones (2-3 phases) ship fastest — tight scope means fewer integration surprises
2. URL-driven state is ideal for tab/filter UIs — survives refresh, shareable, no extra state management

### Cost Observations
- Model mix: quality profile (opus for planning/execution)
- Sessions: 2 (execution + verification/completion)
- Notable: 8 minutes total execution time for both plans — fastest milestone yet

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~4 | 4 | Established GSD workflow |
| v1.1 | ~3 | 3 | Added e2e testing infrastructure |
| v1.2 | ~4 | 4 | Detail analytics with complex filtering |
| v1.3 | 2 | 2 | Smallest, fastest milestone — clean scope |

### Cumulative Quality

| Milestone | Tests | Test Files | Key Addition |
|-----------|-------|------------|-------------|
| v1.0 | 965 | 46 | Reports data layer + charts |
| v1.1 | 980 | 46 | 15 Playwright e2e tests |
| v1.2 | 1059 | 50 | Detail tab + filter tests |
| v1.3 | 1114 | 54 | Tab navigation + date range tests |

### Top Lessons (Verified Across Milestones)

1. Tight scope definition (explicit requirements + out-of-scope list) leads to clean execution
2. Server-computed data with client-side filtering works well at current data volumes (~200 clients)
3. URL-driven state (query params) is the right default for any user-facing filter/tab UI
