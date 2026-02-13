# Waive Time Entries Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins to waive line items in service descriptions so time entries can be excluded from billing or shown at $0, without resurfacing as unbilled.

**Architecture:** Single nullable `waiveMode` enum column on `service_description_line_items`. Existing PATCH endpoint extended. Calculation functions filter waived items. PDF and UI updated to reflect waive state.

**Tech Stack:** Drizzle ORM (PostgreSQL), Next.js App Router API routes, React components, @react-pdf/renderer, Vitest

---

### Task 1: Schema — Add `waiveMode` column

**Files:**
- Modify: `app/src/lib/schema.ts:1-14` (add enum), `app/src/lib/schema.ts:66-90` (add column)

**Step 1: Add the enum and column to schema**

In `app/src/lib/schema.ts`, add the enum after `discountTypeEnum` (line 14):

```typescript
export const waiveModeEnum = pgEnum("WaiveMode", ['EXCLUDED', 'ZERO'])
```

In the `serviceDescriptionLineItems` table definition (after `displayOrder` on line 74), add:

```typescript
waiveMode: waiveModeEnum(),
```

**Step 2: Generate and apply migration**

Run:
```bash
cd app && npm run db:generate
```

Expected: New migration file created in `drizzle/` folder.

Run:
```bash
cd app && npm run db:push
```

Expected: Schema synced to local database.

**Step 3: Commit**

```bash
git add app/src/lib/schema.ts app/drizzle/
git commit -m "feat(billing): add waiveMode column to line items schema"
```

---

### Task 2: Types — Add `WaiveMode` to shared types

**Files:**
- Modify: `app/src/types/index.ts:121-139`

**Step 1: Add the type and update the interface**

In `app/src/types/index.ts`, after the `DiscountType` type (line 121), add:

```typescript
export type WaiveMode = "EXCLUDED" | "ZERO";
```

In the `ServiceDescriptionLineItem` interface (line 126-139), add after `displayOrder`:

```typescript
waiveMode: WaiveMode | null;
```

**Step 2: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat(billing): add WaiveMode type to shared types"
```

---

### Task 3: Serialization — Pass `waiveMode` through

**Files:**
- Modify: `app/src/lib/billing-utils.ts:35-49` (RawServiceDescription type), `app/src/lib/billing-utils.ts:88-101` (serializer)
- Modify: `app/src/app/api/billing/[id]/route.ts:59-67` (GET query column list)
- Modify: `app/src/app/api/billing/[id]/pdf/route.tsx:60-69` (PDF query column list)

**Step 1: Update RawServiceDescription type**

In `app/src/lib/billing-utils.ts`, in the `lineItems` array type inside `RawServiceDescription` (around line 36-48), add after `displayOrder: number;`:

```typescript
waiveMode: string | null;
```

**Step 2: Update serializer**

In `serializeServiceDescription`, in the `lineItems.map` callback (around line 88-101), add after `displayOrder: item.displayOrder,`:

```typescript
waiveMode: (item.waiveMode as "EXCLUDED" | "ZERO" | null) || null,
```

**Step 3: Add `waiveMode` to Drizzle query column lists**

Two API routes explicitly list which line item columns to fetch. Without adding `waiveMode`, the serializer would receive `undefined` for it.

In `app/src/app/api/billing/[id]/route.ts`, in the `lineItems` columns object (around line 59-67), add:

```typescript
waiveMode: true,
```

In `app/src/app/api/billing/[id]/pdf/route.tsx`, in the `lineItems` columns object (around line 60-69), add:

```typescript
waiveMode: true,
```

**Note:** The server component at `app/src/app/(authenticated)/(admin)/billing/[id]/page.tsx` does NOT specify columns (fetches all), so it picks up `waiveMode` automatically. No change needed there.

**Step 4: Commit**

```bash
git add app/src/lib/billing-utils.ts app/src/app/api/billing/[id]/route.ts app/src/app/api/billing/[id]/pdf/route.tsx
git commit -m "feat(billing): serialize waiveMode in service descriptions"
```

---

### Task 4: Calculation functions — Filter waived items

**Files:**
- Modify: `app/src/lib/billing-pdf.tsx:389-414`
- Test: `app/src/lib/billing-pdf.test.ts` (create)

**Step 1: Write failing tests**

Create `app/src/lib/billing-pdf.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateTopicBaseTotal, calculateTopicHours, calculateTopicTotal } from "./billing-pdf";
import type { ServiceDescription } from "@/types";

