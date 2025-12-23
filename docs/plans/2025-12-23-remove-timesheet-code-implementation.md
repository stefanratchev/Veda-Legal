# Remove timesheetCode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the `timesheetCode` field from the Client model to simplify client management.

**Architecture:** Database-first approach - modify schema, migrate, then update API and UI layers. No external dependencies on this field.

**Tech Stack:** Prisma ORM, Next.js API routes, React components

---

## Task 1: Update Prisma Schema

**Files:**
- Modify: `app/prisma/schema.prisma:50`

**Step 1: Remove timesheetCode field from Client model**

Change from:
```prisma
model Client {
  id            String        @id @default(cuid())
  name          String
  timesheetCode String        @unique    // Code shown in employee timesheets
  invoicedName  String?                  // Name on outgoing invoices
```

To:
```prisma
model Client {
  id            String        @id @default(cuid())
  name          String
  invoicedName  String?                  // Name on outgoing invoices
```

**Step 2: Generate Prisma client and create migration**

Run:
```bash
cd app && npm run db:generate && npm run db:migrate
```

Enter migration name: `remove_timesheet_code`

Expected: Migration created and applied successfully

**Step 3: Commit**

```bash
git add app/prisma/schema.prisma app/prisma/migrations/
git commit -m "chore(db): remove timesheetCode field from Client model"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `app/src/types/index.ts:8-12,46-50`

**Step 1: Update Client interface**

Change from:
```typescript
export interface Client {
  id: string;
  name: string;
  timesheetCode: string;
}
```

To:
```typescript
export interface Client {
  id: string;
  name: string;
}
```

**Step 2: Update TimeEntry.client nested type**

Change from:
```typescript
  client: {
    id: string;
    name: string;
    timesheetCode: string;
  };
```

To:
```typescript
  client: {
    id: string;
    name: string;
  };
