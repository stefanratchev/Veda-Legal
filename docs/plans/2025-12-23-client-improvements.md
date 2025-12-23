# Client Section Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add secondary emails field, notes textarea, CSV export, and fix modal close behavior across the app.

**Architecture:** Schema change for secondaryEmails field, UI additions to ClientModal, client-side CSV generation, and standardized modal close pattern (Escape key only, no backdrop click) applied to all 7 modals.

**Tech Stack:** Next.js 16, Prisma 7, TypeScript, Tailwind CSS v4

---

## Task 1: Add secondaryEmails field to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma:45-68` (Client model)

**Step 1: Add the field**

In the Client model, add after `email`:

```prisma
email           String?
secondaryEmails String?                  // Additional emails, comma-separated
```

**Step 2: Generate Prisma client**

Run: `npm run db:generate`
Expected: "Generated Prisma Client"

**Step 3: Create migration**

Run: `npm run db:migrate -- --name add-secondary-emails`
Expected: Migration created and applied successfully

**Step 4: Verify schema**

Run: `npx prisma studio` (open briefly to confirm field exists, then close)
Expected: Client table shows `secondaryEmails` column

**Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add secondaryEmails field to Client model"
```

---

## Task 2: Update Client API route to handle new fields

**Files:**
- Modify: `src/app/api/clients/route.ts`

**Step 1: Read current API implementation**

Check the GET, POST, and PATCH handlers to understand current field handling.

**Step 2: Update GET handler select clause**

Add `secondaryEmails` and `notes` to the select object:

```typescript
select: {
  id: true,
  name: true,
  timesheetCode: true,
  invoicedName: true,
  invoiceAttn: true,
  email: true,
  secondaryEmails: true,  // ADD
  hourlyRate: true,
  phone: true,
  address: true,
  practiceArea: true,
  status: true,
  notes: true,            // ADD
  createdAt: true,
},
```

**Step 3: Update POST handler**

Add fields to the `create` data object:

```typescript
data: {
  name,
  timesheetCode,
  invoicedName: invoicedName || null,
  invoiceAttn: invoiceAttn || null,
  email: email || null,
  secondaryEmails: secondaryEmails || null,  // ADD
  hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
  status: status || "ACTIVE",
  notes: notes || null,                       // ADD
},
```

**Step 4: Update PATCH handler**

Add fields to the `update` data object:

```typescript
data: {
  name,
  timesheetCode,
  invoicedName: invoicedName || null,
  invoiceAttn: invoiceAttn || null,
  email: email || null,
  secondaryEmails: secondaryEmails || null,  // ADD
  hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
  status,
  notes: notes || null,                       // ADD
},
```

**Step 5: Verify with build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 6: Commit**

```bash
git add src/app/api/clients/route.ts
git commit -m "feat(api): handle secondaryEmails and notes in clients API"
```

---

## Task 3: Update ClientsContent interface and state

**Files:**
- Modify: `src/components/clients/ClientsContent.tsx:10-46`

**Step 1: Update Client interface**

Add new fields:

```typescript
interface Client {
  id: string;
  name: string;
  timesheetCode: string;
  invoicedName: string | null;
  invoiceAttn: string | null;
  email: string | null;
  secondaryEmails: string | null;  // ADD
  hourlyRate: number | null;
  phone: string | null;            // ADD (for CSV export)
  address: string | null;          // ADD (for CSV export)
  practiceArea: string | null;     // ADD (for CSV export)
  status: ClientStatus;
  notes: string | null;            // ADD
  createdAt: string;
}
```

**Step 2: Update FormData interface**

```typescript
interface FormData {
  name: string;
  timesheetCode: string;
  invoicedName: string;
  invoiceAttn: string;
  email: string;
  secondaryEmails: string;  // ADD
  hourlyRate: string;
  status: ClientStatus;
  notes: string;            // ADD
}
```

**Step 3: Update initialFormData**

```typescript
const initialFormData: FormData = {
  name: "",
  timesheetCode: "",
  invoicedName: "",
  invoiceAttn: "",
  email: "",
  secondaryEmails: "",  // ADD
  hourlyRate: "",
  status: "ACTIVE",
  notes: "",            // ADD
};
```

**Step 4: Update openEditModal**

Add field mappings:

```typescript
const openEditModal = useCallback((client: Client) => {
  setFormData({
    name: client.name,
    timesheetCode: client.timesheetCode,
    invoicedName: client.invoicedName || "",
    invoiceAttn: client.invoiceAttn || "",
    email: client.email || "",
    secondaryEmails: client.secondaryEmails || "",  // ADD
    hourlyRate: client.hourlyRate?.toString() || "",
    status: client.status,
    notes: client.notes || "",                       // ADD
  });
  // ... rest unchanged
}, []);
```

**Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors (may have some if ClientModal not updated yet - that's fine)

**Step 6: Commit**

```bash
git add src/components/clients/ClientsContent.tsx
git commit -m "feat(clients): update interfaces for secondaryEmails and notes"
```

---

## Task 4: Update ClientModal with new form fields

**Files:**
- Modify: `src/components/clients/ClientModal.tsx`

**Step 1: Update FormData interface**

```typescript
interface FormData {
  name: string;
  timesheetCode: string;
  invoicedName: string;
  invoiceAttn: string;
  email: string;
  secondaryEmails: string;  // ADD
  hourlyRate: string;
  status: ClientStatus;
  notes: string;            // ADD
}
```

**Step 2: Add Secondary Emails field after Email field (~line 172)**

After the Email input div, add:

```tsx
{/* Secondary Emails */}
<div>
  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
    Secondary Email(s)
  </label>
  <input
    type="text"
    value={formData.secondaryEmails}
    onChange={(e) => onFormChange({ secondaryEmails: e.target.value })}
    className="
      w-full px-3 py-2 rounded text-[13px]
      bg-[var(--bg-surface)] border border-[var(--border-subtle)]
      text-[var(--text-primary)] placeholder-[var(--text-muted)]
      focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
      focus:outline-none transition-all duration-200
    "
    placeholder="finance@acme.com, legal@acme.com"
  />
