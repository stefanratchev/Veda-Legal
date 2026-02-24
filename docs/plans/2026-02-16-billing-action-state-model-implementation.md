# Billing Action State Model Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace per-row hide/waive/delete controls with one `Billing action` modal that applies `Bill later`, `Mark as billed`, `Waive (show at €0)`, or `Regular billing` and enforces correct totals/PDF behavior.

**Architecture:** Introduce one mutually exclusive billing state on each service-description line item and route all row outcomes through it. Update row UI to a single action launcher + status badges, update API validation/serialization for new states, and update calculation/PDF filters so `Bill later` and `Mark as billed` are hidden from invoice output while `Waive` stays visible at €0.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, Drizzle ORM/Postgres.

---

### Task 1: Define billing state type and serialization expectations

**Files:**
- Modify: `app/src/types/index.ts`
- Modify: `app/src/lib/billing-utils.ts`
- Test: `app/src/app/api/billing/[id]/route.test.ts`

**Step 1: Write failing API/type tests**
- Add assertions that line-item response supports `BILL_LATER`, `MARK_BILLED`, `WAIVE_ZERO`, `null`.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/app/api/billing/[id]/route.test.ts`
Expected: FAIL because current types/serialization only handle `EXCLUDED` / `ZERO`.

**Step 3: Write minimal implementation**
- Update shared type(s) to represent new billing state values.
- Update serialization helpers so API responses emit new states consistently.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/app/api/billing/[id]/route.test.ts`
Expected: PASS.

### Task 2: Update line-item PATCH endpoint validation for new states

**Files:**
- Modify: `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts`
- Test: `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.test.ts`

**Step 1: Write failing endpoint tests**
- Add/update tests for accepted values: `BILL_LATER`, `MARK_BILLED`, `WAIVE_ZERO`, `null`.
- Add/update test rejecting legacy/unknown values.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.test.ts`
Expected: FAIL due to old enum validation.

**Step 3: Write minimal implementation**
- Replace current waive validation with billing-state validation.
- Persist selected billing state in update payload and response.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.test.ts`
Expected: PASS.

### Task 3: Update totals and unbilled-summary filtering rules

**Files:**
- Modify: `app/src/components/billing/TopicSection.tsx`
- Modify: `app/src/app/api/billing/unbilled-summary/route.ts`
- Modify: `app/src/app/api/billing/route.ts`
- Test: `app/src/app/api/billing/unbilled-summary/route.test.ts`

**Step 1: Write failing behavior tests**
- Add tests verifying:
  - `BILL_LATER` is excluded from current SD totals.
  - `MARK_BILLED` is excluded from unbilled summary.
  - `BILL_LATER` is not permanently excluded from future unbilled pool logic.

**Step 2: Run tests to verify failure**
Run: `npm test -- src/app/api/billing/unbilled-summary/route.test.ts`
Expected: FAIL with old `waiveMode !== null` assumptions.

**Step 3: Write minimal implementation**
- Update calculations and query filters by explicit state values.
- Keep semantics:
  - `BILL_LATER` excluded from invoice totals/PDF now.
  - `MARK_BILLED` treated as already billed.
  - `WAIVE_ZERO` billed as €0 and shown in PDF.

**Step 4: Run tests to verify pass**
Run: `npm test -- src/app/api/billing/unbilled-summary/route.test.ts`
Expected: PASS.

### Task 4: Replace row controls with one Billing action modal

**Files:**
- Modify: `app/src/components/billing/LineItemRow.tsx`
- Modify: `app/src/components/billing/TopicSection.tsx`
- Modify: `app/src/components/billing/ServiceDescriptionDetail.tsx`
- Test: `app/src/components/billing/LineItemRow.test.tsx`

**Step 1: Write failing UI tests**
- Assert only one action trigger (`Billing action`) appears.
- Assert modal shows four options (`Bill later`, `Mark as billed`, `Waive (show at €0)`, `Regular billing`).
- Assert selecting each option calls update handler with mapped state.
- Assert row badges match selected state.

**Step 2: Run test to verify failure**
Run: `npm test -- src/components/billing/LineItemRow.test.tsx`
Expected: FAIL due to existing two-button UI.

**Step 3: Write minimal implementation**
- Replace inline Exclude/$0 buttons and delete icon with one modal-driven action flow.
- Wire selection to `onWaive` successor callback (rename to billing-state callback if needed).
- Render state badges on row.

**Step 4: Run test to verify pass**
Run: `npm test -- src/components/billing/LineItemRow.test.tsx`
Expected: PASS.

### Task 5: Update PDF rendering rules for visibility and €0 semantics

**Files:**
- Modify: `app/src/lib/billing-pdf.tsx`
- Test: `app/src/lib/billing-pdf.test.ts`

**Step 1: Write failing PDF tests**
- Assert `BILL_LATER` and `MARK_BILLED` rows do not render in PDF.
- Assert `WAIVE_ZERO` rows render with €0 outcome.

**Step 2: Run test to verify failure**
Run: `npm test -- src/lib/billing-pdf.test.ts`
Expected: FAIL until filter and display logic are updated.

**Step 3: Write minimal implementation**
- Adjust line-item filtering and display mapping in PDF generation.

**Step 4: Run test to verify pass**
Run: `npm test -- src/lib/billing-pdf.test.ts`
Expected: PASS.

### Task 6: Final verification sweep

**Files:**
- Test: `app/src/components/billing/ServiceDescriptionDetail.test.tsx`
- Test: `app/src/components/billing/LineItemRow.test.tsx`
- Test: `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.test.ts`
- Test: `app/src/app/api/billing/unbilled-summary/route.test.ts`
- Test: `app/src/lib/billing-pdf.test.ts`

**Step 1: Run focused suite**
Run: `npm test -- src/components/billing/ServiceDescriptionDetail.test.tsx src/components/billing/LineItemRow.test.tsx src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.test.ts src/app/api/billing/unbilled-summary/route.test.ts src/lib/billing-pdf.test.ts`
Expected: all pass.

**Step 2: Run broader confidence pass**
Run: `npm test -- src/components/billing`
Expected: pass.

**Step 3: Commit**
```bash
git add app/src/types/index.ts app/src/lib/billing-utils.ts app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.test.ts app/src/app/api/billing/unbilled-summary/route.ts app/src/app/api/billing/unbilled-summary/route.test.ts app/src/components/billing/LineItemRow.tsx app/src/components/billing/LineItemRow.test.tsx app/src/components/billing/ServiceDescriptionDetail.tsx app/src/components/billing/TopicSection.tsx app/src/lib/billing-pdf.tsx app/src/lib/billing-pdf.test.ts docs/plans/2026-02-16-billing-action-state-model-design.md docs/plans/2026-02-16-billing-action-state-model-implementation.md
git commit -m "feat(billing): unify line-item billing actions via modal state model"
```
