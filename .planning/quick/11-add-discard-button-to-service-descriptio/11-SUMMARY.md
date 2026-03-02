---
phase: quick-11
plan: 01
subsystem: ui
tags: [billing, service-description, confirmation-modal, react]

requires:
  - phase: existing
    provides: ServiceDescriptionDetail component, ConfirmModal component, DELETE /api/billing/[id] endpoint
provides:
  - Discard button on SD detail page for draft service descriptions
  - Confirmation modal for discard action
affects: [billing]

tech-stack:
  added: []
  patterns: [destructive-action-with-confirmation]

key-files:
  created: []
  modified:
    - app/src/components/billing/ServiceDescriptionDetail.tsx
    - app/src/components/billing/ServiceDescriptionDetail.test.tsx

key-decisions:
  - "Discard button placed before Export PDF (leftmost in footer) using danger color scheme"
  - "Modal closes immediately on confirm before fetch completes (matching BillingContent pattern)"

patterns-established:
  - "Destructive action button: danger border + text, confirmation modal with isDestructive flag"

requirements-completed: [QUICK-11]

duration: 2min
completed: 2026-03-02
---

# Quick Task 11: Add Discard Button to Service Description Detail Summary

**Discard button with confirmation modal on SD detail page, conditionally shown for draft SDs, calling DELETE API and navigating to billing list**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T13:41:12Z
- **Completed:** 2026-03-02T13:43:18Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added Discard button to footer actions for non-finalized service descriptions
- Confirmation modal warns about line item removal and time entry release
- DELETE API call followed by navigation to billing list on success
- 4 new tests covering visibility, modal display, and API call behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Discard button and confirmation flow** - `4cca7ce` (feat)
2. **Task 2: Add tests for Discard button behavior** - `aabdee7` (test)

## Files Created/Modified
- `app/src/components/billing/ServiceDescriptionDetail.tsx` - Added showDiscardConfirm/isDiscarding state, handleDiscard callback, Discard button in footer, ConfirmModal for discard
- `app/src/components/billing/ServiceDescriptionDetail.test.tsx` - Added 4 tests for discard button visibility (draft/finalized), modal appearance, and DELETE API + navigation

## Decisions Made
- Placed Discard button as leftmost action in footer (before Export PDF) for visual hierarchy -- destructive action separated from primary actions
- Modal closes immediately on confirm (setShowDiscardConfirm(false) before fetch), matching the existing BillingContent discard pattern
- Error handling uses alert() to match existing patterns in the codebase

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing beforeEach import from vitest**
- **Found during:** Task 2 (test implementation)
- **Issue:** Used `beforeEach` in test but forgot to import it from vitest, causing TS error
- **Fix:** Added `beforeEach` to the vitest import statement
- **Files modified:** app/src/components/billing/ServiceDescriptionDetail.test.tsx
- **Verification:** `tsc --noEmit` passes with no errors in file
- **Committed in:** aabdee7 (Task 2 commit, amended)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial import fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

---
*Quick Task: 11*
*Completed: 2026-03-02*
