---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/billing-pdf.tsx
  - app/src/lib/billing-pdf.test.ts
autonomous: true
requirements: [QUICK-9]

must_haves:
  truths:
    - "Retainer PDF summary shows 'Monthly Retainer' line with the retainer fee amount"
    - "Retainer PDF summary shows hours included vs hours used"
    - "Retainer PDF summary shows overage breakdown with hours, rate, and total amount when overage exists"
    - "Non-retainer PDF summary is unchanged"
  artifacts:
    - path: "app/src/lib/billing-pdf.tsx"
      provides: "Updated retainer summary section in ServiceDescriptionPDF component"
      contains: "Monthly Retainer"
    - path: "app/src/lib/billing-pdf.test.ts"
      provides: "Tests for retainer calculation logic"
      contains: "calculateRetainerSummary"
  key_links:
    - from: "app/src/lib/billing-pdf.tsx"
      to: "calculateRetainerSummary"
      via: "function call for retainer data"
      pattern: "calculateRetainerSummary"
---

<objective>
Update the retainer client PDF service description summary section to clearly display the retainer hours allocation and usage breakdown.

Purpose: Make retainer PDF invoices show a clear summary of monthly retainer fee, hours included vs used, and any overage charges with rate and amount.
Output: Updated PDF rendering in billing-pdf.tsx with matching test coverage.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@app/src/lib/billing-pdf.tsx (PDF rendering + billing calculations)
@app/src/lib/billing-pdf.test.ts (existing tests for billing calculations)

<interfaces>
From app/src/lib/billing-pdf.tsx:
```typescript
export interface RetainerSummary {
  totalHourlyHours: number;
  retainerHours: number;
  retainerFee: number;
  overageHours: number;
  overageRate: number;
  overageAmount: number;
  fixedTopicFees: number;
  subtotal: number;
  grandTotal: number;
}

export function calculateRetainerSummary(
  topics: ServiceDescription["topics"],
  retainerFee: number,
  retainerHours: number,
  overageRate: number,
  discountType: "PERCENTAGE" | "AMOUNT" | null,
  discountValue: number | null,
): RetainerSummary;

export function formatCurrency(amount: number): string;
export function formatHours(hours: number): string; // from date-utils
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update retainer PDF summary section layout</name>
  <files>app/src/lib/billing-pdf.tsx</files>
  <action>
Modify the retainer branch of the "Summary of Fees" section in the `ServiceDescriptionPDF` component (currently lines ~561-614). The current implementation already has retainer summary lines but needs to be restructured to match the desired format.

Update the retainer summary section to show these lines in order:

1. **Monthly Retainer** line: Left side shows "Monthly Retainer" text, right side shows the retainer fee amount (e.g., "EUR 1,000.00"). Remove the "(Xh hrs included)" from this line — hours info moves to the next line.

2. **Included Hours** line: Left side shows "Included Hours: {retainerHours}" (using formatHours), right side is blank. This replaces the old "Hours Used: X of Y" line.

3. **Hours Used** line: Left side shows "Hours Used: {totalHourlyHours}" (using formatHours), right side is blank.

4. **Overage** line (conditional — only when `retainerSummary.overageHours > 0`): Left side shows "Overage: {overageHours} at {overageRate}/hr" (using formatHours for hours and formatCurrency for rate). Right side shows the overage amount (using formatCurrency).

5. **Fixed Fees** line (conditional — only when `retainerSummary.fixedTopicFees > 0`): Keep as-is.

6. **Discount lines** (conditional — only when hasOverallDiscount): Keep the existing subtotal + discount rendering as-is.

The Total Fees row at the bottom remains unchanged.

Keep all existing styles (summaryRow, summaryTopic, summaryAmount). No new styles needed — the layout uses the same row pattern. The non-retainer branch (lines 617-646) must remain completely unchanged.
  </action>
  <verify>cd /Users/stefan/projects/veda-legal-timesheets/app && npx tsc --noEmit --pretty 2>&1 | head -20</verify>
  <done>Retainer PDF summary section renders: (1) Monthly Retainer + amount, (2) Included Hours, (3) Hours Used, (4) Overage with hours/rate/amount when applicable. TypeScript compiles without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Run existing tests to verify no regressions</name>
  <files>app/src/lib/billing-pdf.test.ts</files>
  <action>
Run the existing billing-pdf test suite to ensure the calculation functions (calculateRetainerSummary, calculateRetainerGrandTotal, calculateTopicTotal, etc.) still pass. The PDF rendering changes are in JSX only and don't affect calculation logic, so existing tests should pass unchanged.

If any tests fail, investigate and fix. The calculation functions must not be modified — only the JSX rendering in the ServiceDescriptionPDF component changes.

No new tests are needed because the changes are purely presentational (JSX layout within the React PDF component). The existing 50+ tests cover all calculation edge cases including retainer scenarios with overage, waived items, discounts, and mixed hourly/fixed topics.
  </action>
  <verify>cd /Users/stefan/projects/veda-legal-timesheets/app && npx vitest run billing-pdf --reporter=verbose 2>&1 | tail -30</verify>
  <done>All existing billing-pdf tests pass with zero failures. No calculation regressions introduced.</done>
</task>

</tasks>

<verification>
1. TypeScript compilation passes: `cd app && npx tsc --noEmit`
2. All billing-pdf tests pass: `cd app && npx vitest run billing-pdf`
3. Build succeeds: `cd app && npm run build` (confirms PDF rendering compiles for production)
</verification>

<success_criteria>
- Retainer PDF summary section displays Monthly Retainer fee, Included Hours, Hours Used, and conditional Overage breakdown
- Non-retainer PDF summary section is completely unchanged
- All existing billing-pdf tests pass
- TypeScript compiles without errors
- Production build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/9-update-retainer-pdf-service-descriptions/9-SUMMARY.md`
</output>
