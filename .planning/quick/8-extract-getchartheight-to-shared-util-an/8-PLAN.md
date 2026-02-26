---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/chart-utils.ts
  - app/src/lib/chart-utils.test.ts
  - app/src/components/reports/DetailTab.tsx
  - app/src/components/reports/OverviewTab.tsx
autonomous: true
requirements: [QUICK-8]

must_haves:
  truths:
    - "getChartHeight is importable from a shared utility module"
    - "DetailTab uses the shared getChartHeight instead of a private copy"
    - "OverviewTab charts size dynamically based on data length instead of fixed Tailwind classes"
    - "All existing tests pass without modification"
  artifacts:
    - path: "app/src/lib/chart-utils.ts"
      provides: "Exported getChartHeight utility"
      exports: ["getChartHeight"]
    - path: "app/src/lib/chart-utils.test.ts"
      provides: "Unit tests for getChartHeight"
  key_links:
    - from: "app/src/components/reports/DetailTab.tsx"
      to: "app/src/lib/chart-utils.ts"
      via: "named import"
      pattern: "import.*getChartHeight.*from.*chart-utils"
    - from: "app/src/components/reports/OverviewTab.tsx"
      to: "app/src/lib/chart-utils.ts"
      via: "named import"
      pattern: "import.*getChartHeight.*from.*chart-utils"
---

<objective>
Extract the private `getChartHeight` function from DetailTab into a shared utility (`lib/chart-utils.ts`), then apply it to OverviewTab so all report charts use consistent dynamic sizing.

Purpose: Eliminate code duplication and give OverviewTab charts the same adaptive height behavior that DetailTab already has.
Output: Shared chart utility with tests, both tabs importing from it, OverviewTab using dynamic heights.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/src/lib/chart-utils.ts (will be created)
@app/src/components/reports/DetailTab.tsx
@app/src/components/reports/OverviewTab.tsx
@app/src/components/reports/DetailTab.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract getChartHeight to shared utility and add tests</name>
  <files>
    app/src/lib/chart-utils.ts
    app/src/lib/chart-utils.test.ts
    app/src/components/reports/DetailTab.tsx
  </files>
  <action>
    1. Create `app/src/lib/chart-utils.ts` with the exported `getChartHeight` function. Copy the exact implementation and JSDoc from DetailTab.tsx (lines 32-40):
       ```ts
       /**
        * Compute chart container height based on number of data items.
        * After maxBars grouping, effective bar count = min(dataLength, maxBars) + 1 if overflow exists.
        * Each bar gets 22px; minimum height is 120px to ensure axes and labels render properly.
        */
       export function getChartHeight(dataLength: number, maxBars: number = 20): number {
         const effectiveBars = Math.min(dataLength, maxBars) + (dataLength > maxBars ? 1 : 0);
         return Math.max(120, effectiveBars * 22);
       }
       ```

    2. Create `app/src/lib/chart-utils.test.ts` with unit tests covering:
       - Returns 120px minimum for small datasets (0, 1, 5 items)
       - Scales linearly at 22px per bar (e.g., 10 items => 220px, 15 items => 330px)
       - Accounts for "Other" grouping bar when dataLength exceeds maxBars (e.g., 25 items with maxBars=20 => 21*22=462px)
       - Respects custom maxBars parameter (e.g., 18 items with maxBars=15 => 16*22=352px)
       - Edge case: dataLength exactly equals maxBars (no "Other" bar added)
       - Edge case: dataLength is 0 => 120px minimum

    3. In `app/src/components/reports/DetailTab.tsx`:
       - Add `import { getChartHeight } from "@/lib/chart-utils";`
       - Remove the private `getChartHeight` function definition (lines 32-40, including JSDoc)
       - Do NOT change any other code — all call sites already use `getChartHeight(data.length)` or `getChartHeight(data.length, maxBars)`
  </action>
  <verify>
    <automated>cd /Users/stefan/projects/veda-legal-timesheets/app && npx vitest run src/lib/chart-utils.test.ts src/components/reports/DetailTab.test.tsx --reporter=verbose 2>&1 | tail -40</automated>
  </verify>
  <done>
    - `chart-utils.ts` exports `getChartHeight` with identical logic
    - `chart-utils.test.ts` has 6+ test cases covering edge cases
    - DetailTab imports from `@/lib/chart-utils` and all existing DetailTab tests pass unchanged
  </done>