</div>
```

**Step 3: Add Notes field after Status dropdown (~line 221)**

After the Status select div, add:

```tsx
{/* Notes */}
<div>
  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
    Notes
  </label>
  <textarea
    value={formData.notes}
    onChange={(e) => onFormChange({ notes: e.target.value })}
    rows={5}
    className="
      w-full px-3 py-2 rounded text-[13px]
      bg-[var(--bg-surface)] border border-[var(--border-subtle)]
      text-[var(--text-primary)] placeholder-[var(--text-muted)]
      focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
      focus:outline-none transition-all duration-200
      resize-y min-h-[100px]
    "
    placeholder="Additional client information..."
  />
</div>
```

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/components/clients/ClientModal.tsx
git commit -m "feat(clients): add secondary emails and notes fields to modal"
```

---

## Task 5: Add CSV export function and button

**Files:**
- Modify: `src/components/clients/ClientsContent.tsx`

**Step 1: Add CSV export function before the return statement**

```typescript
// CSV Export function
const exportToCSV = useCallback(() => {
  const headers = [
    "Name",
    "Timesheet Code",
    "Invoiced Name",
    "Invoice Attn",
    "Email",
    "Secondary Emails",
    "Hourly Rate",
    "Phone",
    "Address",
    "Practice Area",
    "Status",
    "Notes",
    "Created",
  ];

  const escapeCSV = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = clients.map((client) => [
    escapeCSV(client.name),
    escapeCSV(client.timesheetCode),
    escapeCSV(client.invoicedName),
    escapeCSV(client.invoiceAttn),
    escapeCSV(client.email),
    escapeCSV(client.secondaryEmails),
    client.hourlyRate?.toString() || "",
    escapeCSV(client.phone),
    escapeCSV(client.address),
    escapeCSV(client.practiceArea),
    client.status,
    escapeCSV(client.notes),
    new Date(client.createdAt).toISOString().split("T")[0],
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `clients-export-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}, [clients]);
```

**Step 2: Add Export button next to Add Client button**

Update the header section (around line 327):

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
      Clients
    </h1>
    <p className="text-[var(--text-muted)] text-[13px] mt-0.5">
      Manage your client records
    </p>
  </div>
  <div className="flex items-center gap-2">
    <button
      onClick={exportToCSV}
      className="
        flex items-center gap-1.5 px-4 py-2 rounded
        bg-[var(--bg-surface)] border border-[var(--border-subtle)]
        text-[var(--text-secondary)] font-medium text-[13px]
        hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]
        transition-colors duration-200
      "
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Export CSV
    </button>
    <button
      onClick={openCreateModal}
      className="
        flex items-center gap-1.5 px-4 py-2 rounded
        bg-[var(--accent-pink)] text-[var(--bg-deep)]
        font-medium text-[13px]
        hover:bg-[var(--accent-pink-dim)]
        transition-colors duration-200
      "
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
      </svg>
      Add Client
    </button>
  </div>
</div>
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/clients/ClientsContent.tsx
git commit -m "feat(clients): add CSV export with all client fields"
```

