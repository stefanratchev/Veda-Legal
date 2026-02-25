---
plan: 1-PLAN.md
status: complete
started: 2026-02-24T16:31:00Z
completed: 2026-02-24T16:31:00Z
---

# Quick Task 1: Increase Height of Client Charts on Reports Overview

## What Changed

Increased the height of the "Hours by Client" and "Revenue by Client" chart containers from `h-64` (256px) to `h-96` (384px) — a 50% increase — to give the charts more room.

## Files Modified

- `app/src/components/reports/OverviewTab.tsx` — Changed `h-64` → `h-96` on the two client chart container divs (lines 155 and 169)

## Notes

- Employee charts (Row 2) left at `h-64` as they were not mentioned
- `h-96` = 24rem = 384px, exactly 50% more than `h-64` = 16rem = 256px
