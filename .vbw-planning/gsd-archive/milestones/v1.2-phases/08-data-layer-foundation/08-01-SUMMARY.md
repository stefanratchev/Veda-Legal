---
phase: 08-data-layer-foundation
plan: 01
subsystem: api
tags: [typescript, drizzle, reports, revenue]

requires:
  - phase: 01-data-layer
    provides: ReportEntry type, report-utils query, aggregateEntries function
provides:
  - subtopicName field on ReportEntry type
  - Per-entry revenue computation (number | null) with admin gating
  - Updated report-utils query fetching subtopicName column
affects: [08-data-layer-foundation, 10-detail-tab-assembly]

tech-stack:
  added: []
  patterns:
    - "Per-entry revenue: isAdmin && isBillable && !isWrittenOff && rate > 0"

key-files:
  created: []
  modified:
    - app/src/types/reports.ts
    - app/src/lib/report-utils.ts
    - app/src/app/api/reports/route.test.ts

key-decisions:
  - "Revenue null for non-admin, INTERNAL/MANAGEMENT, written-off, and no-rate entries (not 0)"
  - "subtopicName uses empty string fallback (not 'Uncategorized' like topicName)"

patterns-established:
  - "Per-entry revenue pattern: compute in entries.map(), gate on isAdmin"

requirements-completed: [SC-1, SC-2, SC-4]

duration: 5min
completed: 2026-02-25
---

# Phase 8 Plan 01: Extended ReportEntry Summary

**ReportEntry type extended with subtopicName and per-entry revenue fields, query updated, 8 new tests passing**

## Performance

- **Duration:** 5 min
- **Tasks:** 2 (RED + GREEN, no REFACTOR needed)
- **Files modified:** 3

## Accomplishments
- ReportEntry interface now includes subtopicName: string and revenue: number | null
- Report query fetches subtopicName from timeEntries table
- Per-entry revenue computed server-side: hourlyRate * hours for REGULAR, non-written-off entries
- Revenue gated on isAdmin -- null for non-admin users (no rate exposure)
- 8 new test cases covering all revenue computation scenarios
- Zero regressions -- all 488 tests pass

## Task Commits

TDD plan with RED-GREEN cycle:

1. **RED: Failing tests** - `6dcb16f` (test)
2. **GREEN: Implementation** - `33810df` (feat)

## Files Created/Modified
- `app/src/types/reports.ts` - Added subtopicName and revenue to ReportEntry interface
- `app/src/lib/report-utils.ts` - Added subtopicName to query columns, per-entry revenue in entries.map()
- `app/src/app/api/reports/route.test.ts` - 8 new tests for subtopicName and revenue fields

## Decisions Made
- Revenue returns null (not 0) for non-billable entries -- "unknown" semantics per user decision
- subtopicName uses empty string fallback via `|| ""` (matches schema default)
- No REFACTOR phase needed -- implementation is minimal and clean

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## Next Phase Readiness
- ReportEntry now has all fields needed by Plan 08-02 (filter/aggregation utilities)
- subtopicName and revenue available for Detail tab (Phase 10)

---
*Phase: 08-data-layer-foundation*
*Completed: 2026-02-25*
