# Phase 6: Core Timesheet Workflow Tests - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

E2E tests covering the full timesheet user journey: create entries (regular + internal clients), edit entries, delete entries, navigate dates via WeekStrip, and submit a day. Builds on Phase 5 infrastructure (auth bypass, test DB, fixtures, seed data). Target ~15 tests across 3 spec files. Page Object Model and API data factory support the tests.

</domain>

<decisions>
## Implementation Decisions

### Spec file organization
- 3 files grouped by workflow step:
  - `entry-crud.spec.ts` (~8 tests) — create, edit, delete entries
  - `navigation.spec.ts` (~4 tests) — WeekStrip day selection, prev/next week, Today button, persistence
  - `submission.spec.ts` (~3 tests) — submit day, status indicator, auto-prompt at 8h threshold
- Internal describe block structure at Claude's discretion

### Claude's Discretion
- **Test setup strategy** — When to use API factory (`createEntryViaAPI()`) vs full UI form interaction for test data setup. Recommendation: API factory for edit/delete/navigation/submission tests; UI form only for create-entry tests.
- **Coverage boundaries** — Which edge cases fit within the ~15 test budget. Recommendation: all happy paths from REQ-13 through REQ-24, plus the cancel flows (REQ-16, REQ-18). Skip validation error paths (already covered by 965 Vitest unit tests).
- **Submission flow details** — Assertion depth for REQ-23 (submit + status indicator) and REQ-24 (auto-prompt modal at 8h). Recommendation: verify modal appearance and status change, don't over-assert on modal content.
- **Page Object Model design** — Method signatures, locator strategy, assertion encapsulation. Follow Playwright best practices.
- **Spec internal structure** — Describe blocks, test naming conventions, helper extraction.
- **Test data values** — Specific hours, descriptions, and client/topic selections used in tests. Use seed data from Phase 5 (`seed-data.ts` constants).

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User prefers Claude to make all implementation decisions and focus on getting it done efficiently.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-core-timesheet-workflow-tests*
*Context gathered: 2026-02-25*
