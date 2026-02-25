---
phase: 06-core-timesheet-workflow-tests
plan: 02
subsystem: testing
tags: [playwright, e2e, entry-crud, timesheets, page-object-model]

# Dependency graph
requires:
  - phase: 06-01
    provides: TimesheetsPage POM, API data factory, seed data constants
  - phase: 05-02
    provides: data-testid attributes, smoke test, Playwright infrastructure
provides:
  - E2E tests for entry create (REGULAR + INTERNAL), edit, cancel edit, delete, cancel delete
  - POM enhancements for inline edit form scoping and DurationPicker auto-open handling
affects: [06-03-navigation-submission]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Inline edit form scoping via entriesTable-scoped POM methods", "Function-based waitForResponse matchers for DELETE/PATCH methods", "Submit prompt modal dismissal pattern for tests crossing hour thresholds"]

key-files:
  created:
    - app/e2e/specs/entry-crud.spec.ts
  modified:
    - app/e2e/pages/timesheets.page.ts

key-decisions:
  - "DurationPicker auto-open detection: check if hours panel is visible before clicking trigger, prevents double-toggle when EntryForm auto-opens picker after topic selection"
  - "Inline edit form scoped via entriesTable.getByPlaceholder to avoid matching create form at page top (3 description inputs visible in edit mode)"
  - "confirmDelete uses exact: true on getByRole to avoid matching entry row Delete entry title button"
  - "Delete API waitForResponse uses function matcher (method=DELETE) since delete URL is /api/timesheets?id= not /api/timesheets/[id]"

patterns-established:
  - "Edit test pattern: create entry via API factory in beforeEach, goto page, use scoped edit POM methods (fillEditDescription, selectEditDuration)"
  - "Delete test pattern: create entry via API factory, verify count, click delete, wait for ConfirmModal, confirm/cancel, verify count"
  - "Submit prompt dismissal: check for Submit Timesheet? text after entry creation, dismiss via Not yet button if visible"
  - "Entry assertion scoping: use entriesTable.getByText() not page.getByText() to avoid matching mobile card duplicate text"

requirements-completed: [REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18]

# Metrics
duration: 27min
completed: 2026-02-25
---

# Phase 6 Plan 2: Entry CRUD Tests Summary

**6 E2E tests covering time entry create (REGULAR + INTERNAL), edit with persist, cancel edit, delete confirm, and delete cancel -- with POM enhancements for inline edit form scoping and DurationPicker auto-open handling**

## Performance

- **Duration:** 27 min
- **Started:** 2026-02-25T10:28:07Z
- **Completed:** 2026-02-25T10:55:06Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- 6 entry-crud tests all passing: create REGULAR with prefix subtopic pre-fill, create INTERNAL with topic-only, edit description + hours, cancel edit, confirm delete, cancel delete
- POM enhanced with DurationPicker auto-open detection, minutes panel re-locator, inline edit form scoping, and exact match for confirmDelete
- Tests use API factory for setup (edit/delete) and full UI interaction for create tests, following the recommended pattern from research

## Task Commits

Each task was committed atomically:

1. **Task 1: Create entry tests (REGULAR + INTERNAL)** - `2502b68` (feat)
2. **Task 2: Edit and delete entry tests** - `ed8b1b4` (feat)

## Files Created/Modified
- `app/e2e/specs/entry-crud.spec.ts` - 6 E2E tests: 2 create (REGULAR prefix subtopic, INTERNAL topic-only), 2 edit (save changes, cancel), 2 delete (confirm, cancel)
- `app/e2e/pages/timesheets.page.ts` - POM enhancements: DurationPicker auto-open + minutes panel re-locator, clickLog/clickSave via getByRole, ensureTopicDropdownOpen with auto-open wait, fillEditDescription/selectEditDuration for inline edit form, confirmDelete with exact:true, scoped navigation methods

## Decisions Made
- DurationPicker auto-open detection: the POM checks if the hours panel is already visible before clicking the trigger button, preventing a double-toggle that would close an auto-opened picker. After selecting hours, the panel locator is re-created with "Select minutes" text filter since the content changes.
- Inline edit form scoping: when editing an entry, 3 description inputs are visible (create form mobile, create form desktop, inline edit form). Edit-specific POM methods scope to `entriesTable.getByPlaceholder()` to target only the inline form.
- confirmDelete uses `{ exact: true }` because the entry row has a button with `title="Delete entry"` which Playwright's accessible name matching would include when searching for "Delete".
- DELETE API response matcher uses a function predicate checking both URL pattern and HTTP method, since the delete endpoint uses query params (`/api/timesheets?id=...`) not path params.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DurationPicker auto-open double-toggle**
- **Found during:** Task 1 (Create entry tests)
- **Issue:** POM's selectDuration always clicked the trigger button, but after topic/subtopic selection the DurationPicker auto-opens. Clicking an open picker's trigger closes it, leaving the test stuck waiting for the portal panel.
- **Fix:** Check `hoursPanel.isVisible()` before clicking trigger; skip click if already open
- **Files modified:** app/e2e/pages/timesheets.page.ts
- **Verification:** Both create tests pass consistently
- **Committed in:** 2502b68 (Task 1 commit)

