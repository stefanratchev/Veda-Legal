# Line Item Waive Inline Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace line-item waive dropdown actions with inline single-click `Exclude` and `$0` toggle actions.

**Architecture:** Keep `LineItemRow` as the behavior source for waive controls. Remove local dropdown state and click-outside handling; use deterministic inline button toggles that call existing `onWaive` callback with `EXCLUDED`, `ZERO`, or `null`.

**Tech Stack:** React 19, Next.js 16, Vitest, Testing Library, Tailwind utility classes.

---

### Task 1: Add red tests for inline waive actions

**Files:**
- Create: `app/src/components/billing/LineItemRow.test.tsx`
- Modify: `app/src/components/billing/LineItemRow.tsx` (later task)

**Step 1: Write failing tests**
- Render unwaived row and assert inline `Exclude` and `$0` buttons are visible.
- Click `Exclude` and assert `onWaive(item.id, "EXCLUDED")`.
- Click `$0` and assert `onWaive(item.id, "ZERO")`.
- Render excluded row and click active `Exclude` to assert restore `onWaive(item.id, null)`.
- Render zero row and click active `$0` to assert restore `onWaive(item.id, null)`.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/components/billing/LineItemRow.test.tsx`
Expected: fail until component is updated.

### Task 2: Implement inline action UI in LineItemRow

**Files:**
- Modify: `app/src/components/billing/LineItemRow.tsx`

**Step 1: Remove dropdown state and click-outside hooks**
- Delete `showWaiveMenu`, `waiveMenuRef`, and `useClickOutside` usage.

**Step 2: Add inline toggle buttons**
- Replace dropdown trigger/menu with two inline buttons (`Exclude`, `$0`).
- Set `aria-pressed` based on current waive mode.
- Route clicks through `handleWaive`:
  - `Exclude`: call `handleWaive(isExcluded ? null : "EXCLUDED")`
  - `$0`: call `handleWaive(isZero ? null : "ZERO")`

**Step 3: Preserve existing row visuals and delete behavior**
- Keep excluded/waived text styles and delete button behavior.

### Task 3: Verify

**Files:**
- Test: `app/src/components/billing/LineItemRow.test.tsx`

**Step 1: Run focused tests**
Run: `npm test -- src/components/billing/LineItemRow.test.tsx`
Expected: pass.

**Step 2: Run related billing tests (optional confidence pass)**
Run: `npm test -- src/components/billing/ServiceDescriptionDetail.test.tsx src/components/billing/UnbilledClientCard.test.tsx`
Expected: pass.
