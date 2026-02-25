---
phase: 05-test-infrastructure
plan: 02
subsystem: testing
tags: [playwright, e2e, data-testid, smoke-test, chromium]

# Dependency graph
requires:
  - phase: 05-01
    provides: Playwright infrastructure, auth bypass, seed data, DB fixture
provides:
  - data-testid attributes on 6 key UI components for Playwright locators
  - Passing smoke test validating auth bypass, seed data, and data-testid infrastructure
affects: [06-workflow-tests]

# Tech tracking
tech-stack:
  added: []
  patterns: ["data-testid kebab-case naming convention on production components", "Playwright locator pattern via getByTestId()"]

key-files:
  created:
    - app/e2e/specs/smoke.spec.ts
  modified:
    - app/src/components/ui/ClientSelect.tsx
    - app/src/components/ui/TopicCascadeSelect.tsx
    - app/src/components/ui/DurationPicker.tsx
    - app/src/components/timesheets/EntryCard.tsx
    - app/src/components/timesheets/WeekStrip.tsx
    - app/src/components/timesheets/EntryForm.tsx

key-decisions:
  - "Test DB schema provisioned via pg_dump from dev DB rather than drizzle-kit migrate (legacy migration has DROP _prisma_migrations that fails on fresh DB)"
  - "Smoke test clicks trigger button inside client-select div rather than the div itself (ClientSelect component has inner button as click target)"

patterns-established:
  - "data-testid naming: kebab-case matching component purpose (client-select, topic-cascade-select, duration-picker, entry-card, week-strip, submit-button)"
  - "Smoke test pattern: navigate to /timesheets, assert no redirect, assert components visible, interact with dropdown to verify seed data"

requirements-completed: [REQ-06, REQ-10]

# Metrics
duration: 5min
completed: 2026-02-25
---

# Phase 5 Plan 2: Smoke Test Summary

**data-testid attributes on 6 components + passing smoke test validating full e2e infrastructure (auth bypass, seed data, Playwright locators)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25T09:21:32Z
- **Completed:** 2026-02-25T09:26:26Z
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments
- Added data-testid attributes to 6 key production components (ClientSelect, TopicCascadeSelect, DurationPicker, EntryCard, WeekStrip, EntryForm submit buttons)
- Created smoke test that validates the entire Phase 5 infrastructure: JWT auth bypass, test database seeding, data-testid locators
- Verified idempotency: two consecutive e2e runs produce identical passing results (3 passed in ~8-12s each)
- All 965 existing unit tests continue to pass with no lint regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add data-testid attributes to 6 key production components** - `c99be26` (feat)
2. **Task 2: Write smoke test and verify full infrastructure** - `0fc444b` (feat)

## Files Created/Modified
- `app/e2e/specs/smoke.spec.ts` - Smoke test: auth bypass, data-testid visibility, seed data in dropdowns
- `app/src/components/ui/ClientSelect.tsx` - Added data-testid="client-select"
- `app/src/components/ui/TopicCascadeSelect.tsx` - Added data-testid="topic-cascade-select"
- `app/src/components/ui/DurationPicker.tsx` - Added data-testid="duration-picker"
- `app/src/components/timesheets/EntryCard.tsx` - Added data-testid="entry-card"
- `app/src/components/timesheets/WeekStrip.tsx` - Added data-testid="week-strip"
- `app/src/components/timesheets/EntryForm.tsx` - Added data-testid="submit-button" on both mobile and desktop submit buttons

## Decisions Made
- Used `pg_dump --schema-only` from dev DB to provision test database schema, because legacy migrations include `DROP TABLE "_prisma_migrations"` which fails on a fresh database without that table
- Smoke test opens client dropdown by targeting the inner `<button>` element within the `data-testid="client-select"` div, since the ClientSelect component renders a button as the click trigger

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test database schema provisioning via pg_dump instead of drizzle-kit migrate**
- **Found during:** Task 2 (pre-requisite database setup)
- **Issue:** `npm run db:migrate` fails on fresh test DB because migration 0001_baseline.sql contains `DROP TABLE "_prisma_migrations" CASCADE` and subsequent migrations assume tables already exist (they were incremental on top of an existing Prisma-managed schema)
- **Fix:** Used `pg_dump --schema-only veda_legal_dev | psql -d veda_legal_test` to copy the full schema from the dev database, bypassing the migration history entirely
- **Files modified:** None (manual DB provisioning step)
- **Verification:** Tables confirmed present via `\dt`, globalSetup seeded successfully, all smoke tests pass
- **Note:** This is a one-time local setup step. For CI, the global-setup or a dedicated script should handle schema provisioning

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for database provisioning. No scope creep.

## Issues Encountered
- Dev server lock conflict: Running `npm run test:e2e` while a dev server is active on port 3000 fails because Next.js cannot acquire `.next/dev/lock` for a second instance. Resolution: stop the dev server before running e2e tests, or ensure only one Next.js instance runs at a time. The Playwright config has `reuseExistingServer: !process.env.CI` but this only helps if the existing server is on port 3001.

## User Setup Required
Before running `npm run test:e2e`:
1. Create test database: `/opt/homebrew/opt/postgresql@17/bin/createdb veda_legal_test`
2. Provision schema: `/opt/homebrew/opt/postgresql@17/bin/pg_dump --schema-only veda_legal_dev | /opt/homebrew/opt/postgresql@17/bin/psql -d veda_legal_test`
3. Stop any running dev server (port 3000) to avoid `.next/dev/lock` conflict

## Next Phase Readiness
- Phase 5 complete: full e2e infrastructure proven with passing smoke test
- Ready for Phase 6 (workflow tests): entry CRUD, date navigation, daily submission
- Pattern established: import `{ test, expect }` from `e2e/fixtures/test`, use `getByTestId()` for locators

## Self-Check: PASSED

All 7 files verified present. All 2 task commits (c99be26, 0fc444b) verified in git log.

---
*Phase: 05-test-infrastructure*
*Completed: 2026-02-25*