type Topic = ServiceDescription["topics"][0];

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: "t1",
    topicName: "Test",
    displayOrder: 0,
    pricingMode: "HOURLY",
    hourlyRate: 100,
    fixedFee: null,
    capHours: null,
    discountType: null,
    discountValue: null,
    lineItems: [],
    ...overrides,
  };
}

function makeItem(hours: number, waiveMode: "EXCLUDED" | "ZERO" | null = null) {
  return {
    id: `item-${Math.random()}`,
    timeEntryId: null,
    date: "2026-01-15",
    description: "Work",
    hours,
    fixedAmount: null,
    displayOrder: 0,
    waiveMode,
  };
}

describe("calculateTopicBaseTotal with waived items", () => {
  it("excludes EXCLUDED items from hourly total", () => {
    const topic = makeTopic({
      lineItems: [
        makeItem(2, null),
        makeItem(3, "EXCLUDED"),
        makeItem(1, null),
      ],
    });
    // Only 2 + 1 = 3 hours at $100/hr = $300
    expect(calculateTopicBaseTotal(topic)).toBe(300);
  });

  it("treats ZERO items as 0 hours in total", () => {
    const topic = makeTopic({
      lineItems: [
        makeItem(2, null),
        makeItem(3, "ZERO"),
      ],
    });
    // 2 hours at $100/hr = $200 (ZERO item contributes 0)
    expect(calculateTopicBaseTotal(topic)).toBe(200);
  });

  it("handles all items waived", () => {
    const topic = makeTopic({
      lineItems: [
        makeItem(2, "EXCLUDED"),
        makeItem(3, "ZERO"),
      ],
    });
    expect(calculateTopicBaseTotal(topic)).toBe(0);
  });

  it("does not affect FIXED pricing mode", () => {
    const topic = makeTopic({
      pricingMode: "FIXED",
      fixedFee: 500,
      lineItems: [
        makeItem(2, "EXCLUDED"),
        makeItem(3, null),
      ],
    });
    expect(calculateTopicBaseTotal(topic)).toBe(500);
  });

  it("applies capHours only to non-waived hours", () => {
    const topic = makeTopic({
      capHours: 5,
      lineItems: [
        makeItem(3, null),
        makeItem(4, "EXCLUDED"),
        makeItem(2, null),
      ],
    });
    // Non-waived: 3 + 2 = 5 hours, cap is 5, so 5 * $100 = $500
    // The EXCLUDED 4hrs should not inflate the total past the cap
    expect(calculateTopicBaseTotal(topic)).toBe(500);
  });

  it("excludes EXCLUDED fixedAmount items", () => {
    const topic = makeTopic({
      lineItems: [
        { ...makeItem(0), fixedAmount: 50, waiveMode: null },
        { ...makeItem(0), fixedAmount: 100, waiveMode: "EXCLUDED" },
      ],
    });
    expect(calculateTopicBaseTotal(topic)).toBe(50);
  });
});

describe("calculateTopicHours with waived items", () => {
  it("excludes EXCLUDED items from hours count", () => {
    const topic = makeTopic({
      lineItems: [
        makeItem(2, null),
        makeItem(3, "EXCLUDED"),
        makeItem(1, "ZERO"),
      ],
    });
    // 2 + 0 (ZERO contributes 0) = 2
    expect(calculateTopicHours(topic)).toBe(2);
  });
});

