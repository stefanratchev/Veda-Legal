# Phase 6: Core Timesheet Workflow Tests

**Milestone:** v1.1 E2E Timesheets
**Goal:** The full timesheet user journey — create, edit, delete entries, navigate dates, and submit a day — is covered by e2e tests that pass locally

## Requirements

| ID | Requirement |
|----|-------------|
| REQ-11 | TimesheetsPage Page Object Model with core methods |
| REQ-12 | API data factory: `createEntryViaAPI()` |
| REQ-13 | Create entry test: REGULAR client with subtopic (prefix behavior) |
| REQ-14 | Create entry test: INTERNAL client with topic-only |
| REQ-15 | Edit entry test: change description, change hours |
| REQ-16 | Edit entry test: cancel discards changes |
| REQ-17 | Delete entry test: confirm removes entry |
| REQ-18 | Delete entry test: cancel preserves entry |
| REQ-19 | WeekStrip navigation: select specific day, verify entries reload |
| REQ-20 | WeekStrip navigation: prev/next week arrows shift the week |
| REQ-21 | WeekStrip navigation: Today button returns to current day |
| REQ-22 | WeekStrip persistence: entry persists when navigating away and back |
| REQ-23 | Submission flow: log 8+ hours via API factory, submit, verify status |
| REQ-24 | Submission auto-prompt: modal appears at 8h threshold |

## Success Criteria

1. A user can create a time entry for a REGULAR client (with subtopic prefix behavior) and see it appear in the entry list — tested end-to-end through the browser
2. A user can create a time entry for an INTERNAL client (topic-only, no subtopic) and see it appear — tested end-to-end
3. A user can edit an existing entry's description and hours, and can cancel an edit without saving — tested end-to-end
4. A user can delete an entry (with confirmation) and verify it disappears, and can cancel deletion to preserve it — tested end-to-end
5. A user can navigate dates via WeekStrip (select day, prev/next week, Today button) and entries persist correctly per day — tested end-to-end
6. A user can log 8+ hours and submit the day, seeing the submission status indicator update — tested end-to-end

## Depends On

Phase 5 (Test Infrastructure) — auth bypass, test database, fixtures, and data-testid attributes must all be working

## Delivers

- `e2e/page-objects/timesheets.page.ts` — TimesheetsPage POM
- `e2e/helpers/api-factory.ts` — `createEntryViaAPI()` for fast test setup
- `e2e/specs/timesheet-entry.spec.ts` — 6 tests (create REGULAR, create INTERNAL, edit change, edit cancel, delete confirm, delete cancel)
- `e2e/specs/weekstrip-nav.spec.ts` — 4 tests (select day, prev/next week, Today button, persistence)
- `e2e/specs/submission.spec.ts` — 2 tests (submit flow, auto-prompt modal)
