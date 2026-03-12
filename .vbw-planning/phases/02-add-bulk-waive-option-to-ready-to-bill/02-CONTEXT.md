# Phase 2: Add bulk waive option to Ready to Bill — Context

Gathered: 2026-03-12
Calibration: architect

## Phase Boundary
Allow admins to bulk waive unbilled time entries from the Ready to Bill page. No changes to the SD editor waive flow.

## Decisions

### Where bulk waive lives
- Ready to Bill page only — NOT inside the Service Description editor
- Waiving happens on unbilled time entries before SD creation

### Waive mechanism
- Sets `isWrittenOff = true` on selected time entries (reuses existing column)
- No `waiveMode` on time entries — EXCLUDED/ZERO distinction stays in the SD editor
- When an SD is later created, written-off entries come in pre-waived as EXCLUDED by default

### Selection scope & granularity
- Client-level selection (select entire client cards, not individual entries)
- Date-range scoped: if a date range filter is active, only waive entries within that range
- If no date range filter, waive all unbilled entries for the selected client(s)

### Confirmation & reversibility
- Confirmation modal before applying (e.g., "Waive 47 entries for Client X?")
- No dedicated undo/restore UI — this is a deliberate admin action
- Written-off entries disappear from the Ready to Bill view with no built-in way to reverse

### Open (Claude's discretion)
- Multi-client selection: allow selecting multiple client cards before waiving in one batch
- API design: single bulk endpoint vs per-client calls
- How written-off entries interact with the unbilled-summary API counts

## Deferred Ideas
None.