describe("calculateTopicTotal with waived items and discounts", () => {
  it("applies discount only to non-waived total", () => {
    const topic = makeTopic({
      discountType: "PERCENTAGE",
      discountValue: 10,
      lineItems: [
        makeItem(10, null),
        makeItem(5, "EXCLUDED"),
      ],
    });
    // 10 hours * $100 = $1000, 10% off = $900
    expect(calculateTopicTotal(topic)).toBe(900);
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npm run test -- billing-pdf.test --run
```

Expected: Tests FAIL because current functions don't filter waived items.

**Step 3: Update calculation functions**

In `app/src/lib/billing-pdf.tsx`, update `calculateTopicBaseTotal` (line 389-398):

```typescript
export function calculateTopicBaseTotal(topic: ServiceDescription["topics"][0]): number {
  if (topic.pricingMode === "FIXED") {
    return topic.fixedFee || 0;
  }
  const billableItems = topic.lineItems.filter((item) => item.waiveMode !== "EXCLUDED");
  const rawHours = billableItems.reduce(
    (sum, item) => sum + (item.waiveMode === "ZERO" ? 0 : (item.hours || 0)),
    0
  );
  const billedHours = topic.capHours ? Math.min(rawHours, topic.capHours) : rawHours;
  const hourlyTotal = billedHours * (topic.hourlyRate || 0);
  const fixedTotal = billableItems.reduce(
    (sum, item) => sum + (item.waiveMode === "ZERO" ? 0 : (item.fixedAmount || 0)),
    0
  );
  return Math.round((hourlyTotal + fixedTotal) * 100) / 100;
}
```

Update `calculateTopicHours` (line 412-414):

```typescript
export function calculateTopicHours(topic: ServiceDescription["topics"][0]): number {
  return topic.lineItems.reduce(
    (sum, item) => {
      if (item.waiveMode === "EXCLUDED") return sum;
      if (item.waiveMode === "ZERO") return sum;
      return sum + (item.hours || 0);
    },
    0
  );
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npm run test -- billing-pdf.test --run
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add app/src/lib/billing-pdf.tsx app/src/lib/billing-pdf.test.ts
git commit -m "feat(billing): filter waived items from billing calculations"
```

---

### Task 5: API — Extend PATCH endpoint for waiveMode

**Files:**
- Modify: `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts`
- Test: `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.test.ts` (create)

**Step 1: Write failing tests**

Create `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";

const { mockRequireAdmin, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAdmin: vi.fn(),
    mockDb: {
      query: {
        serviceDescriptionLineItems: { findFirst: vi.fn() },
      },
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn(),
    },
  };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...original, requireAdmin: mockRequireAdmin };
});

import { PATCH } from "./route";

function setupAuthenticatedAdmin() {
  mockRequireAdmin.mockResolvedValue({
    session: { user: { name: "Admin", email: "admin@example.com" } },
  });
}

const mockItemInDraft = {
  id: "item-1",
  topic: {
    id: "topic-1",
    serviceDescription: { id: "sd-1", status: "DRAFT" },
  },
};

const routeParams = { params: Promise.resolve({ id: "sd-1", topicId: "topic-1", itemId: "item-1" }) };

describe("PATCH /api/billing/[id]/topics/[topicId]/items/[itemId] - waiveMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthenticatedAdmin();
  });

  it("sets waiveMode to EXCLUDED", async () => {
    mockDb.query.serviceDescriptionLineItems.findFirst
      .mockResolvedValueOnce(mockItemInDraft)
      .mockResolvedValueOnce({ timeEntry: null });

    mockDb.returning.mockResolvedValue([{
      id: "item-1", timeEntryId: null, date: null,
      description: "Test", hours: "2.00", fixedAmount: null,
      displayOrder: 0, waiveMode: "EXCLUDED",
    }]);

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1/topics/topic-1/items/item-1",
      body: { waiveMode: "EXCLUDED" },
    });

    const response = await PATCH(request, routeParams);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.waiveMode).toBe("EXCLUDED");
  });

  it("clears waiveMode with null", async () => {
    mockDb.query.serviceDescriptionLineItems.findFirst
      .mockResolvedValueOnce(mockItemInDraft)
      .mockResolvedValueOnce({ timeEntry: null });

    mockDb.returning.mockResolvedValue([{
      id: "item-1", timeEntryId: null, date: null,
      description: "Test", hours: "2.00", fixedAmount: null,
      displayOrder: 0, waiveMode: null,
    }]);

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1/topics/topic-1/items/item-1",
      body: { waiveMode: null },
    });

    const response = await PATCH(request, routeParams);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.waiveMode).toBeNull();
  });

  it("rejects invalid waiveMode value", async () => {
    mockDb.query.serviceDescriptionLineItems.findFirst.mockResolvedValueOnce(mockItemInDraft);

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1/topics/topic-1/items/item-1",
      body: { waiveMode: "INVALID" },
    });

    const response = await PATCH(request, routeParams);
    expect(response.status).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npm run test -- "items/\\[itemId\\]/route.test" --run
