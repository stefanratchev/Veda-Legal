---
phase: 06-core-timesheet-workflow-tests
plan: 03
subsystem: testing
tags: [playwright, e2e, weekstrip, navigation, submission, timesheets]

# Dependency graph
requires:
  - phase: 06-01
    provides: TimesheetsPage POM, API data factory, db fixture, auth bypass
provides:
  - E2E tests for WeekStrip date navigation (day select, prev/next week, Today button, entry persistence)
  - E2E tests for daily submission flow (manual submit, auto-prompt modal at 8h threshold)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["getByRole('cell') for desktop table cell assertions (avoids mobile/desktop strict mode conflicts)", "db fixture required in all test parameters for TRUNCATE cleanup between tests"]

key-files:
  created:
    - app/e2e/specs/navigation.spec.ts
    - app/e2e/specs/submission.spec.ts
  modified:
    - app/e2e/pages/timesheets.page.ts

key-decisions:
  - "Use getByRole('cell') for entry text assertions to scope to desktop table and avoid strict mode violations from mobile card elements"
  - "Scope POM dropdown clicks to within data-testid containers to avoid matching entry row text"
  - "Use try/catch with 1s timeout for auto-open detection instead of immediate isVisible() check to handle setTimeout race conditions"
  - "Scope clickPrevWeek/clickNextWeek/clickToday to weekStrip locator to avoid duplicate element matches"

patterns-established:
  - "All test functions must destructure { db } from parameters to trigger TRUNCATE cleanup before each test"
  - "For text visible in both mobile cards and desktop table, use getByRole('cell', { name }) for desktop-only targeting"
  - "POM dropdown methods scope clicks within container getByTestId to avoid ambiguity with entry row content"

requirements-completed: [REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24]

# Metrics
duration: 23min
completed: 2026-02-25
---

# Phase 6 Plan 3: Navigation and Submission E2E Tests Summary

**WeekStrip navigation tests (4 tests) and daily submission flow tests (2 tests) with POM fixes for strict mode compliance across mobile/desktop layouts**

## Performance

- **Duration:** 23 min
- **Started:** 2026-02-25T10:27:54Z
- **Completed:** 2026-02-25T10:51:00Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments
- Created navigation.spec.ts with 4 passing tests: day selection with entries reload (REQ-19), prev/next week arrows (REQ-20), Today button (REQ-21), and entry persistence across navigation (REQ-22)
- Created submission.spec.ts with 2 passing tests: manual submit with status indicator (REQ-23) and auto-prompt modal at 8h threshold (REQ-24)
- Fixed POM methods for strict mode compliance: scoped dropdown clicks within containers, scoped week navigation within week-strip, added auto-open race condition handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create WeekStrip navigation spec** - `babd22c` (feat)
2. **Task 2: Create daily submission spec** - `eb84696` (feat)

## Files Created/Modified
- `app/e2e/specs/navigation.spec.ts` - 4 tests: day select, prev/next week, Today button, entry persistence. Uses API factory for test data, waitForEntriesLoad pattern for navigation assertions
- `app/e2e/specs/submission.spec.ts` - 2 tests: manual submit (9h via API factory, assert "Timesheet Submitted" indicator), auto-prompt (7h via API + 1.5h via UI to cross 8h, assert "Submit Timesheet?" modal)
- `app/e2e/pages/timesheets.page.ts` - Fixed selectClient, selectTopicAndSubtopic, selectTopicOnly to scope within containers; fixed clickPrevWeek/clickNextWeek/clickToday to scope within weekStrip; added ensureTopicDropdownOpen with 1s auto-open timeout; fixed selectDuration with auto-open race condition handling; fixed clickDay with .first()