---

## Task 6: Fix ClientModal close behavior (Escape only)

**Files:**
- Modify: `src/components/clients/ClientModal.tsx`

**Step 1: Add useEffect import if not present**

```typescript
import { useEffect } from "react";
```

**Step 2: Add Escape key handler inside the component**

Add after the `canSubmit` line:

```typescript
// Close on Escape key
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  document.addEventListener("keydown", handleEscape);
  return () => document.removeEventListener("keydown", handleEscape);
}, [onClose]);
```

**Step 3: Remove onClick from outer div**

Change:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
```

To:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
```

**Step 4: Remove stopPropagation from modal content div**

Change:
```tsx
<div
  className="relative bg-[var(--bg-elevated)] ..."
  onClick={(e) => e.stopPropagation()}
>
```

To:
```tsx
<div className="relative bg-[var(--bg-elevated)] ...">
```

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/components/clients/ClientModal.tsx
git commit -m "fix(clients): modal closes on Escape only, not backdrop click"
```

---

## Task 7: Fix EmployeeModal close behavior

**Files:**
- Modify: `src/components/employees/EmployeeModal.tsx`

**Step 1: Add useEffect import if not present**

**Step 2: Add Escape key handler**

```typescript
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  document.addEventListener("keydown", handleEscape);
  return () => document.removeEventListener("keydown", handleEscape);
}, [onClose]);
```

**Step 3: Remove onClick={onClose} from outer div**

**Step 4: Remove onClick stopPropagation from inner div**

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/components/employees/EmployeeModal.tsx
git commit -m "fix(employees): modal closes on Escape only, not backdrop click"
```

---

## Task 8: Fix TopicModal close behavior

**Files:**
- Modify: `src/components/topics/TopicModal.tsx`

**Step 1-4:** Same pattern as Task 7

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/components/topics/TopicModal.tsx
git commit -m "fix(topics): TopicModal closes on Escape only"
```

---

## Task 9: Fix SubtopicModal close behavior

**Files:**
- Modify: `src/components/topics/SubtopicModal.tsx`

**Step 1-4:** Same pattern as Task 7

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/components/topics/SubtopicModal.tsx
git commit -m "fix(topics): SubtopicModal closes on Escape only"
```

---

## Task 10: Fix billing modals close behavior (3 modals)

**Files:**
- Modify: `src/components/billing/CreateServiceDescriptionModal.tsx`
- Modify: `src/components/billing/AddTopicModal.tsx`
- Modify: `src/components/billing/AddLineItemModal.tsx`

**Step 1-4:** Apply same pattern to all three modals:
- Add useEffect import
- Add Escape key handler
- Remove onClick={onClose} from outer div
- Remove stopPropagation from inner div

**Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/components/billing/
git commit -m "fix(billing): all modals close on Escape only"
```

---

## Task 11: Run all tests and verify

**Step 1: Run test suite**

Run: `npm run test -- --run`
Expected: All tests pass

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Manual verification checklist**

Start dev server: `npm run dev`

- [ ] Create new client with secondary emails and notes
- [ ] Edit existing client, verify fields load correctly
- [ ] Export CSV, verify all columns present
- [ ] Test ClientModal: Escape closes, backdrop click does nothing
- [ ] Test EmployeeModal: same behavior
- [ ] Test TopicModal: same behavior
- [ ] Test SubtopicModal: same behavior
- [ ] Test billing modals: same behavior

---

## Task 12: Final commit and ready for merge

**Step 1: Ensure all changes committed**

Run: `git status`
Expected: Working tree clean

**Step 2: View commit history**

Run: `git log --oneline main..HEAD`
Expected: ~10 commits covering all features

**Step 3: Ready for merge**

Use superpowers:finishing-a-development-branch skill to complete the workflow.