</task>

<task type="auto">
  <name>Task 2: Apply dynamic chart heights to OverviewTab</name>
  <files>
    app/src/components/reports/OverviewTab.tsx
  </files>
  <action>
    1. In `app/src/components/reports/OverviewTab.tsx`:
       - Add `import { getChartHeight } from "@/lib/chart-utils";`

    2. Replace the 4 fixed-height chart containers with dynamic heights:

       **Client Hours chart (line 155):** Replace `<div className="h-96">` with:
       `<div style={{ height: getChartHeight(clientChartData.length, 15) }}>`
       (maxBars=15 matches the existing `maxBars={15}` prop on the BarChart)

       **Client Revenue chart (line 170):** Replace `<div className="h-96">` with:
       `<div style={{ height: getChartHeight(clientRevenueData.length, 15) }}>`
       (maxBars=15 matches the existing `maxBars={15}` prop on the RevenueBarChart)

       **Employee Hours chart (line 188):** Replace `<div className="h-64">` with:
       `<div style={{ height: getChartHeight(employeeChartData.length, 20) }}>`
       (Add `maxBars={20}` prop to the BarChart component for consistency)

       **Employee Revenue chart (line 202):** Replace `<div className="h-64">` with:
       `<div style={{ height: getChartHeight(employeeRevenueData.length, 20) }}>`
       (Add `maxBars={20}` prop to the RevenueBarChart component for consistency)

    3. Add `maxBars={20}` prop to the employee BarChart (line 189-194) and employee RevenueBarChart (line 203-206) since they currently have no maxBars — this ensures consistent behavior with getChartHeight's maxBars parameter.

    IMPORTANT: Only change the container div class/style and add maxBars props. Do not alter any other props, structure, or logic.
  </action>
  <verify>
    <automated>cd /Users/stefan/projects/veda-legal-timesheets/app && npx vitest run --reporter=verbose 2>&1 | tail -20</automated>
    <manual>Run `npm run dev` in app/ and navigate to /reports. Verify: (1) Overview tab charts dynamically size based on data — no excessive whitespace for few items, no cramping for many. (2) Detail tab charts still work identically.</manual>
  </verify>
  <done>
    - All 4 OverviewTab chart containers use `style={{ height: getChartHeight(...) }}` instead of fixed Tailwind classes
    - Employee charts have `maxBars={20}` prop matching the getChartHeight parameter
    - Client charts use maxBars=15 matching existing BarChart/RevenueBarChart props
    - All tests pass (including DetailTab tests)
    - No fixed `h-96` or `h-64` classes remain on chart containers in OverviewTab
  </done>
</task>

</tasks>

<verification>
1. `cd app && npx vitest run src/lib/chart-utils.test.ts` — all chart-utils unit tests pass
2. `cd app && npx vitest run src/components/reports/DetailTab.test.tsx` — all existing DetailTab tests pass (no regressions)
3. `cd app && npx vitest run` — full test suite passes
4. `cd app && npm run build` — production build succeeds with no type errors
5. No remaining `h-96` or `h-64` on chart container divs in OverviewTab.tsx
6. No remaining private `getChartHeight` in DetailTab.tsx
</verification>

<success_criteria>
- `getChartHeight` lives in `lib/chart-utils.ts` with dedicated unit tests
- Both DetailTab and OverviewTab import from the shared utility
- OverviewTab charts use dynamic heights (no fixed Tailwind height classes on chart containers)
- All existing tests pass without modification
- Build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/8-extract-getchartheight-to-shared-util-an/8-SUMMARY.md`
</output>
