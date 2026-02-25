---
phase: 01-data-layer
plan: 01
subsystem: api
tags: [drizzle, reports, revenue, topic-aggregation, written-off, typescript]

# Dependency graph
requires: []
provides:
  - "Reports API with topic aggregations (topics[] on byClient/byEmployee)"
  - "Consistent revenue calculation (excludes written-off, INTERNAL/MANAGEMENT = 0, null rate = 0)"
  - "Per-employee revenue and billableHours fields"
  - "Write-off awareness (isWrittenOff, totalWrittenOffHours)"
  - "Client type field on entries and byClient items"
  - "topicName on entries with Uncategorized fallback"
affects: [02-ui-charts, 03-drill-downs, 04-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-pass aggregation with topic tracking via Maps"
    - "Revenue = rate x non-written-off hours for REGULAR clients only"
    - "Non-admin null-out pattern extended to byEmployee.revenue, byEmployee.billableHours, summary.totalWrittenOffHours"

key-files:
  created: []
  modified:
    - "app/src/app/api/reports/route.ts"
    - "app/src/app/api/reports/route.test.ts"

key-decisions:
  - "Revenue is always a number (0 for non-billable), not null -- breaking change from prior behavior"
  - "ClientStats.revenue typed as number|null to accommodate non-admin null-out at response level"
  - "Mock helper merges clientType default into client overrides to avoid breaking existing tests"

patterns-established:
  - "TopicAggregation interface: { topicName, totalHours, writtenOffHours } -- reuse in UI phases"
  - "Revenue exclusion: !isWrittenOff && clientType === REGULAR && clientRate > 0"
  - "Empty/null topicName normalized to Uncategorized via falsy check (|| operator)"

requirements-completed: [DAT-01, DAT-02, DAT-03]

# Metrics
duration: 4min
completed: 2026-02-24
---

# Phase 1 Plan 1: Reports API Data Layer Summary

**Extended reports API with topic aggregations, write-off-aware revenue calculations, and per-employee billable hours/revenue using TDD**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-24T11:07:14Z
- **Completed:** 2026-02-24T11:11:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 24 new test cases covering topic aggregations, written-off handling, client type revenue rules, employee revenue, revenue consistency, and non-admin visibility
- Reports API returns topics[] arrays on byClient and byEmployee items with per-topic hours and written-off breakdown
- Revenue consistently excludes written-off entries and INTERNAL/MANAGEMENT clients across summary, byClient, and byEmployee
- Per-employee revenue and billableHours fields added (null for non-admin users)
- All 51 tests pass (27 existing + 24 new), full suite 917 tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: RED -- Write failing tests** - `d2beca1` (test)
2. **Task 2: GREEN -- Implement API route changes** - `47d5468` (feat)

## Files Created/Modified
- `app/src/app/api/reports/route.ts` - Extended Drizzle query, aggregation loop, and response building with topic, revenue, and write-off logic
- `app/src/app/api/reports/route.test.ts` - Updated mock helper with topicName/isWrittenOff/clientType support, added 24 new tests across 6 describe blocks

## Decisions Made
- Revenue fields are always numbers (0 for non-billable), never null at the computation level. This is a breaking change from the prior pattern where null hourlyRate yielded null revenue.
- ClientStats.revenue typed as `number | null` to accommodate the non-admin null-out at response serialization level.
- Mock helper updated to merge `clientType: "REGULAR"` default into client overrides (using spread), preventing breakage of existing tests that provide client objects without clientType.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed mock helper to merge clientType into existing client overrides**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** Existing tests providing explicit `client` objects without `clientType` caused revenue to be 0 because `clientType` was undefined, making `isBillable` false
- **Fix:** Changed mock helper from full-replacement to merge pattern: `{ clientType: "REGULAR", ...overrides.client }` so existing tests get REGULAR clientType by default
- **Files modified:** `app/src/app/api/reports/route.test.ts`
- **Verification:** All 51 tests pass including existing revenue tests
- **Committed in:** 47d5468 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minor test helper adjustment to maintain backward compatibility. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `api-utils.test.ts` (missing properties on mock user objects) -- out of scope, not caused by this plan's changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Reports API data layer complete with all new fields
- `page.tsx` server component has a duplicate `getReportData()` function that mirrors route.ts logic -- Plan 02 should update it to stay in sync
- Response shape is ready for UI consumption in Phase 2 (charts) and Phase 3 (drill-downs)
- TopicAggregation interface pattern established for reuse

---
*Phase: 01-data-layer*
*Completed: 2026-02-24*