## Decisions Made
- Use `getByRole('cell', { name })` for entry text assertions instead of `getByText()` to avoid strict mode violations where both mobile card and desktop table render the same text
- Scope POM dropdown selection clicks to within their `data-testid` containers (`clientSelect`, `topicSelect`) to prevent matching text in entry rows
- Implement `ensureTopicDropdownOpen()` helper with 1s timeout: waits for auto-open from EntryForm's setTimeout(0), falls back to manual trigger click if it doesn't fire in time
- Scope WeekStrip navigation buttons (prev/next/today) to `this.weekStrip` locator to avoid matching duplicate elements from unknown page structure
- Add `db` fixture to all test function signatures (not just `beforeEach`) to ensure TRUNCATE cleanup runs before every test

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] POM selectClient matches entry row text**
- **Found during:** Task 2 (submission spec)
- **Issue:** `page.getByText(clientName)` in selectClient matched both dropdown option and entry table cells, causing strict mode violation when entries exist
- **Fix:** Changed to `this.clientSelect.getByText(clientName)` to scope within the client-select container
- **Files modified:** app/e2e/pages/timesheets.page.ts
- **Verification:** Submission auto-prompt test passes with existing entries on page
- **Committed in:** eb84696 (Task 2 commit)

**2. [Rule 1 - Bug] POM selectTopicAndSubtopic race condition with auto-open**
- **Found during:** Task 2 (submission spec)
- **Issue:** Checking `isVisible()` immediately after client selection could race with EntryForm's `setTimeout(0)` auto-open, causing the manual trigger click to toggle the dropdown closed
- **Fix:** Created `ensureTopicDropdownOpen()` that waits 1s for auto-open, then falls back to manual click
- **Files modified:** app/e2e/pages/timesheets.page.ts
- **Verification:** Both topic selection flows (auto-opened and manual) work reliably
- **Committed in:** eb84696 (Task 2 commit)

**3. [Rule 1 - Bug] POM clickDay/clickPrevWeek/clickNextWeek strict mode violations**
- **Found during:** Task 1 (navigation spec)
- **Issue:** `getByText(dayNumber)` within week-strip resolved to 2 elements (span + button text); `getByTitle("Next week")` resolved to 2 elements on page level
- **Fix:** Added `.first()` to clickDay; scoped prev/next/today clicks to `this.weekStrip` instead of `this.page`
- **Files modified:** app/e2e/pages/timesheets.page.ts
- **Verification:** All 4 navigation tests pass consistently
- **Committed in:** eb84696 (Task 2 commit)

**4. [Rule 1 - Bug] Missing db fixture causing test data bleed**
- **Found during:** Task 2 (submission spec)
- **Issue:** Tests not destructuring `{ db }` from parameters meant TRUNCATE cleanup didn't run, causing entries from previous tests to persist
- **Fix:** Added `db` to all test function signatures in both navigation and submission specs
- **Files modified:** app/e2e/specs/navigation.spec.ts, app/e2e/specs/submission.spec.ts
- **Verification:** Tests run clean in isolation and as part of the suite
- **Committed in:** eb84696 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (4 bugs via Rule 1)
**Impact on plan:** All fixes necessary for test reliability in real-world conditions where entries exist on the page. No scope creep.

## Issues Encountered
- Entry-crud spec tests (from plan 06-02, created concurrently) have failures in the full suite due to similar POM issues. These are out of scope for plan 06-03 and documented as pre-existing.
- Smoke test strict mode violations (2 `client-select` elements, `Balkanova Industries` in 3 elements) occur when running after entry-crud tests that don't clean up. This is a known issue with entry-crud.spec.ts not requesting `db` fixture in individual test functions.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 requirements (REQ-19 through REQ-24) covered by passing tests
- Navigation (4 tests) + submission (2 tests) = 6 new tests, bringing total to 8 passing (with smoke)
- Entry-crud tests (from plan 06-02) need POM compatibility fixes before full suite is green
- Phase 6 plan 3 of 3 complete

## Self-Check: PASSED

All 3 created/modified files verified present. All 2 task commits (babd22c, eb84696) verified in git log. navigation.spec.ts: 172 lines (min 60). submission.spec.ts: 125 lines (min 40).

---
*Phase: 06-core-timesheet-workflow-tests*
*Completed: 2026-02-25*
