---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/reports/DetailTab.tsx
  - app/src/components/reports/DetailTab.test.tsx
autonomous: true
requirements: [QUICK-6]

must_haves:
  truths:
    - "Charts with few bars (e.g. 3) remain at 256px minimum height"
    - "Charts with many bars (e.g. 20) grow taller so bars are not cramped"
    - "Height is computed per-chart based on its own data length, not a shared value"
  artifacts:
    - path: "app/src/components/reports/DetailTab.tsx"
      provides: "Dynamic chart container heights based on bar count"
      contains: "Math.max(256"
  key_links:
    - from: "DetailTab.tsx chart container div"
      to: "chart data array .length"
      via: "inline style={{ height }} replacing className h-64"
      pattern: "style=.*height.*Math\\.max"
---

<objective>
Replace fixed `h-64` (256px) chart containers in DetailTab.tsx with dynamic heights computed from bar count using `Math.max(256, effectiveBarCount * 22)`.

Purpose: Charts with 20 bars are currently cramped at 256px. Dynamic height ensures each bar has ~22px of space, scaling the container as data grows while maintaining a 256px minimum for small datasets.
Output: Updated DetailTab.tsx with dynamic chart heights, updated tests verifying the behavior.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/src/components/reports/DetailTab.tsx
@app/src/components/reports/DetailTab.test.tsx
@app/src/components/reports/charts/BarChart.tsx (prepareBarData export, maxBars grouping logic)
@app/src/components/reports/charts/RevenueBarChart.tsx (prepareRevenueData export, maxBars grouping logic)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add dynamic chart height helper and replace fixed h-64 containers</name>
  <files>app/src/components/reports/DetailTab.tsx</files>
  <action>
1. Add a helper function at the top of the file (below the existing helper functions, above the component):

```ts
/**
 * Compute chart container height based on number of data items.
 * After maxBars grouping, effective bar count = min(dataLength, maxBars) + 1 if overflow exists.
 * Each bar gets 22px; minimum height is 256px (equivalent to h-64).
 */
function getChartHeight(dataLength: number, maxBars: number = 20): number {
  const effectiveBars = Math.min(dataLength, maxBars) + (dataLength > maxBars ? 1 : 0);
  return Math.max(256, effectiveBars * 22);
}
```

2. Replace all 6 instances of `<div className="h-64">` wrapping chart components with `<div style={{ height: getChartHeight(DATA.length) }}>` where DATA is the specific data array for that chart:

   - Hours by Client: `getChartHeight(clientHoursData.length)`
   - Revenue by Client: `getChartHeight(clientRevenueData.length)`
   - Hours by Employee: `getChartHeight(employeeHoursData.length)`
   - Revenue by Employee: `getChartHeight(employeeRevenueData.length)`
   - Hours by Topic: `getChartHeight(topicHoursData.length)`
   - Revenue by Topic: `getChartHeight(topicRevenueData.length)`

3. Each div changes from:
   `<div className="h-64">`
   to:
   `<div style={{ height: getChartHeight(someData.length) }}>`

Note: The revenue data arrays already filter out zero/null values (lines 158-176), so their length accurately represents the number of bars that will render.
  </action>
  <verify>
    <automated>cd /Users/stefan/projects/veda-legal-timesheets/app && npx vitest run src/components/reports/DetailTab.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
    <manual>Verify no h-64 class remains on chart container divs in DetailTab.tsx</manual>
  </verify>
  <done>All 6 chart container divs use dynamic inline height via getChartHeight() instead of fixed h-64. Charts with 3 bars get 256px (minimum), charts with 20 bars get 440px (20*22).</done>
</task>

<task type="auto">
  <name>Task 2: Add test coverage for dynamic chart heights</name>
  <files>app/src/components/reports/DetailTab.test.tsx</files>
  <action>
Add a new describe block "Dynamic Chart Heights" in the existing test file with these tests:

1. **Test getChartHeight logic directly** -- Export `getChartHeight` from DetailTab (or test it indirectly through rendered output).

   Since exporting a helper from a component file is slightly unusual, test indirectly: render DetailTab with a known number of entries and verify the chart container divs have the expected `style` attribute with the computed height.

2. **Charts use inline style height instead of h-64 class:**
   - Render `<DetailTab entries={entries} isAdmin={true} />` (the existing 4-entry test data produces 3 unique clients, 2 unique employees, 3 unique topics)
   - Query all chart heading elements ("Hours by Client", etc.) and for each, check that the sibling/child chart container div has a `style` attribute containing `height`
   - Verify none of the chart containers have `className` containing `h-64`

3. **Small data uses minimum height (256px):**
   - With the existing 4 entries: 3 clients => `Math.max(256, 3*22) = 256` (minimum applies)
   - Find the "Hours by Client" heading, traverse to its sibling chart div, assert `style.height` is `256px`

4. **Large data grows taller:**
   - Create an entries array with 15+ unique clients (so clientHoursData has 15 items)
   - 15 bars => `Math.max(256, 15*22) = 330`
   - Render and assert the "Hours by Client" chart container has `style.height` of `330px`

Use this pattern to find chart containers: find the heading text node, go to its parent card div (the `bg-[var(--bg-elevated)]` div), then query for the child div with the `style` attribute. The structure is: card div > h3 (heading) + div[style] (chart container).
  </action>
  <verify>
    <automated>cd /Users/stefan/projects/veda-legal-timesheets/app && npx vitest run src/components/reports/DetailTab.test.tsx --reporter=verbose 2>&1 | tail -40</automated>
  </verify>
  <done>Tests verify that (a) chart containers use inline height style instead of h-64, (b) small datasets get 256px minimum, (c) larger datasets get proportionally taller containers.</done>
</task>

</tasks>

<verification>
- `cd /Users/stefan/projects/veda-legal-timesheets/app && npx vitest run src/components/reports/DetailTab.test.tsx --reporter=verbose` -- all tests pass
- `cd /Users/stefan/projects/veda-legal-timesheets/app && npm run lint` -- no lint errors
- No remaining `h-64` class on chart container divs in DetailTab.tsx (grep confirms)
- `npm run build` in app/ succeeds (TypeScript compilation)
</verification>

<success_criteria>
- All 6 chart containers in DetailTab.tsx use dynamic height based on their data array length
- Minimum height is 256px (same as previous h-64)
- Charts with 20 bars get 440px height (20 * 22px per bar)
- Existing tests continue to pass
- New tests verify height behavior for both small and large datasets
</success_criteria>

<output>
After completion, create `.planning/quick/6-dynamic-chart-height-based-on-bar-count-/6-SUMMARY.md`
</output>
