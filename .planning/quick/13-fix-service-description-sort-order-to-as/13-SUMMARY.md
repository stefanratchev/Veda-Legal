---
phase: 13-fix-service-description-sort-order
plan: 01
subsystem: billing
tags: [sort-order, service-descriptions, line-items]
dependency_graph:
  requires: []
  provides: [chronological-line-item-ordering]
  affects: [billing-sd-creation]
tech_stack:
  added: []
  patterns: [multi-key-orderby]
key_files:
  modified:
    - app/src/app/api/billing/route.ts
decisions: []
metrics:
  duration: 73s
  completed: "2026-03-10T13:30:21Z"
---

# Quick Task 13: Fix Service Description Line Item Sort Order

**One-liner:** Added createdAt as tiebreaker sort key so same-day line items appear in chronological creation order.

## What Changed

The POST /api/billing handler queries unbilled time entries to create a new service description. Previously, entries were sorted by `topicName asc, date asc` -- meaning same-day entries within a topic had no deterministic order. Added `asc(timeEntries.createdAt)` as a third sort key so entries from the same day appear in the order they were originally logged.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add createdAt as third sort key in SD creation query | c2cf47b | app/src/app/api/billing/route.ts |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- Confirmed `asc(timeEntries.createdAt)` present in orderBy clause (line 215)
- TypeScript compilation: no new errors (only pre-existing path alias and drizzle-orm internal type issues)
- ESLint: no new warnings or errors in modified file

## Self-Check: PASSED