```

**Step 3: Commit**

```bash
git add app/src/types/index.ts
git commit -m "chore(types): remove timesheetCode from Client types"
```

---

## Task 3: Update API Utils

**Files:**
- Modify: `app/src/lib/api-utils.ts:36`

**Step 1: Remove MAX_TIMESHEET_CODE_LENGTH constant**

Remove this line:
```typescript
export const MAX_TIMESHEET_CODE_LENGTH = 50;
```

**Step 2: Commit**

```bash
git add app/src/lib/api-utils.ts
git commit -m "chore(api): remove MAX_TIMESHEET_CODE_LENGTH constant"
```

---

## Task 4: Update Clients API Route

**Files:**
- Modify: `app/src/app/api/clients/route.ts`

**Step 1: Remove timesheetCode from imports**

Change from:
```typescript
import {
  requireAuth,
  requireWriteAccess,
  isValidEmail,
  serializeDecimal,
  errorResponse,
  MAX_NAME_LENGTH,
  MAX_TIMESHEET_CODE_LENGTH,
  MAX_EMAIL_LENGTH,
} from "@/lib/api-utils";
```

To:
```typescript
import {
  requireAuth,
  requireWriteAccess,
  isValidEmail,
  serializeDecimal,
  errorResponse,
  MAX_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
} from "@/lib/api-utils";
```

**Step 2: Remove timesheetCode from CLIENT_SELECT**

Change from:
```typescript
const CLIENT_SELECT = {
  id: true,
  name: true,
  timesheetCode: true,
  invoicedName: true,
```

To:
```typescript
const CLIENT_SELECT = {
  id: true,
  name: true,
  invoicedName: true,
```

**Step 3: Remove timesheetCode from POST handler body destructuring**

Change from:
```typescript
  const { name, timesheetCode, invoicedName, invoiceAttn, email, hourlyRate, status } = body;
```

To:
```typescript
  const { name, invoicedName, invoiceAttn, email, hourlyRate, status } = body;
```

**Step 4: Remove timesheetCode validation in POST handler**

Remove these lines (lines 83-96):
```typescript
  if (!timesheetCode || typeof timesheetCode !== "string" || timesheetCode.trim().length === 0) {
    return errorResponse("Timesheet code is required", 400);
  }
  if (timesheetCode.trim().length > MAX_TIMESHEET_CODE_LENGTH) {
    return errorResponse(`Timesheet code cannot exceed ${MAX_TIMESHEET_CODE_LENGTH} characters`, 400);
  }

  // Check if timesheetCode is unique
  const existingClient = await db.client.findUnique({
    where: { timesheetCode: timesheetCode.trim() },
  });
  if (existingClient) {
    return NextResponse.json({ error: "Timesheet code already exists" }, { status: 400 });
  }
```

**Step 5: Remove timesheetCode from POST create data**

Change from:
```typescript
      data: {
        name: name.trim(),
        timesheetCode: timesheetCode.trim(),
        invoicedName: invoicedName?.trim() || null,
```

To:
```typescript
      data: {
        name: name.trim(),
        invoicedName: invoicedName?.trim() || null,
```

**Step 6: Remove timesheetCode from PATCH handler body destructuring**

Change from:
```typescript
  const { id, name, timesheetCode, invoicedName, invoiceAttn, email, hourlyRate, status } = body;
```

To:
```typescript
  const { id, name, invoicedName, invoiceAttn, email, hourlyRate, status } = body;
```

**Step 7: Remove timesheetCode validation in PATCH handler**

Remove these lines (lines 176-196):
```typescript
  if (timesheetCode !== undefined) {
    if (typeof timesheetCode !== "string" || timesheetCode.trim().length === 0) {
      return errorResponse("Timesheet code cannot be empty", 400);
    }
    if (timesheetCode.trim().length > MAX_TIMESHEET_CODE_LENGTH) {
      return errorResponse(`Timesheet code cannot exceed ${MAX_TIMESHEET_CODE_LENGTH} characters`, 400);
    }
  }

  // Check if timesheetCode is unique (if being changed)
  if (timesheetCode !== undefined) {
    const existingClient = await db.client.findFirst({
      where: {
        timesheetCode: timesheetCode.trim(),
        NOT: { id },
      },
    });
    if (existingClient) {
      return NextResponse.json({ error: "Timesheet code already exists" }, { status: 400 });
    }
  }
```

**Step 8: Remove timesheetCode from PATCH updateData**

Remove this line:
```typescript
  if (timesheetCode !== undefined) updateData.timesheetCode = timesheetCode.trim();
```

**Step 9: Commit**

```bash
git add app/src/app/api/clients/route.ts
git commit -m "feat(api): remove timesheetCode from clients API"
```

---

## Task 5: Update Reports API Route

**Files:**
- Modify: `app/src/app/api/reports/route.ts`

**Step 1: Remove timesheetCode from ClientStats interface**

Change from:
```typescript
interface ClientStats {
  id: string;
  name: string;
  timesheetCode: string;
  hourlyRate: number | null;
```

To:
```typescript
interface ClientStats {
  id: string;
  name: string;
  hourlyRate: number | null;
```

**Step 2: Remove clientCode from entries type**

Change from:
```typescript
  entries: {
    id: string;
    date: string;
    hours: number;
    description: string;
    userId: string;
    userName: string;
    clientId: string;
    clientName: string;
    clientCode: string;
  }[];
```

To:
```typescript
  entries: {
    id: string;
    date: string;
    hours: number;
    description: string;
    userId: string;
    userName: string;
    clientId: string;
    clientName: string;
  }[];
```

**Step 3: Remove timesheetCode from client select**

Change from:
```typescript
        client: { select: { id: true, name: true, timesheetCode: true, hourlyRate: true } },
```

To:
```typescript
        client: { select: { id: true, name: true, hourlyRate: true } },
```

**Step 4: Remove timesheetCode from clientMap initialization**

Change from:
```typescript
    const clientMap = new Map<string, {
      id: string;
      name: string;
      timesheetCode: string;
      hourlyRate: number | null;
```

To:
```typescript
    const clientMap = new Map<string, {
      id: string;
      name: string;
      hourlyRate: number | null;
```

**Step 5: Remove timesheetCode from clientMap.set**

Change from:
```typescript
        clientMap.set(clientId, {
          id: clientId,
          name: entry.client.name,
          timesheetCode: entry.client.timesheetCode,
          hourlyRate: clientRate,
```

To:
```typescript
        clientMap.set(clientId, {
          id: clientId,
          name: entry.client.name,
          hourlyRate: clientRate,
```

**Step 6: Remove timesheetCode from byClient mapping**

Change from:
```typescript
      return {
        id: client.id,
        name: client.name,
        timesheetCode: client.timesheetCode,
        hourlyRate: client.hourlyRate,
```

To:
```typescript
      return {
        id: client.id,
        name: client.name,
        hourlyRate: client.hourlyRate,
```

**Step 7: Remove clientCode from entries mapping**

Change from:
```typescript
      entries: entries.map((e) => ({
        id: e.id,
        date: e.date.toISOString().split("T")[0],
        hours: Number(e.hours),
        description: e.description,
        userId: e.userId,
        userName: e.user.name || "Unknown",
        clientId: e.clientId,
        clientName: e.client.name,
        clientCode: e.client.timesheetCode,
      })),
```

To:
```typescript
      entries: entries.map((e) => ({
        id: e.id,
        date: e.date.toISOString().split("T")[0],
        hours: Number(e.hours),
        description: e.description,
        userId: e.userId,
        userName: e.user.name || "Unknown",
        clientId: e.clientId,
        clientName: e.client.name,
      })),
```

**Step 8: Commit**

```bash
git add app/src/app/api/reports/route.ts
git commit -m "feat(api): remove timesheetCode from reports API"
```

---

## Task 6: Update Timesheets API Route

**Files:**
- Modify: `app/src/app/api/timesheets/route.ts:19-24`

**Step 1: Remove timesheetCode from TIMEENTRY_SELECT client select**

Change from:
```typescript
  client: {
    select: {
      id: true,
      name: true,
      timesheetCode: true,
    },
  },
```

To:
```typescript
  client: {
    select: {
      id: true,
      name: true,
    },
  },
```

**Step 2: Commit**

```bash
git add app/src/app/api/timesheets/route.ts
git commit -m "feat(api): remove timesheetCode from timesheets API"
```

---

## Task 7: Update ClientsContent Component

**Files:**
- Modify: `app/src/components/clients/ClientsContent.tsx`

**Step 1: Remove timesheetCode from Client interface**

Change from:
```typescript
interface Client {
  id: string;
  name: string;
  timesheetCode: string;
  invoicedName: string | null;
```

To:
```typescript
interface Client {
  id: string;
  name: string;
  invoicedName: string | null;
```

**Step 2: Remove timesheetCode from FormData interface**

Change from:
```typescript
interface FormData {
  name: string;
  timesheetCode: string;
  invoicedName: string;
```

To:
```typescript
interface FormData {
  name: string;
  invoicedName: string;
```

**Step 3: Remove timesheetCode from initialFormData**

Change from:
```typescript
const initialFormData: FormData = {
  name: "",
  timesheetCode: "",
  invoicedName: "",
```

To:
```typescript
const initialFormData: FormData = {
  name: "",
  invoicedName: "",
```

**Step 4: Remove timesheetCode from openEditModal**

Change from:
```typescript
    setFormData({
      name: client.name,
      timesheetCode: client.timesheetCode,
      invoicedName: client.invoicedName || "",
```

To:
```typescript
    setFormData({
      name: client.name,
      invoicedName: client.invoicedName || "",
```

**Step 5: Commit**

```bash
git add app/src/components/clients/ClientsContent.tsx
git commit -m "feat(ui): remove timesheetCode from ClientsContent"
```

---

## Task 8: Update ClientModal Component

**Files:**
- Modify: `app/src/components/clients/ClientModal.tsx`

**Step 1: Remove timesheetCode from FormData interface**

Change from:
```typescript
interface FormData {
  name: string;
  timesheetCode: string;
  invoicedName: string;
```

To:
```typescript
interface FormData {
  name: string;
  invoicedName: string;
```

**Step 2: Update canSubmit check**

Change from:
```typescript
  const canSubmit = formData.name.trim() && formData.timesheetCode.trim();
```

To:
```typescript
  const canSubmit = formData.name.trim();
```

**Step 3: Remove Timesheet Code input field**

Remove these lines (lines 94-112):
```typescript
              {/* Timesheet Code */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                  Timesheet Code <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.timesheetCode}
                  onChange={(e) => onFormChange({ timesheetCode: e.target.value })}
                  className="
                    w-full px-3 py-2 rounded text-[13px]
                    bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                    text-[var(--text-primary)] placeholder-[var(--text-muted)]
                    focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                    focus:outline-none transition-all duration-200
                  "
                  placeholder="e.g., ACME-001"
                />
              </div>
```

**Step 4: Commit**

```bash
git add app/src/components/clients/ClientModal.tsx
git commit -m "feat(ui): remove timesheetCode from ClientModal"
```

---

## Task 9: Update ClientSelect Component

**Files:**
- Modify: `app/src/components/ui/ClientSelect.tsx`

**Step 1: Remove timesheetCode from Client interface**

Change from:
```typescript
interface Client {
  id: string;
  name: string;
  timesheetCode: string;
}
```

To:
```typescript
interface Client {
  id: string;
  name: string;
}
```

**Step 2: Remove timesheetCode from search filter**

Change from:
```typescript
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.timesheetCode.toLowerCase().includes(searchLower)
    );
```

To:
```typescript
    return clients.filter(
      (c) => c.name.toLowerCase().includes(searchLower)
    );
```

**Step 3: Update selected client display**

Change from:
```typescript
          {selectedClient
            ? `${selectedClient.timesheetCode} — ${selectedClient.name}`
            : placeholder}
```

To:
```typescript
          {selectedClient ? selectedClient.name : placeholder}
```

**Step 4: Update dropdown item display**

Change from:
```typescript
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelect(client.id)}
                  className={`
                    w-full px-3 py-2 text-left text-sm
                    hover:bg-[var(--bg-surface)] transition-colors
                    flex items-center gap-2
                    ${value === client.id ? "bg-[var(--bg-surface)]" : ""}
                  `}
                >
                  <span className="text-[var(--accent-pink)] font-mono text-xs">
                    {client.timesheetCode}
                  </span>
                  <span className="text-[var(--text-primary)] truncate">{client.name}</span>
                </button>
```

To:
```typescript
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelect(client.id)}
                  className={`
                    w-full px-3 py-2 text-left text-sm
                    hover:bg-[var(--bg-surface)] transition-colors
                    ${value === client.id ? "bg-[var(--bg-surface)]" : ""}
                  `}
                >
                  <span className="text-[var(--text-primary)] truncate">{client.name}</span>
                </button>
```

**Step 5: Commit**

```bash
git add app/src/components/ui/ClientSelect.tsx
git commit -m "feat(ui): remove timesheetCode from ClientSelect"
```

---

## Task 10: Update BillingContent Component

**Files:**
- Modify: `app/src/components/billing/BillingContent.tsx:23-26`

**Step 1: Remove timesheetCode from Client interface**

Change from:
```typescript
interface Client {
  id: string;
  name: string;
  timesheetCode: string;
}
```

To:
```typescript
interface Client {
  id: string;
  name: string;
}
```

**Step 2: Commit**

```bash
git add app/src/components/billing/BillingContent.tsx
git commit -m "feat(ui): remove timesheetCode from BillingContent"
```

---

## Task 11: Update CreateServiceDescriptionModal Component

**Files:**
- Modify: `app/src/components/billing/CreateServiceDescriptionModal.tsx`

**Step 1: Remove timesheetCode from Client interface**

Change from:
```typescript
interface Client {
  id: string;
  name: string;
  timesheetCode: string;
}
```

To:
```typescript
interface Client {
  id: string;
  name: string;
}
```

**Step 2: Update client dropdown option display**

Change from:
```typescript
                <option key={client.id} value={client.id}>
                  {client.name} ({client.timesheetCode})
                </option>
```

To:
```typescript
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
```

**Step 3: Commit**

```bash
git add app/src/components/billing/CreateServiceDescriptionModal.tsx
git commit -m "feat(ui): remove timesheetCode from CreateServiceDescriptionModal"
```

---

## Task 12: Update ByClientTab Component

**Files:**
- Modify: `app/src/components/reports/ByClientTab.tsx`

**Step 1: Remove timesheetCode from ClientStats interface**

Change from:
```typescript
interface ClientStats {
  id: string;
  name: string;
  timesheetCode: string;
  totalHours: number;
```

To:
```typescript
interface ClientStats {
  id: string;
  name: string;
  totalHours: number;
```

**Step 2: Remove timesheetCode from Entry.client type**

Change from:
```typescript
  client: {
    id: string;
    name: string;
    timesheetCode: string;
  };
```

To:
```typescript
  client: {
    id: string;
    name: string;
  };
```

**Step 3: Remove timesheetCode display in empty drill-down header**

Change from:
```typescript
            <h3 className="text-[var(--text-primary)] font-medium">
              {selectedClient.name}
            </h3>
            <span className="text-[var(--text-muted)] text-sm">
              [{selectedClient.timesheetCode}]
            </span>
```

To:
```typescript
            <h3 className="text-[var(--text-primary)] font-medium">
              {selectedClient.name}
            </h3>
```

**Step 4: Remove timesheetCode display in drill-down header with data**

Change from:
```typescript
          <h3 className="text-[var(--text-primary)] font-medium">
            {selectedClient.name}
          </h3>
          <span className="text-[var(--text-muted)] text-sm">
            [{selectedClient.timesheetCode}]
          </span>
          <span className="text-[var(--text-muted)] text-sm">
```

To:
```typescript
          <h3 className="text-[var(--text-primary)] font-medium">
            {selectedClient.name}
          </h3>
          <span className="text-[var(--text-muted)] text-sm">
```

**Step 5: Remove Code column from summary table header**

Change from:
```typescript
            <tr className="text-left text-[var(--text-muted)] text-[11px] uppercase tracking-wider border-b border-[var(--border-subtle)]">
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium text-right">Hours</th>
```

To:
```typescript
            <tr className="text-left text-[var(--text-muted)] text-[11px] uppercase tracking-wider border-b border-[var(--border-subtle)]">
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium text-right">Hours</th>
```

**Step 6: Remove Code column from summary table body**

Change from:
```typescript
                <td className="px-4 py-3 text-[var(--text-primary)] font-medium">
                  {client.name}
                </td>
                <td className="px-4 py-3 text-[var(--text-muted)] font-mono text-xs">
                  {client.timesheetCode}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)] text-right">
```

To:
```typescript
                <td className="px-4 py-3 text-[var(--text-primary)] font-medium">
                  {client.name}
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)] text-right">
```

**Step 7: Commit**

```bash
git add app/src/components/reports/ByClientTab.tsx
git commit -m "feat(ui): remove timesheetCode from ByClientTab"
```

---

## Task 13: Update Seed File

**Files:**
- Modify: `app/prisma/seed-clients.ts`

**Step 1: Remove timesheetCode from ClientData interface**

Change from:
```typescript
interface ClientData {
  timesheetCode: string;
  name: string;
```

To:
```typescript
interface ClientData {
  name: string;
```

**Step 2: Remove timesheetCode from CLIENTS array entries**

For all entries, change from:
```typescript
  { timesheetCode: "Assited Brains", name: "Assited Brains", ...
```

To:
```typescript
  { name: "Assited Brains", ...
```

(Repeat for all ~100 entries - remove the `timesheetCode: "...",` from each entry)

**Step 3: Update upsert to use name instead of timesheetCode**

Change from:
```typescript
      await prisma.client.upsert({
        where: { timesheetCode: clientData.timesheetCode },
        update: {
          name: clientData.name,
```

To:
```typescript
      // Use createMany or check by name since timesheetCode no longer exists
      const existing = await prisma.client.findFirst({
        where: { name: clientData.name },
      });

      if (existing) {
        await prisma.client.update({
          where: { id: existing.id },
          data: {
```

Actually, let's simplify this - just use a create-only approach for seeding:

Change the main loop from upsert logic to:
```typescript
  for (const clientData of CLIENTS) {
    try {
      // Check if client already exists by name
      const existing = await prisma.client.findFirst({
        where: { name: clientData.name },
      });

      if (existing) {
        await prisma.client.update({
          where: { id: existing.id },
          data: {
            invoicedName: clientData.invoicedName,
            invoiceAttn: clientData.invoiceAttn,
            hourlyRate: clientData.hourlyRate,
            email: clientData.email,
            status: clientData.status,
          },
        });
        updated++;
      } else {
        await prisma.client.create({
          data: {
            name: clientData.name,
            invoicedName: clientData.invoicedName,
            invoiceAttn: clientData.invoiceAttn,
            hourlyRate: clientData.hourlyRate,
            email: clientData.email,
            status: clientData.status,
          },
        });
        created++;
      }
    } catch (error) {
      console.error(`Error with client ${clientData.name}:`, error);
      errors++;
    }
  }
```

Also update the console.log to show name instead of timesheetCode:
```typescript
      console.error(`Error with client ${clientData.name}:`, error);
```

**Step 4: Commit**

```bash
git add app/prisma/seed-clients.ts
git commit -m "chore(seed): remove timesheetCode from client seed data"
```

---

## Task 14: Delete Import Script

**Files:**
- Delete: `app/scripts/import-clients.ts`

**Step 1: Delete the file**

```bash
rm app/scripts/import-clients.ts
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: delete unused import-clients script"
```

---

## Task 15: Update Documentation

**Files:**
- Modify: `CLAUDE.md:167`

**Step 1: Remove timesheetCode from Domain Terminology**

Change from:
```markdown
## Domain Terminology

- **Client**: External party receiving legal services (not to be confused with client-side code)
- **TimeEntry**: Billable hours logged against a client
- **timesheetCode**: Unique short code for each client (e.g., "VED001")
- **Topic**: High-level work category (e.g., "Company Incorporation", "M&A Advisory")
```

To:
```markdown
## Domain Terminology

- **Client**: External party receiving legal services (not to be confused with client-side code)
- **TimeEntry**: Billable hours logged against a client
- **Topic**: High-level work category (e.g., "Company Incorporation", "M&A Advisory")
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: remove timesheetCode from domain terminology"
```

---

## Task 16: Build Verification

**Step 1: Run lint**

```bash
cd app && npm run lint
```

Expected: No errors

**Step 2: Run build**

```bash
cd app && npm run build
```

Expected: Build succeeds

**Step 3: Commit any fixes if needed**

If lint/build fails, fix the issues and commit.

---

## Task 17: Final Commit

**Step 1: Create summary commit**

```bash
git add -A
git commit -m "feat: remove timesheetCode field from client management

- Database: removed timesheetCode column from Client model
- API: removed from clients, reports, timesheets routes
- UI: simplified client forms and displays to use name only
- Cleanup: deleted unused import script, updated docs"
```

(Only if there are uncommitted changes)