```

Expected: Tests FAIL because PATCH doesn't handle `waiveMode` yet.

**Step 3: Update the PATCH handler**

In `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts`:

After the existing `body.displayOrder` check (line 66-68), add:

```typescript
    if (body.waiveMode !== undefined) {
      if (body.waiveMode !== null && body.waiveMode !== "EXCLUDED" && body.waiveMode !== "ZERO") {
        return errorResponse("waiveMode must be EXCLUDED, ZERO, or null", 400);
      }
      updateData.waiveMode = body.waiveMode;
    }
```

In the `.returning()` call (line 73-81), add `waiveMode`:

```typescript
      waiveMode: serviceDescriptionLineItems.waiveMode,
```

In the response object (line 103-113), add:

```typescript
      waiveMode: updated.waiveMode || null,
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npm run test -- "items/\\[itemId\\]/route.test" --run
```

Expected: All tests PASS.

**Step 5: Verify POST endpoint returns `waiveMode`**

Check `app/src/app/api/billing/[id]/topics/[topicId]/items/route.ts` (the POST endpoint for creating manual line items). If its response explicitly lists returned fields, add `waiveMode: null` to the response object. If it returns whatever Drizzle gives back, no change needed — new items default to `waiveMode: null` in the schema.

**Step 6: Commit**

```bash
git add app/src/app/api/billing/[id]/topics/[topicId]/items/
git commit -m "feat(billing): support waiveMode in line item PATCH endpoint"
```

---

### Task 6: Unbilled queries — Filter out waived entries

**Files:**
- Modify: `app/src/app/api/billing/route.ts:186-198` (SD creation filter)
- Modify: `app/src/app/api/billing/unbilled-summary/route.ts:39-76` (unbilled summary query)

**Step 1: Update SD creation filter**

In `app/src/app/api/billing/route.ts`, update the `filteredEntries` filter (around line 186-198). Change the filter to also exclude entries that are waived in any SD:

```typescript
    const filteredEntries = unbilledEntries.filter((entry) => {
      const effectiveStartDate =
        startDateStr < BILLING_START_DATE ? BILLING_START_DATE : startDateStr;
      if (entry.date < effectiveStartDate || entry.date > endDateStr) {
        return false;
      }
      const hasFinalized = entry.billingLineItems.some(
        (li) => li.topic?.serviceDescription?.status === "FINALIZED"
      );
      if (hasFinalized) return false;
      // Exclude entries that are waived in any SD
      const hasWaived = entry.billingLineItems.some(
        (li) => li.waiveMode !== null
      );
      return !hasWaived;
    });
