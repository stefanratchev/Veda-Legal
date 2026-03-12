---
phase: 02
plan: 01
title: "Bulk waive API endpoint"
status: complete
---

## What Was Built

Admin-only PATCH /api/timesheets/bulk-waive endpoint that bulk-sets isWrittenOff=true on unbilled time entries for a single client, with optional date range scoping and FINALIZED SD exclusion.

## Tasks completed

- [x] Task 1: Create bulk-waive API route handler -- commit: `77ef2c9`
- [x] Task 2: Write API route tests (16 tests) -- commit: `3bd4233`

## Files Modified

- `app/src/app/api/timesheets/bulk-waive/route.ts` (NEW) -- PATCH handler with auth, validation, subquery exclusion
- `app/src/app/api/timesheets/bulk-waive/route.test.ts` (NEW) -- 16 tests: auth, validation, happy path, edge cases

## Test Results

16 tests passed (0 failed): auth (2), validation (5), happy path (4), edge cases (5)

## Deviations

None
