---
phase: 06-core-timesheet-workflow-tests
plan: 01
subsystem: testing
tags: [playwright, e2e, page-object-model, api-factory, timesheets]

# Dependency graph
requires:
  - phase: 05-01
    provides: Playwright infrastructure, auth bypass, seed data, DB fixture
  - phase: 05-02
    provides: data-testid attributes on production components, smoke test
provides:
  - TimesheetsPage Page Object Model encapsulating all dropdown and navigation interactions
  - API data factory for creating time entries via POST /api/timesheets
affects: [06-02-entry-crud, 06-03-navigation-submission]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Page Object Model with portal-aware DurationPicker locators", "API data factory using page.request.post() for test setup"]

key-files:
  created:
    - app/e2e/pages/timesheets.page.ts
    - app/e2e/helpers/api-factory.ts
  modified: []

key-decisions:
  - "DurationPicker portal located via tabindex=-1 panel with 'Select hours' text filter, scoped button clicks for hours and minutes"
  - "TopicCascadeSelect handles auto-open detection by checking for visible search input before clicking trigger"

patterns-established:
  - "POM import pattern: import { TimesheetsPage } from '../pages/timesheets.page' in all spec files"
  - "API factory pattern: createRegularEntry/createInternalEntry convenience functions with seed data constants"
  - "waitForEntriesLoad() returns promise to be set up BEFORE the triggering action (click day, navigate)"

requirements-completed: [REQ-11, REQ-12]

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 6 Plan 1: POM and API Factory Summary

**TimesheetsPage Page Object Model (305 lines, 23 methods) with portal-aware dropdown interactions plus API data factory for e2e test setup**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T10:22:28Z
- **Completed:** 2026-02-25T10:25:10Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- Created comprehensive TimesheetsPage POM with 23 methods covering navigation, dropdown interactions, entry CRUD, and submission flows
- DurationPicker portal-aware locator strategy using tabindex=-1 panel scoping (avoids ambiguity from body-level portal rendering)
- API data factory with generic createEntryViaAPI plus createRegularEntry/createInternalEntry convenience wrappers using seed data constants
- Both files pass TypeScript compilation, all 3 existing smoke tests remain green

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TimesheetsPage Page Object Model** - `479c132` (feat)
2. **Task 2: Create API data factory** - `6b68de2` (feat)

## Files Created/Modified
- `app/e2e/pages/timesheets.page.ts` - Page Object Model: 23 methods encapsulating ClientSelect, TopicCascadeSelect, DurationPicker interactions, WeekStrip navigation, entry CRUD, and submission flows
- `app/e2e/helpers/api-factory.ts` - API data factory: createEntryViaAPI (generic), createRegularEntry, createInternalEntry, getToday helper

## Decisions Made
- DurationPicker portal locator uses `page.locator("[tabindex='-1']").filter({ hasText: "Select hours" })` to scope to the portal panel at body level, then `getByRole("button", { name, exact: true })` for hours/minutes buttons. This avoids ambiguity with other page elements.
- TopicCascadeSelect selectTopicAndSubtopic/selectTopicOnly methods check if the dropdown is already open (via search input visibility) before clicking the trigger, handling the auto-open behavior after client selection.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- POM and API factory are ready for Plans 02 (entry-crud.spec.ts) and 03 (navigation.spec.ts, submission.spec.ts)
- All spec files should import TimesheetsPage from `../pages/timesheets.page` and use API factory from `../helpers/api-factory`
- Smoke test confirmed green (3 passed in 8.6s)

## Self-Check: PASSED

All 2 created files verified present. All 2 task commits (479c132, 6b68de2) verified in git log.

---
*Phase: 06-core-timesheet-workflow-tests*
*Completed: 2026-02-25*
