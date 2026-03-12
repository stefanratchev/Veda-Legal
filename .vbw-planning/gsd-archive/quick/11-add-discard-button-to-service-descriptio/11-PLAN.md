---
phase: quick-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/billing/ServiceDescriptionDetail.tsx
  - app/src/components/billing/ServiceDescriptionDetail.test.tsx
autonomous: true
requirements: [QUICK-11]

must_haves:
  truths:
    - "Non-finalized service description detail page shows a Discard button in the footer actions"
    - "Clicking Discard shows a confirmation modal before deleting"
    - "Confirming discard calls DELETE /api/billing/[id] and navigates back to billing list"
    - "Finalized service descriptions do NOT show a Discard button"
  artifacts:
    - path: "app/src/components/billing/ServiceDescriptionDetail.tsx"
      provides: "Discard button with confirmation flow"
      contains: "showDiscardConfirm"
    - path: "app/src/components/billing/ServiceDescriptionDetail.test.tsx"
      provides: "Tests for discard button visibility and confirmation"
      contains: "Discard"
  key_links:
    - from: "ServiceDescriptionDetail.tsx"
      to: "/api/billing/[id]"
      via: "fetch DELETE on confirm"
      pattern: "fetch.*api/billing.*DELETE"
    - from: "ServiceDescriptionDetail.tsx"
      to: "ConfirmModal"
      via: "showDiscardConfirm state"
      pattern: "showDiscardConfirm"
---

<objective>
Add a "Discard" button to the ServiceDescriptionDetail footer actions (next to Export PDF), which deletes non-finalized service descriptions after a confirmation prompt.

Purpose: Currently, discarding a service description is only possible from the list page. Users viewing a draft SD should be able to discard it directly from the detail page without navigating back.

Output: Updated ServiceDescriptionDetail component with discard button + confirmation modal, plus tests.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md

<interfaces>
<!-- Existing patterns the executor needs -->

From app/src/components/billing/ServiceDescriptionDetail.tsx (footer actions, lines ~1093-1131):
```tsx
{/* Footer Actions */}
<div className="flex items-center justify-end gap-3 pt-4">
  <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface)] transition-colors">
    {/* SVG icon */}
    Export PDF
  </button>
  <button onClick={handleToggleStatus} ...>
    {/* Finalize/Unlock button */}
  </button>
</div>
```

Existing discard pattern from BillingContent.tsx (lines 174-192):
```tsx
const handleDelete = useCallback((sd, e) => {
  e.stopPropagation();
  setSdToDelete(sd);
}, []);

const handleConfirmDelete = useCallback(async () => {
  if (!sdToDelete) return;
  const sd = sdToDelete;
  setSdToDelete(null);
  try {
    const response = await fetch(`/api/billing/${sd.id}`, { method: "DELETE" });
    if (response.ok) {
      setServiceDescriptions((prev) => prev.filter((item) => item.id !== sd.id));
    }
  } catch {
    alert("Failed to delete service description");
  }
}, [sdToDelete]);
```

ConfirmModal usage pattern (already imported in ServiceDescriptionDetail.tsx):
```tsx
<ConfirmModal
  title="Delete Service Description"
  message={`Delete service description for ${clientName}? This action cannot be undone.`}
  confirmLabel="Delete"
  isDestructive
  onConfirm={handleConfirmDelete}
  onCancel={() => setSdToDelete(null)}
/>
```

Existing state variables in ServiceDescriptionDetail.tsx:
- `isFinalized` / `isEditable` booleans already computed
- `data` holds the full ServiceDescription object
- `router` from useRouter() already available

