---
phase: 10-waived-topic-pdf-visibility
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/billing-pdf.tsx
  - app/src/lib/billing-pdf.test.ts
autonomous: true
requirements: [QUICK-10]

must_haves:
  truths:
    - "Topics where ALL line items are EXCLUDED do not appear in the PDF detailed services section"
    - "Topics where ALL line items are EXCLUDED do not appear in the PDF summary of fees"
    - "Topics with at least one visible line item (non-waived or ZERO-waived) still appear normally"
    - "Grand total and retainer calculations remain correct (no change to billing math)"
  artifacts:
    - path: "app/src/lib/billing-pdf.tsx"
      provides: "isTopicVisibleInPdf helper + filtered topic rendering in ServiceDescriptionPDF"
      exports: ["isTopicVisibleInPdf"]
    - path: "app/src/lib/billing-pdf.test.ts"
      provides: "Tests for the new helper and filtering behavior"
  key_links:
    - from: "isTopicVisibleInPdf"
      to: "ServiceDescriptionPDF render"
      via: "filter on data.topics before rendering summary rows and detailed sections"
      pattern: "topics\\.filter.*isTopicVisibleInPdf"
---

<objective>
Hide topics from PDF service descriptions when ALL their line items are waived with EXCLUDED mode (hidden from client).

Purpose: When a topic has all line items waived as EXCLUDED, the topic currently still renders in the PDF with an empty table and header. This looks wrong in client-facing invoices. Topics with no visible content should be omitted entirely.

Output: Updated `billing-pdf.tsx` with filtering logic + tests.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/src/lib/billing-pdf.tsx
@app/src/lib/billing-pdf.test.ts
@app/src/types/index.ts (ServiceDescriptionTopic, ServiceDescriptionLineItem, WaiveMode types)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add isTopicVisibleInPdf helper and filter topics in PDF rendering</name>
  <files>app/src/lib/billing-pdf.tsx</files>
  <action>
Add a new exported helper function `isTopicVisibleInPdf` near the other calculation helpers (after `calculateTopicHours`, around line 371):

```typescript
/**
 * Determines if a topic should be visible in the client-facing PDF.
 * A topic is hidden when ALL its line items are EXCLUDED (not visible to client).
 * Topics with ZERO-waived items still appear (zero-rated but shown).
 * Topics with no line items at all are still shown (e.g., FIXED fee topics with no entries).
 */
export function isTopicVisibleInPdf(topic: ServiceDescription["topics"][0]): boolean {
  if (topic.lineItems.length === 0) return true;
  return topic.lineItems.some((item) => item.waiveMode !== "EXCLUDED");
}
```

Key logic:
- Empty line items array => visible (FIXED fee topics may legitimately have no line items)
- At least one item that is NOT EXCLUDED => visible
- ALL items are EXCLUDED => hidden

Then update the `ServiceDescriptionPDF` component in TWO places:

1. **Summary of Fees** (non-retainer path, ~line 610): Change `{data.topics.map((topic) => (` to filter first:
   ```
   {data.topics.filter(isTopicVisibleInPdf).map((topic) => (
   ```

2. **Detailed Description of Services** (~line 651): Change `{data.topics.map((topic, topicIndex) => {` to filter first:
   ```
   {data.topics.filter(isTopicVisibleInPdf).map((topic, topicIndex) => {
   ```

Do NOT change the `calculateGrandTotal` or `calculateRetainerSummary` functions -- the billing math should remain unchanged. The filtering is purely visual/presentational in the PDF renderer.

Note: The retainer summary section (lines 561-606) does not list individual topics by name, so no change needed there.
  </action>
  <verify>cd /Users/stefan/projects/veda-legal-timesheets/app && npx tsc --noEmit --pretty 2>&1 | head -20</verify>
  <done>New `isTopicVisibleInPdf` function exported, PDF summary and detail sections filter out all-EXCLUDED topics. TypeScript compiles cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Add tests for isTopicVisibleInPdf and verify existing tests still pass</name>
  <files>app/src/lib/billing-pdf.test.ts</files>
  <action>