```

This requires adding `waiveMode` to the billingLineItems columns in the query (around line 170):

```typescript
        billingLineItems: {
          columns: { id: true, waiveMode: true },
```

**Step 2: Update unbilled summary query**

In `app/src/app/api/billing/unbilled-summary/route.ts`, the SQL query (lines 39-76) uses left joins to filter out FINALIZED entries. Add an additional condition to also exclude waived entries.

Change the `.leftJoin` on `serviceDescriptions` (line 58-64) and `.where` clause to also check for waived items:

```typescript
      .leftJoin(
        serviceDescriptions,
        and(
          eq(serviceDescriptionTopics.serviceDescriptionId, serviceDescriptions.id),
          eq(serviceDescriptions.status, "FINALIZED")
        )
      )
      .where(
        and(
          eq(clients.status, "ACTIVE"),
          gte(timeEntries.date, BILLING_START_DATE),
          // Exclude entries in FINALIZED SDs
          isNull(serviceDescriptions.id),
          // Exclude entries that are waived in any SD
          sql`NOT EXISTS (
            SELECT 1 FROM service_description_line_items sli
            WHERE sli."timeEntryId" = ${timeEntries.id}
            AND sli."waiveMode" IS NOT NULL
          )`
        )
      )
```

**Step 3: Run existing tests to verify no regressions**

Run:
```bash
cd app && npm run test -- "billing" --run
```

Expected: All existing billing tests PASS.

**Step 4: Commit**

```bash
git add app/src/app/api/billing/route.ts app/src/app/api/billing/unbilled-summary/route.ts
git commit -m "feat(billing): filter waived entries from unbilled queries"
```

---

### Task 7: PDF — Handle waived items in rendering

**Files:**
- Modify: `app/src/lib/billing-pdf.tsx:554` (line items rendering in PDF)

**Step 1: Update PDF rendering**

In `app/src/lib/billing-pdf.tsx`, where line items are rendered (around line 554: `topic.lineItems.map`), filter out EXCLUDED items and add "Waived" label for ZERO items:

```typescript
              {topic.lineItems
                .filter((item) => item.waiveMode !== "EXCLUDED")
                .map((item, index) => (
                <View
                  key={item.id}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                  wrap={false}
                >
```

For ZERO items, in the hours display cell, show the original hours with "Waived" text. In the description cell, append " (Waived)" for ZERO items:

Find the description `<Text>` element and wrap it:

```typescript
                  <Text style={styles.tableCell}>
                    {item.description}{item.waiveMode === "ZERO" ? " (Waived)" : ""}
                  </Text>
```

For the hours cell, show the actual hours value (for transparency) but append "(Waived)":

```typescript
                  <Text style={[styles.tableCell, styles.hoursCell]}>
                    {item.waiveMode === "ZERO"
                      ? `${formatHours(item.hours || 0)} (Waived)`
                      : formatHours(item.hours || 0)}
                  </Text>
```

**Step 2: Verify build**

Run:
```bash
cd app && npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add app/src/lib/billing-pdf.tsx
git commit -m "feat(billing): handle waived items in PDF rendering"
```

---

### Task 8: UI — LineItemRow waive actions

**Files:**
- Modify: `app/src/components/billing/LineItemRow.tsx`

**Step 1: Update props and add waive handler**

In `LineItemRow.tsx`, update the `LineItemRowProps` interface (line 10-17) to include the waive callback:

```typescript
interface LineItemRowProps {
  item: ServiceDescriptionLineItem;
  sortableId?: string;
  isEditable: boolean;
  isEvenRow: boolean;
  onUpdate: (itemId: string, updates: { description?: string; hours?: number }) => Promise<void>;
  onDelete: (itemId: string) => void;
  onWaive: (itemId: string, waiveMode: "EXCLUDED" | "ZERO" | null) => Promise<void>;
}
```

Update the component destructuring (line 30) to include `onWaive`.

**Step 2: Add waive menu button**

In the Actions `<td>` (line 205-217), before the delete button, add a waive dropdown. Use a simple dropdown pattern:

- If `item.waiveMode` is null: Show a "Waive" button that opens a small dropdown with "Exclude from billing" and "Include at $0"
- If `item.waiveMode` is not null: Show a "Restore" button

**Step 3: Add visual treatment for waived rows**

- **EXCLUDED rows:** Add `opacity-40` to the `<tr>` className and `line-through` to the description text. Hide the DurationPicker and action buttons — show only date, lawyer, description (struck through), and a compact "Restore" link. This collapses the row visually to signal it's excluded.
- **ZERO rows:** Add a "Waived" badge `<span>` next to the description text with styling `text-xs bg-[var(--warning-bg)] text-[var(--warning)] px-1.5 py-0.5 rounded`. Hours display stays normal, amount shows strikethrough.
- **Drag-and-drop:** EXCLUDED rows should still be draggable (no functional harm, admin may want to reorder before restoring).

**Step 4: Commit**

```bash
git add app/src/components/billing/LineItemRow.tsx
git commit -m "feat(billing): add waive/restore UI to line item rows"
```

---

### Task 9: UI — TopicSection hours summary with waived hours

**Files:**
- Modify: `app/src/components/billing/TopicSection.tsx:83-84`

**Step 1: Update hours calculation**

In `TopicSection.tsx`, update the `rawHours` calculation (line 83) to exclude waived items:

```typescript
  const rawHours = topic.lineItems
    .filter((item) => item.waiveMode !== "EXCLUDED")
    .reduce((sum, item) => sum + (item.waiveMode === "ZERO" ? 0 : (item.hours || 0)), 0);
  const waivedHours = topic.lineItems
    .reduce((sum, item) => {
      if (item.waiveMode === "EXCLUDED") return sum + (item.hours || 0);
      if (item.waiveMode === "ZERO") return sum + (item.hours || 0);
      return sum;
    }, 0);
```

In the hours display area, show waived hours if any:

```typescript
{formatHours(billedHours)}{waivedHours > 0 && (
  <span className="text-xs text-[var(--text-muted)] ml-1">
    ({formatHours(waivedHours)} waived)
  </span>
)}
```

**Step 2: Commit**

```bash
git add app/src/components/billing/TopicSection.tsx
git commit -m "feat(billing): show waived hours in topic section summary"
```

---

### Task 10: UI — Wire up waive handler in ServiceDescriptionDetail

**Files:**
- Modify: `app/src/components/billing/ServiceDescriptionDetail.tsx`

**Step 1: Add waive handler**

In `ServiceDescriptionDetail.tsx`, add a `handleWaiveLineItem` callback similar to the existing `handleUpdateLineItem`:

```typescript
  const handleWaiveLineItem = useCallback(async (itemId: string, waiveMode: "EXCLUDED" | "ZERO" | null) => {
    // Find which topic contains this item
    const topic = data.topics.find((t) =>
      t.lineItems.some((li) => li.id === itemId)
    );
    if (!topic) return;

    const response = await fetch(
      `/api/billing/${data.id}/topics/${topic.id}/items/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waiveMode }),
      }
    );

    if (!response.ok) throw new Error("Failed to update waive status");
    router.refresh();
  }, [data, router]);
```

Pass `onWaive={handleWaiveLineItem}` to `TopicSection`, which passes it through to `LineItemRow`.

**Step 2: Update TopicSection props to accept and forward onWaive**

In `TopicSection.tsx`, add `onWaive` to the props interface and pass it to each `LineItemRow`.

**Step 3: Run full test suite**

Run:
```bash
cd app && npm run test -- --run
```

Expected: All tests PASS.

**Step 4: Commit**

```bash
git add app/src/components/billing/ServiceDescriptionDetail.tsx app/src/components/billing/TopicSection.tsx
git commit -m "feat(billing): wire up waive handler in service description editor"
```

---

### Task 11: Manual testing & final verification

**Step 1: Start dev server and test end-to-end**

Run:
```bash
cd app && npm run dev
```

Test the following scenarios:
1. Open a DRAFT service description
2. Waive a line item as EXCLUDED — verify it dims/strikes through
3. Waive a line item as ZERO — verify "Waived" badge appears
4. Restore a waived item — verify it returns to normal
5. Check topic hours summary shows waived hours separately
6. Generate PDF — verify EXCLUDED items are omitted, ZERO items show "Waived" label
7. Finalize the SD — verify waive actions are disabled
8. Check unbilled summary — verify waived entries don't appear

**Step 2: Run full test suite**

Run:
```bash
cd app && npm run test -- --run
```

Expected: All tests PASS.

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(billing): address issues found during manual testing"
```