Existing test helper in ServiceDescriptionDetail.test.tsx:
```tsx
function createServiceDescription(notes: string | null): ServiceDescription { ... }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Discard button and confirmation flow to ServiceDescriptionDetail</name>
  <files>app/src/components/billing/ServiceDescriptionDetail.tsx</files>
  <action>
Add a Discard button to the footer actions area, positioned BEFORE the Export PDF button (leftmost position). The button should only render when the SD is not finalized (`isEditable`).

1. Add state: `const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);`
   Add state: `const [isDiscarding, setIsDiscarding] = useState(false);`

2. Add handler `handleDiscard` using `useCallback`:
   - Set `setIsDiscarding(true)`
   - Call `fetch(`/api/billing/${data.id}`, { method: "DELETE" })`
   - On success: `router.push("/billing?tab=service-descriptions")` to navigate back to the SD list tab
   - On failure: `alert("Failed to discard service description")` (matches existing error handling pattern)
   - Set `setIsDiscarding(false)` in finally block
   - Set `setShowDiscardConfirm(false)` before the fetch call (modal should close immediately, matching BillingContent pattern)

3. In the footer actions div (`flex items-center justify-end gap-3 pt-4`), add a Discard button BEFORE the Export PDF button, conditionally rendered with `{isEditable && (`:
   ```tsx
   <button
     onClick={() => setShowDiscardConfirm(true)}
     disabled={isDiscarding}
     className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--danger)] border border-[var(--danger)] rounded hover:bg-[var(--danger-bg)] transition-colors disabled:opacity-50"
   >
     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
     </svg>
     Discard
   </button>
   ```
   (This uses the same trash icon SVG and danger color pattern as the delete button in BillingContent.)

4. Add a ConfirmModal at the bottom of the component JSX (next to the existing Finalize/Delete confirmation modals):
   ```tsx
   {showDiscardConfirm && (
     <ConfirmModal
       title="Discard Service Description"
       message={`Discard this service description for ${data.client.name}? All line items will be removed and time entries will become available for billing again. This action cannot be undone.`}
       confirmLabel="Discard"
       isDestructive
       onConfirm={handleDiscard}
       onCancel={() => setShowDiscardConfirm(false)}
     />
   )}
   ```

Note: ConfirmModal is already imported. No new imports needed.
  </action>
  <verify>cd /Users/stefan/projects/veda-legal-timesheets/app && npx tsc --noEmit --pretty 2>&1 | head -30</verify>
  <done>Discard button appears in footer for draft SDs, hidden for finalized SDs. Clicking it shows confirmation modal. Confirming calls DELETE API and navigates to billing list.</done>
</task>

<task type="auto">
  <name>Task 2: Add tests for Discard button behavior</name>
  <files>app/src/components/billing/ServiceDescriptionDetail.test.tsx</files>
  <action>
Add a new `describe("ServiceDescriptionDetail discard button", ...)` block to the existing test file.

Use the existing `createServiceDescription` helper but modify status for different scenarios. The helper creates DRAFT SDs by default. For finalized SDs, spread the result and override `status: "FINALIZED"`.

Add mock for `global.fetch` using `vi.fn()`.

Tests to add:

1. `it("shows Discard button for draft service descriptions")` — render with DRAFT status, assert `screen.getByRole("button", { name: /discard/i })` exists.

2. `it("does not show Discard button for finalized service descriptions")` — render with `{ ...createServiceDescription(null), status: "FINALIZED" as const, finalizedAt: "2026-01-15T00:00:00.000Z" }`, assert `screen.queryByRole("button", { name: /discard/i })` is null.

3. `it("shows confirmation modal when Discard is clicked")` — render with DRAFT, click the Discard button via `fireEvent.click`, assert `screen.getByText("Discard Service Description")` appears (the modal title), and assert `screen.getByText(/Discard this service description for Acme Corp/)` appears.

4. `it("calls DELETE API and navigates on confirm")` — mock `global.fetch` to return `{ ok: true, json: async () => ({ success: true }) }`. Render with DRAFT. Click Discard button. Click the confirm button (`screen.getByRole("button", { name: "Discard" })` — note: there will be two "Discard" texts; use `getAllByRole("button", { name: /discard/i })` and click the modal's confirm button which is the last one). Assert fetch was called with the correct URL and DELETE method. Use `waitFor` to assert `router.push` was called with `"/billing?tab=service-descriptions"`.

For test 4, update the router mock to track push calls:
```tsx
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
```
Note: The existing mock is at the top of the file. If you cannot modify it (since it's module-scoped), use `vi.mocked(useRouter)` or restructure the mock to expose `mockPush`. Align with the existing mock pattern — the mock already returns `{ push: vi.fn() }`, so capture the mock push from the router instance returned.

Import `waitFor` from `@testing-library/react` (add to existing import if not present).
  </action>
  <verify>cd /Users/stefan/projects/veda-legal-timesheets/app && npx vitest run src/components/billing/ServiceDescriptionDetail.test.tsx 2>&1</verify>
  <done>All 4 new discard tests pass: button visibility for draft/finalized, modal appears on click, DELETE call + navigation on confirm.</done>
</task>

</tasks>

<verification>
1. `cd app && npx tsc --noEmit` — no type errors
2. `cd app && npx vitest run src/components/billing/ServiceDescriptionDetail.test.tsx` — all tests pass
3. `cd app && npm run build` — build succeeds
</verification>

<success_criteria>
- Draft SD detail page shows "Discard" button in footer actions (before Export PDF)
- Finalized SD detail page does NOT show Discard button
- Clicking Discard opens a confirmation modal with clear warning message
- Confirming discard calls DELETE /api/billing/[id] and navigates to billing list
- Cancelling the modal dismisses it without side effects
- All existing and new tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/11-add-discard-button-to-service-descriptio/11-SUMMARY.md`
</output>
