---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/reports/DetailTab.tsx
  - app/src/components/reports/charts/RevenueBarChart.tsx
  - app/src/components/reports/charts/RevenueBarChart.test.tsx
  - app/src/components/reports/charts/BarChart.tsx
autonomous: true
requirements: [QUICK-5]

must_haves:
  truths:
    - "Detail tab charts show top 20 entries before grouping remainder as Other"
    - "Default maxBars for RevenueBarChart is 20"
    - "BAR_COLORS arrays have 20 distinct colors so bars are visually distinguishable"
    - "All existing tests pass with updated assertions"
  artifacts:
    - path: "app/src/components/reports/DetailTab.tsx"
      provides: "All 6 chart instances pass maxBars={20}"
      contains: "maxBars={20}"
    - path: "app/src/components/reports/charts/RevenueBarChart.tsx"
      provides: "Default maxBars changed to 20, 20-color palette"
      contains: "maxBars: number = 20"
    - path: "app/src/components/reports/charts/BarChart.tsx"
      provides: "20-color palette matching RevenueBarChart"
    - path: "app/src/components/reports/charts/RevenueBarChart.test.tsx"
      provides: "Updated test assertions for top 20 threshold"
  key_links: []
---

<objective>
Change report detail view charts from showing top 10 items (with remainder grouped as "Other") to showing top 20 items before grouping.

Purpose: With ~200 clients and multiple topics, top 10 groups too many entries into "Other", losing useful detail. Top 20 gives partners better visibility into the long tail.
Output: Updated chart components, call sites, color palettes, and tests.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/src/components/reports/DetailTab.tsx
@app/src/components/reports/charts/RevenueBarChart.tsx
@app/src/components/reports/charts/RevenueBarChart.test.tsx
@app/src/components/reports/charts/BarChart.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Change top-N threshold from 10 to 20 and expand color palettes</name>
  <files>
    app/src/components/reports/DetailTab.tsx
    app/src/components/reports/charts/RevenueBarChart.tsx
    app/src/components/reports/charts/BarChart.tsx
    app/src/components/reports/charts/RevenueBarChart.test.tsx
  </files>
  <action>
1. **RevenueBarChart.tsx** -- Change the two default values from 10 to 20:
   - `prepareRevenueData(data, maxBars: number = 20)` (line 111)
   - `maxBars = 20` in the component destructuring (line 242)
   - Expand the `BAR_COLORS` array from 10 to 20 distinct colors. Keep the existing 10, add 10 more that are visually distinguishable in a dark theme. Suggested additions (indices 10-19):
     ```
     "#E879F9", // fuchsia
     "#34D399", // emerald
     "#FBBF24", // yellow
     "#818CF8", // indigo
     "#F87171", // red
     "#2DD4BF", // teal-light
     "#A78BFA", // violet
     "#FCA5A1", // rose
     "#67E8F9", // cyan
     "#BEF264", // lime-light
     ```

2. **BarChart.tsx** -- Expand `BAR_COLORS` to the same 20 colors (keep both files consistent).

3. **DetailTab.tsx** -- Change all 6 instances of `maxBars={10}` to `maxBars={20}`:
   - Line 384: BarChart (Hours by Client)
   - Line 396: RevenueBarChart (Revenue by Client)
   - Line 415: BarChart (Hours by Employee)
   - Line 427: RevenueBarChart (Revenue by Employee)
   - Line 446: BarChart (Hours by Topic)
   - Line 458: RevenueBarChart (Revenue by Topic)

4. **RevenueBarChart.test.tsx** -- Update the `prepareRevenueData` tests:
   - "returns top 10 when more than 10 items" -> "returns top 20 when more than 20 items": generate 25 items, expect result length 21 (20 + Other)
   - 'aggregates items beyond top 10 into "Other"' -> generate 22 items, verify Other sums the bottom 2
   - '"Other" has no id field' -> generate 22 items instead of 12
   - 'returns all items when fewer than 10 (no "Other")' -> change description to "fewer than 20", keep 5 items (still fewer than 20, test still valid as-is -- just update the description string)

NOTE: Do NOT change OverviewTab.tsx -- it already uses maxBars={15} which is a separate, intentional value for that view.
  </action>
  <verify>
    <automated>cd /Users/stefan/projects/veda-legal-timesheets/app && npx vitest run src/components/reports/charts/RevenueBarChart.test.tsx src/components/reports/charts/BarChart.test.tsx src/components/reports/DetailTab.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
    <manual>Verify DetailTab.tsx has no remaining maxBars={10} references</manual>
  </verify>
  <done>
    - All 6 DetailTab chart instances use maxBars={20}
    - RevenueBarChart defaults to maxBars=20
    - Both BAR_COLORS arrays have 20 distinct entries
    - All test assertions updated and passing for the 20-item threshold
    - OverviewTab.tsx unchanged (keeps maxBars={15})
  </done>
</task>

</tasks>

<verification>
- `cd app && npx vitest run --reporter=verbose 2>&1 | tail -10` -- all tests pass
- `grep -n "maxBars={10}" app/src/components/reports/DetailTab.tsx` -- returns no matches
- `grep -c "maxBars={20}" app/src/components/reports/DetailTab.tsx` -- returns 6
</verification>

<success_criteria>
Detail tab charts display top 20 entries before grouping remainder as "Other". All tests pass. Color palettes expanded so 20 bars are visually distinguishable.
</success_criteria>

<output>
After completion, create `.planning/quick/5-change-report-detail-charts-from-top-10-/5-SUMMARY.md`
</output>
