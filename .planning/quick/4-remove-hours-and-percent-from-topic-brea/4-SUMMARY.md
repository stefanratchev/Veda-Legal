---
plan: 4-PLAN.md
status: complete
started: 2026-02-24T16:43:00Z
completed: 2026-02-24T16:45:00Z
---

# Quick Task 4: Remove Hours/Percentage from Employee Topic Breakdown Labels

## What Changed

Employee drill-down topic breakdown chart now shows only the topic name in Y-axis labels. Hours and percentage are available in the tooltip on hover.

## Files Modified

- `app/src/components/reports/ByEmployeeTab.tsx` — Simplified topicChartData mapping to use `t.topicName` only (removed `formatHours` and `pct` from name)
- `app/src/components/reports/ByEmployeeTab.test.tsx` — Updated test to verify topic name presence instead of hours/percentage in labels

## Notes

- ByClientTab still has hours+percentage in labels (not requested to change)
- All 965 tests pass
