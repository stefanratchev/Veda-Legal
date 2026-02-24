---
phase: 02-overview-revenue-charts
plan: 01
subsystem: ui
tags: [recharts, bar-chart, eur-formatting, revenue, css-variables]

# Dependency graph
requires:
  - phase: 01-data-layer
    provides: API returns per-client and per-employee revenue fields
provides:
  - RevenueBarChart component with vertical bars, EUR formatting, top-10 grouping, comparison badges
  - formatEurAbbreviated and formatEurExact utility functions
  - prepareRevenueData and mergeComparisonData data transformation utilities
  - --accent-revenue (#4ECDC4) CSS variable in design system
affects: [02-overview-revenue-charts]

# Tech tracking
tech-stack:
  added: []
  patterns: [vertical-bar-chart-with-label-list, eur-abbreviation-formatting, top-n-plus-other-grouping]

key-files:
  created:
    - app/src/components/reports/charts/RevenueBarChart.tsx
    - app/src/components/reports/charts/RevenueBarChart.test.tsx
  modified:
    - app/src/app/globals.css

key-decisions:
  - "Teal #4ECDC4 chosen as --accent-revenue color (distinct from coral pink hours, complementary in dark theme)"
  - "Intl.NumberFormat instance cached at module level for formatEurExact performance"
  - "LabelList with custom content renderer for per-bar % change badges"

patterns-established:
  - "RevenueBarChart: standalone vertical bar chart with exported pure utility functions for testability"
  - "EUR formatting: formatEurAbbreviated for axis labels (EUR 12.5K), formatEurExact for tooltips (EUR 12,450)"
  - "Data transformation: prepareRevenueData (top-N + Other) and mergeComparisonData (% change via id-based Map lookup)"

requirements-completed: [REV-01, REV-02]

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 2 Plan 1: Revenue Bar Chart Component Summary

**Standalone RevenueBarChart with teal vertical bars, EUR-abbreviated axis labels, top-10 + "Other" grouping, custom tooltip, and per-bar comparison % change badges**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T12:39:12Z
- **Completed:** 2026-02-24T12:41:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created RevenueBarChart component with vertical bar layout, teal accent color, and rounded top corners
- Implemented EUR formatting utilities: abbreviated (EUR 12.5K) for axis labels and exact (EUR 12,450) for tooltips
- Built data transformation pipeline: top-10 grouping with "Other" aggregation, comparison % change via id-based Map lookup
- Added per-bar LabelList badges showing green/red % change text above bars
- Custom tooltip showing item name, exact EUR amount, and % change
- Added --accent-revenue and --accent-revenue-dim CSS variables to design system
- 32 comprehensive unit tests covering formatters, data transformation, comparison logic, and rendering

## Task Commits

Each task was committed atomically:

1. **Task 1: Add --accent-revenue CSS variable and create RevenueBarChart component** - `348c262` (feat)
2. **Task 2: Write unit tests for RevenueBarChart** - `05b1e4d` (test)

## Files Created/Modified
- `app/src/components/reports/charts/RevenueBarChart.tsx` - Vertical bar chart component with EUR formatting, top-10 grouping, comparison badges, custom tooltip
- `app/src/components/reports/charts/RevenueBarChart.test.tsx` - 32 unit tests for formatters, data transformation, comparison logic, rendering
- `app/src/app/globals.css` - Added --accent-revenue (#4ECDC4) and --accent-revenue-dim (#3BA89F) CSS variables with Tailwind theme entries

## Decisions Made
- Used teal #4ECDC4 as revenue accent color (distinct from coral pink #FF9999 for hours, visually associated with money/finance)
- Cached Intl.NumberFormat instance at module level rather than recreating per call for formatEurExact
- Used Recharts LabelList with custom content renderer for per-bar % change badges (cleaner than custom Bar label prop)
- Exported all utility functions directly for unit testing without component rendering overhead

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RevenueBarChart component ready for integration into OverviewTab (Plan 02)
- All exported utilities (prepareRevenueData, mergeComparisonData, formatEurAbbreviated, formatEurExact) available for direct import
- CSS variable --accent-revenue available for Tailwind utility classes (accent-revenue)

## Self-Check: PASSED

- FOUND: app/src/components/reports/charts/RevenueBarChart.tsx
- FOUND: app/src/components/reports/charts/RevenueBarChart.test.tsx
- FOUND: .planning/phases/02-overview-revenue-charts/02-01-SUMMARY.md
- FOUND: 348c262 (Task 1 commit)
- FOUND: 05b1e4d (Task 2 commit)

---
*Phase: 02-overview-revenue-charts*
*Completed: 2026-02-24*
