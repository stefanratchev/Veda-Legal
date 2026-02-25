---
phase: 05-test-infrastructure
plan: 01
subsystem: testing
tags: [playwright, e2e, jwt, next-auth, postgresql]

# Dependency graph
requires: []
provides:
  - Playwright e2e test infrastructure with auth bypass via JWT cookie injection
  - DB fixture with TRUNCATE cleanup for test isolation
  - Deterministic seed data (1 user, 2 clients, 2 topics, 3 subtopics)
  - Composed test export (test + expect) for all spec files
affects: [05-02-smoke-test, 06-workflow-tests]

# Tech tracking
tech-stack:
  added: ["@playwright/test"]
  patterns: ["JWT cookie injection for auth bypass", "globalSetup + UPSERT seed", "beforeEach TRUNCATE for test isolation"]

key-files:
  created:
    - app/playwright.config.ts
    - app/e2e/fixtures/auth.ts
    - app/e2e/fixtures/db.ts
    - app/e2e/fixtures/test.ts
    - app/e2e/setup/auth.setup.ts
    - app/e2e/helpers/seed-data.ts
    - app/e2e/helpers/global-setup.ts
    - app/.env.test
  modified:
    - app/package.json
    - app/.gitignore

key-decisions:
  - "Hardcoded deterministic IDs instead of createId() to ensure consistency across global-setup and test processes"
  - "Added !.env.test exception to .gitignore since .env* pattern would otherwise exclude the test config"

patterns-established:
  - "Auth bypass: JWT cookie injection using next-auth/jwt encode(), no production auth code changes"
  - "Test isolation: TRUNCATE mutable tables before each test, seed reference data once via globalSetup"
  - "Import pattern: All specs import { test, expect } from e2e/fixtures/test.ts"

requirements-completed: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-07, REQ-08, REQ-09]

# Metrics
duration: 5min
completed: 2026-02-25
---

# Phase 5 Plan 1: Test Infrastructure Summary

**Playwright e2e infrastructure with JWT cookie auth bypass, PostgreSQL test database seeding, and TRUNCATE-based test isolation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25T09:13:18Z
- **Completed:** 2026-02-25T09:18:38Z
- **Tasks:** 3/3
- **Files modified:** 10

## Accomplishments
- Installed Playwright with Chromium and configured serial execution on port 3001 to avoid dev server conflicts
- Built auth bypass that generates valid NextAuth JWT cookies without touching production auth code
- Created deterministic seed data and globalSetup that UPSERTs reference data into veda_legal_test
- Established test isolation via TRUNCATE CASCADE of mutable tables before each test

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Playwright and create config scaffolding** - `b42a426` (chore)
2. **Task 2: Create auth bypass via JWT cookie injection** - `c46db7d` (feat)
3. **Task 3: Create seed data, global setup, DB fixture, and composed test export** - `5ffa775` (feat)

## Files Created/Modified
- `app/playwright.config.ts` - Playwright config with setup project, Chromium-only, serial, port 3001, globalSetup, webServer
- `app/e2e/fixtures/auth.ts` - JWT encode helper using next-auth/jwt for auth bypass
- `app/e2e/setup/auth.setup.ts` - Setup project that writes storageState JSON with JWT cookie
- `app/e2e/helpers/seed-data.ts` - Deterministic test data constants (1 ADMIN user, 2 clients, 2 topics, 3 subtopics)
- `app/e2e/helpers/global-setup.ts` - Database seeding via UPSERT with correct quoted camelCase column names
- `app/e2e/fixtures/db.ts` - DB fixture with TRUNCATE CASCADE cleanup of mutable tables
- `app/e2e/fixtures/test.ts` - Composed test export (test with db fixture + expect)
- `app/.env.test` - Test environment variables (TEST_DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL)
- `app/package.json` - Added test:e2e and test:e2e:ui npm scripts, @playwright/test devDependency
- `app/.gitignore` - Added Playwright artifact paths, !.env.test exception

## Decisions Made
- Used hardcoded deterministic IDs (e.g., `e2e_user_elena_petrova01`) instead of `createId()` because global-setup and test specs run in separate processes; random IDs would diverge between seeding and assertions
- Added `!.env.test` negation in `.gitignore` because the existing `.env*` glob would otherwise exclude the test config file that must be committed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed non-deterministic seed data IDs**
- **Found during:** Task 3 (seed-data.ts creation)
- **Issue:** Plan specified `createId()` from `@paralleldrive/cuid2` but global-setup runs in a separate Node.js process from test specs; IDs would be different each run and between processes
- **Fix:** Replaced `createId()` calls with hardcoded deterministic string IDs in cuid2-like format
- **Files modified:** `app/e2e/helpers/seed-data.ts`
- **Verification:** Imported module in tsx and confirmed consistent exports
- **Committed in:** `5ffa775` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correctness -- non-deterministic IDs would break all test assertions referencing seed data. No scope creep.

## Issues Encountered
None

## User Setup Required
The test database `veda_legal_test` must exist in the local PostgreSQL instance before running e2e tests:
```bash
createdb veda_legal_test
```
Migrations must also be applied to the test database. This will be addressed in Plan 02 (smoke test) or can be done manually.

## Next Phase Readiness
- Full e2e infrastructure is in place and ready for Plan 02 (smoke test spec)
- `npx playwright test --list` successfully lists the setup project
- All spec files should import `{ test, expect }` from `e2e/fixtures/test.ts`

## Self-Check: PASSED

All 9 created files verified present. All 3 task commits (b42a426, c46db7d, 5ffa775) verified in git log.

---
*Phase: 05-test-infrastructure*
*Completed: 2026-02-25*
