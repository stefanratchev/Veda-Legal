# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Partners and admins can quickly understand firm performance -- revenue, hours, and work distribution -- from the reports page.
**Current focus:** Phase 2: Overview Revenue Charts

## Current Position

Phase: 2 of 4 (Overview Revenue Charts)
Plan: 2 of 2 in current phase (PHASE COMPLETE)
Status: Phase Complete
Last activity: 2026-02-24 -- Completed 02-02-PLAN.md

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 2min
- Total execution time: 0.17 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-layer | 2 | 6min | 3min |
| 02-overview-revenue-charts | 2 | 4min | 2min |

**Recent Trend:**
- Last 5 plans: 4min, 2min, 2min, 2min
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Revenue = rate x hours only (no SD/actual-billed integration)
- Revenue charts separate from hours charts (no dual-axis)
- No revenue in drill-down views (hours and activity patterns only)
- All entries in drill-down tables (remove 10-entry limit)
- Revenue is always a number (0 for non-billable), not null -- breaking change from prior behavior
- TopicAggregation interface: { topicName, totalHours, writtenOffHours } -- reuse in UI phases
- Revenue exclusion rule: !isWrittenOff && clientType === REGULAR && clientRate > 0
- [Phase 01-data-layer]: Entry interface left unchanged in ReportsContent -- local transformation type distinct from API shape
- [Phase 01-data-layer]: Server component uses explicit column selection matching route.ts for consistency
- [Phase 02-overview-revenue-charts]: Teal #4ECDC4 as --accent-revenue color (distinct from coral pink hours)
- [Phase 02-overview-revenue-charts]: LabelList with custom content renderer for per-bar % change badges
- [Phase 02-overview-revenue-charts]: Module-level Intl.NumberFormat cache for formatEurExact performance
- [Phase 02-overview-revenue-charts]: Revenue charts use horizontal bars for better scalability with many clients/employees
- [Phase 02-overview-revenue-charts]: Paired-row layout: Hours by Client | Revenue by Client, Hours by Employee | Revenue by Employee
- [Phase 02-overview-revenue-charts]: Hours by Client switched from DonutChart to horizontal BarChart for visual consistency

### Pending Todos

None yet.

### Blockers/Concerns

- Null `topicId`/`topicName` entries must resolve to "Uncategorized" in all aggregations
- INTERNAL/MANAGEMENT clients (hourlyRate = null) must be excluded from revenue charts
- Entry tables will need pagination when removing the 10-entry limit (400+ rows possible per month)

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 02-02-PLAN.md (Phase 2 complete)
Resume file: None