**2. [Rule 1 - Bug] DurationPicker minutes panel locator stale after hours selection**
- **Found during:** Task 1 (Create entry tests)
- **Issue:** After selecting hours, the portal panel text changes from "Select hours" to "Select minutes". The original panel locator filtered by `hasText: "Select hours"` no longer matched, causing minute button clicks to fail.
- **Fix:** Re-locate the panel using `filter({ hasText: "Select minutes" })` for the minutes step
- **Files modified:** app/e2e/pages/timesheets.page.ts
- **Verification:** Duration selection works for all hour/minute combinations tested (2:00, 1:30, 3:30)
- **Committed in:** 2502b68 (Task 1 commit)

**3. [Rule 1 - Bug] Strict mode violation: dual submit buttons (mobile + desktop)**
- **Found during:** Task 1 (Create entry tests)
- **Issue:** `getByTestId("submit-button")` resolved to 2 elements (mobile `lg:hidden` and desktop `hidden lg:flex` variants). Both had same data-testid.
- **Fix:** Changed clickLog/clickSave to use `getByRole("button", { name: "Log"/"Save" })` which filters by accessibility visibility
- **Files modified:** app/e2e/pages/timesheets.page.ts
- **Verification:** Log and Save clicks work in create and edit modes
- **Committed in:** 2502b68 (Task 1 commit)

**4. [Rule 1 - Bug] Entry text assertion matching mobile card + desktop table**
- **Found during:** Task 1 (Create entry tests)
- **Issue:** `page.getByText("description")` matched both mobile `<p>` card and desktop `<td>` table cell, causing strict mode violation
- **Fix:** Scoped assertions to `entriesTable.getByText()` (desktop table only)
- **Files modified:** app/e2e/specs/entry-crud.spec.ts
- **Verification:** Entry visibility assertions pass without ambiguity
- **Committed in:** 2502b68 (Task 1 commit)

**5. [Rule 1 - Bug] Inline edit form description input ambiguity**
- **Found during:** Task 2 (Edit tests)
- **Issue:** In edit mode, `getByPlaceholder("What did you work on?")` matched 3 inputs (create form mobile, create form desktop, inline edit form)
- **Fix:** Added `fillEditDescription`/`getEditDescriptionInput` POM methods scoped to `entriesTable`
- **Files modified:** app/e2e/pages/timesheets.page.ts, app/e2e/specs/entry-crud.spec.ts
- **Verification:** Edit tests pass using scoped input
- **Committed in:** ed8b1b4 (Task 2 commit)

**6. [Rule 1 - Bug] confirmDelete strict mode: Delete entry title match**
- **Found during:** Task 2 (Delete tests)
- **Issue:** `getByRole("button", { name: "Delete" })` matched both the ConfirmModal's confirm button and the entry row's trash button (which has `title="Delete entry"`)
- **Fix:** Added `exact: true` to the role matcher
- **Files modified:** app/e2e/pages/timesheets.page.ts
- **Verification:** Confirm delete passes consistently in sequential suite run
- **Committed in:** ed8b1b4 (Task 2 commit)

---

**Total deviations:** 6 auto-fixed (all Rule 1 - bugs in POM locator strategies)
**Impact on plan:** All auto-fixes were necessary for test correctness. The POM from 06-01 needed refinement for real-world usage patterns (auto-opening dropdowns, mobile/desktop dual rendering, inline edit form context). No scope creep.

## Issues Encountered
- Test DB had leftover entries from previous manual test runs, causing unexpected entry counts. Resolved by ensuring TRUNCATE runs via the db fixture in beforeEach. For fresh test runs, manual TRUNCATE may be needed if previous runs crashed before cleanup.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All entry CRUD workflows verified end-to-end
- POM now battle-tested with real interaction patterns (auto-open dropdowns, inline edit forms, portals)
- Plan 03 (navigation + submission) can use the same POM and API factory patterns
- Test database TRUNCATE fixture confirmed working between sequential tests

## Self-Check: PASSED

All files verified present. All task commits verified in git log.

---
*Phase: 06-core-timesheet-workflow-tests*
*Completed: 2026-02-25*
