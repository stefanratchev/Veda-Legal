# Client Notes On Service Description Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add read-only client notes to the top of the service description detail page, showing `No client notes` when notes are empty.

**Architecture:** Extend the existing service description server payload to include `client.notes`, thread that field through shared serialization/types, then render a notes card directly under the detail header. Verify with API route tests and a focused component test for notes display behavior.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Drizzle ORM, Vitest, Testing Library

---

### Task 1: Expose `client.notes` in billing detail payload

**Files:**
- Modify: `app/src/app/api/billing/[id]/route.test.ts`
- Modify: `app/src/app/api/billing/[id]/route.ts`

**Step 1: Write the failing test**

Add a new assertion in `returns serialized service description with nested data`:

```ts
expect(json.client.notes).toBe("Billing preference: summarize by topic");
```

And add notes to mocked client payload:

```ts
client: {
  id: "client-1",
  name: "Test Client",
  invoicedName: null,
  invoiceAttn: null,
  hourlyRate: "150.00",
  notes: "Billing preference: summarize by topic",
},
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd app && npm run test -- src/app/api/billing/[id]/route.test.ts
```

Expected: FAIL because `json.client.notes` is `undefined`.

**Step 3: Write minimal implementation**

In `app/src/app/api/billing/[id]/route.ts`, include `notes` in selected client columns:

```ts
client: {
  columns: {
    id: true,
    name: true,
    invoicedName: true,
    invoiceAttn: true,
    hourlyRate: true,
    notes: true,
  },
},
```

**Step 4: Run test to verify it passes**

Run:

```bash
cd app && npm run test -- src/app/api/billing/[id]/route.test.ts
```

Expected: PASS for GET route assertions including `json.client.notes`.

**Step 5: Commit**

```bash
git add app/src/app/api/billing/[id]/route.ts app/src/app/api/billing/[id]/route.test.ts
git commit -m "test(billing): expose client notes in billing detail API payload"
```

### Task 2: Thread notes through shared service description model

**Files:**
- Modify: `app/src/types/index.ts`
- Modify: `app/src/lib/billing-utils.ts`
- Modify: `app/src/app/(authenticated)/(admin)/billing/[id]/page.tsx`

**Step 1: Write the failing test**

Use the existing API GET serialization test from Task 1 as the red test (it should still fail end-to-end until serializer/type path includes notes).

**Step 2: Run test to verify it fails**

Run:

```bash
cd app && npm run test -- src/app/api/billing/[id]/route.test.ts
```

Expected: FAIL with mismatch on `json.client.notes`.

**Step 3: Write minimal implementation**

1. In `app/src/types/index.ts`, add notes to `ServiceDescription.client`:

```ts
client: {
  id: string;
  name: string;
  invoicedName: string | null;
  invoiceAttn: string | null;
  hourlyRate: number | null;
  notes: string | null;
};
```

2. In `app/src/lib/billing-utils.ts`:
- Add `notes: string | null` to `RawServiceDescription.client`.
- Map `notes` in `serializeServiceDescription`.

```ts
client: {
  id: sd.client.id,
  name: sd.client.name,
  invoicedName: sd.client.invoicedName,
  invoiceAttn: sd.client.invoiceAttn,
  hourlyRate: serializeDecimal(sd.client.hourlyRate),
  notes: sd.client.notes,
},
```

3. In `app/src/app/(authenticated)/(admin)/billing/[id]/page.tsx`, include `notes` in the server query client columns.

**Step 4: Run tests to verify they pass**

Run:

```bash
cd app && npm run test -- src/app/api/billing/[id]/route.test.ts
```

Expected: PASS with notes serialized correctly.

**Step 5: Commit**

```bash
git add app/src/types/index.ts app/src/lib/billing-utils.ts app/src/app/(authenticated)/(admin)/billing/[id]/page.tsx
git commit -m "feat(billing): include client notes in service description model"
```

### Task 3: Render notes under service description header with fallback

**Files:**
- Create: `app/src/components/billing/ServiceDescriptionDetail.test.tsx`
- Modify: `app/src/components/billing/ServiceDescriptionDetail.tsx`

**Step 1: Write the failing tests**

Create component tests that verify:

```ts
it("shows client notes when provided", () => {
  // render with client.notes = "First line\nSecond line"
  // expect heading "Client Notes"
  // expect notes text visible
});

it("shows fallback when notes are empty", () => {
  // render with client.notes = null
  // expect "No client notes"
});
```

Use minimal mocks for Next router and browser APIs used by the component (for example `useRouter`, `global.fetch`, `URL.createObjectURL`).

**Step 2: Run test to verify it fails**

Run:

```bash
cd app && npm run test -- src/components/billing/ServiceDescriptionDetail.test.tsx
```

Expected: FAIL because `Client Notes` section does not exist yet.

**Step 3: Write minimal implementation**

In `app/src/components/billing/ServiceDescriptionDetail.tsx`, add a notes card directly below the header block:

```tsx
<div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)] p-4">
  <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Client Notes</h2>
  <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">
    {data.client.notes?.trim() ? data.client.notes : "No client notes"}
  </p>
</div>
```

**Step 4: Run tests to verify they pass**

Run:

```bash
cd app && npm run test -- src/components/billing/ServiceDescriptionDetail.test.tsx
cd app && npm run test -- src/app/api/billing/[id]/route.test.ts
```

Expected: PASS for notes rendering and API regression coverage.

**Step 5: Commit**

```bash
git add app/src/components/billing/ServiceDescriptionDetail.tsx app/src/components/billing/ServiceDescriptionDetail.test.tsx
git commit -m "feat(billing): show client notes on service description detail"
```

### Task 4: Final verification sweep

**Files:**
- Modify: none (verification only)

**Step 1: Run targeted billing tests**

```bash
cd app && npm run test -- src/app/api/billing/[id]/route.test.ts src/components/billing/ServiceDescriptionDetail.test.tsx
```

Expected: PASS

**Step 2: Run broader billing suite smoke test**

```bash
cd app && npm run test -- src/app/api/billing
```

Expected: PASS (or existing known failures unrelated to this change)

**Step 3: Commit verification note (optional if no code changes)**

If no additional changes were needed, skip commit.
