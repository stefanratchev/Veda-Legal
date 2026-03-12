---
plan: 2-PLAN.md
status: complete
started: 2026-02-24T16:33:00Z
completed: 2026-02-24T16:35:00Z
---

# Quick Task 2: Top 15 Entries with "Other" Grouping in Client Charts

## What Changed

Both "Hours by Client" and "Revenue by Client" charts on the reports overview now show the top 15 entries and group the remainder into "Other".

## Files Modified

- `app/src/components/reports/charts/BarChart.tsx` — Added `maxBars` prop and `prepareBarData()` function (exported for testing) that sorts by value, takes top N, and sums the rest into "Other"
- `app/src/components/reports/OverviewTab.tsx` — Passed `maxBars={15}` to both client charts

## Notes

- `prepareBarData()` mirrors `prepareRevenueData()` from RevenueBarChart
- "Other" entry has no `id`, so clicking it won't trigger drill-down (same as RevenueBarChart behavior)
- `maxBars` is optional — other BarChart usages (drill-down tabs) are unaffected
- All 965 tests pass
