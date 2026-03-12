---
phase: 07-ci-integration
plan: 01
subsystem: infra
tags: [github-actions, playwright, postgresql, ci, chromium-caching, drizzle-kit]

# Dependency graph
requires:
  - phase: 06-core-timesheet-workflow-tests
    provides: Playwright e2e tests (specs, POM, API factory) that the CI job executes
  - phase: 05-test-infrastructure
    provides: Playwright config, auth bypass, test database fixtures, global setup
provides:
  - GitHub Actions e2e job that runs Playwright tests on every PR to main
  - PostgreSQL 17 service container provisioned via drizzle-kit push --force
  - Chromium browser caching for faster CI runs
  - HTML report artifact upload on test failure
  - CI-aware Playwright config (production build in CI, dev server locally)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CI-aware Playwright webServer: process.env.CI ternary for start vs dev"
    - "drizzle-kit push --force for CI schema provisioning (bypasses broken migration chain)"
    - "Chromium caching via actions/cache@v4 with Playwright version-based key"

key-files:
  created: []
  modified:
    - ".github/workflows/ci.yml"
    - "app/playwright.config.ts"

key-decisions:
  - "drizzle-kit push --force instead of migrate for CI (broken Prisma-to-Drizzle migration chain)"
  - "Separate build step before Playwright test (CI uses next start, not next dev)"
  - "No needs: dependency between test and e2e jobs (independent parallel execution)"

patterns-established:
  - "CI e2e pattern: PostgreSQL service -> schema push -> Chromium cache -> build -> test -> artifact upload"
  - "Conditional Playwright webServer command via process.env.CI"

requirements-completed: [REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30]

# Metrics
duration: 5min
completed: 2026-02-25
---

# Plan 07-01: CI Integration Summary

**GitHub Actions e2e job with PostgreSQL 17 service container, Chromium caching, and production build testing on every PR to main**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25
- **Completed:** 2026-02-25
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- CI-aware Playwright config conditionally uses `next start` in CI and `next dev` locally
- New `e2e` job in ci.yml provisions PostgreSQL 17, pushes schema, caches Chromium, builds app, runs tests
- HTML report uploaded as artifact when tests fail (30-day retention)
- Existing `test` job completely unchanged -- both jobs run independently

## Task Commits

Each task was committed atomically:

1. **Task 1: Make Playwright config CI-aware** - `491f907` (feat)
2. **Task 2: Add e2e job to CI workflow** - `70e5c5c` (feat)

## Files Created/Modified
- `.github/workflows/ci.yml` - Added `e2e` job with PostgreSQL service, Chromium caching, production build, artifact upload
- `app/playwright.config.ts` - CI-aware webServer command (start in CI, dev locally)

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 7 is the final phase of v1.1 milestone
- All e2e tests from Phase 6 will now run automatically on PRs to main
- CI pipeline ready for production use

---
*Phase: 07-ci-integration*
*Completed: 2026-02-25*
