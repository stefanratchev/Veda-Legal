---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/reports/DetailTab.tsx
  - app/src/components/reports/DetailTab.test.tsx
autonomous: true
requirements: [QUICK-7]
must_haves:
  truths:
    - "Small datasets (1-5 bars) produce proportionally small charts instead of a fixed 256px block"
    - "Charts with enough bars still grow linearly at 22px per bar"
    - "A chart with very few bars (e.g. 1-2) still has enough space for axes and labels (120px minimum)"
  artifacts:
    - path: "app/src/components/reports/DetailTab.tsx"
      provides: "getChartHeight with 120px minimum instead of 256px"
      contains: "Math.max(120,"
    - path: "app/src/components/reports/DetailTab.test.tsx"
      provides: "Updated test assertions matching new 120px minimum"
  key_links:
    - from: "app/src/components/reports/DetailTab.tsx"
      to: "chart container div style"
      via: "getChartHeight return value sets inline style height"
      pattern: "style=.*height.*getChartHeight"
---

<objective>
Lower the minimum chart height from 256px to 120px in `getChartHeight` so small datasets render proportionally thin charts (consistent bar thickness) rather than having excessive whitespace.

Purpose: Charts with 2-3 bars currently get 256px of height, making bars disproportionately thick compared to charts with 15+ bars. A 120px minimum preserves enough space for Recharts axes/labels/padding while letting small charts scale down.

Output: Updated `getChartHeight` function and passing tests.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/src/components/reports/DetailTab.tsx
@app/src/components/reports/DetailTab.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Lower getChartHeight minimum and update tests</name>
  <files>
    app/src/components/reports/DetailTab.tsx
    app/src/components/reports/DetailTab.test.tsx
  </files>
  <action>
In `app/src/components/reports/DetailTab.tsx` (lines 33-40):

1. Update the JSDoc comment on `getChartHeight` — change the line "minimum height is 256px (equivalent to h-64)" to "minimum height is 120px to ensure axes and labels render properly".

2. Change line 39 from:
   `return Math.max(256, effectiveBars * 22);`
   to:
   `return Math.max(120, effectiveBars * 22);`

In `app/src/components/reports/DetailTab.test.tsx`, update the "Dynamic Chart Heights" describe block:

1. Test "small datasets use 256px minimum height" (line 387-394):
   - Rename to "small datasets use 120px minimum height"
   - Update comment: 3 unique clients => Math.max(120, 3*22) = Math.max(120, 66) = 120
   - Change expected value from "256px" to "120px"

2. Test "each chart computes height from its own data length" (line 396-410):
   - Update all comments and assertions:
     - 3 clients: Math.max(120, 3*22=66) = 120 => expect "120px"
     - 2 employees: Math.max(120, 2*22=44) = 120 => expect "120px"
     - 3 topics: Math.max(120, 3*22=66) = 120 => expect "120px"

3. Test "large dataset grows chart container taller" (line 412-433):
   - Update comment: 15 clients => Math.max(120, 15*22=330) = 330 (no change to expected value, still "330px")

4. Test "dataset exceeding maxBars accounts for 'Other' grouping bar" (line 435-457):
   - Update comment: height = Math.max(120, 21*22=462) = 462 (no change to expected value, still "462px")
  </action>
  <verify>
    <automated>cd /Users/stefan/projects/veda-legal-timesheets/app && npx vitest run src/components/reports/DetailTab.test.tsx</automated>
  </verify>
  <done>
    - getChartHeight returns Math.max(120, effectiveBars * 22) instead of Math.max(256, ...)
    - JSDoc reflects new 120px minimum
    - All DetailTab tests pass with updated assertions
    - A 3-bar chart gets 120px height (not 256px), a 15-bar chart still gets 330px
  </done>
</task>

</tasks>

<verification>
- `cd app && npx vitest run src/components/reports/DetailTab.test.tsx` — all tests pass
- `cd app && npm run build` — no type errors or build failures
</verification>

<success_criteria>
- getChartHeight(3) returns 120 (was 256)
- getChartHeight(6) returns 132 (6*22, now exceeds minimum)
- getChartHeight(15) returns 330 (unchanged)
- getChartHeight(25) returns 462 (unchanged)
- All existing tests pass with updated expectations
</success_criteria>

<output>
After completion, create `.planning/quick/7-remove-256px-minimum-from-getchartheight/7-SUMMARY.md`
</output>