Add `isTopicVisibleInPdf` to the imports from `./billing-pdf`.

Add a new `describe("isTopicVisibleInPdf", ...)` block using the existing `makeItem` and `makeTopic` helpers:

```typescript
describe("isTopicVisibleInPdf", () => {
  it("returns true for topic with no line items", () => {
    const topic = makeTopic({ lineItems: [] });
    expect(isTopicVisibleInPdf(topic)).toBe(true);
  });

  it("returns true when all items are non-waived", () => {
    const topic = makeTopic({
      lineItems: [makeItem(2, null), makeItem(3, null)],
    });
    expect(isTopicVisibleInPdf(topic)).toBe(true);
  });

  it("returns true when some items are EXCLUDED but at least one is not", () => {
    const topic = makeTopic({
      lineItems: [makeItem(2, null), makeItem(3, "EXCLUDED")],
    });
    expect(isTopicVisibleInPdf(topic)).toBe(true);
  });

  it("returns true when all items are ZERO-waived (shown to client)", () => {
    const topic = makeTopic({
      lineItems: [makeItem(2, "ZERO"), makeItem(3, "ZERO")],
    });
    expect(isTopicVisibleInPdf(topic)).toBe(true);
  });

  it("returns true when mix of ZERO and non-waived", () => {
    const topic = makeTopic({
      lineItems: [makeItem(2, null), makeItem(3, "ZERO")],
    });
    expect(isTopicVisibleInPdf(topic)).toBe(true);
  });

  it("returns false when ALL items are EXCLUDED", () => {
    const topic = makeTopic({
      lineItems: [makeItem(2, "EXCLUDED"), makeItem(3, "EXCLUDED")],
    });
    expect(isTopicVisibleInPdf(topic)).toBe(false);
  });

  it("returns false for single EXCLUDED item", () => {
    const topic = makeTopic({
      lineItems: [makeItem(5, "EXCLUDED")],
    });
    expect(isTopicVisibleInPdf(topic)).toBe(false);
  });

  it("returns true when mix includes EXCLUDED and ZERO", () => {
    const topic = makeTopic({
      lineItems: [makeItem(2, "EXCLUDED"), makeItem(3, "ZERO")],
    });
    expect(isTopicVisibleInPdf(topic)).toBe(true);
  });
});
```

All 8 test cases cover the critical boundary conditions:
- Empty topics (FIXED fee edge case)
- All non-waived (normal case)
- Mixed waive modes
- All EXCLUDED (the bug case)
- ZERO vs EXCLUDED distinction (ZERO items ARE visible to client)
  </action>
  <verify>cd /Users/stefan/projects/veda-legal-timesheets/app && npx vitest run src/lib/billing-pdf.test.ts 2>&1</verify>
  <done>All existing billing-pdf tests pass. New isTopicVisibleInPdf tests pass: 8 cases covering empty, non-waived, mixed, all-EXCLUDED, and ZERO edge cases.</done>
</task>

</tasks>

<verification>
```bash
cd /Users/stefan/projects/veda-legal-timesheets/app && npx vitest run src/lib/billing-pdf.test.ts && npx tsc --noEmit --pretty
```
All billing PDF tests pass and TypeScript compiles without errors.
</verification>

<success_criteria>
- `isTopicVisibleInPdf` function is exported and tested with 8 test cases
- PDF summary section (non-retainer) filters out all-EXCLUDED topics
- PDF detailed section filters out all-EXCLUDED topics
- Topics with ZERO-waived items still render (they are shown to client with "(Waived)")
- Billing calculation functions (calculateGrandTotal, calculateRetainerSummary, etc.) are NOT modified
- All existing tests continue to pass
</success_criteria>

<output>
After completion, create `.planning/quick/10-when-all-line-items-are-waived-and-not-v/10-SUMMARY.md`
</output>
