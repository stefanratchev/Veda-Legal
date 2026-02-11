# Billing Discounts & Time Caps Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-topic hour caps, per-topic discounts (% or EUR), and overall service-description-level discounts to the billing system.

**Architecture:** New columns on `service_description_topics` (capHours, discountType, discountValue) and `service_descriptions` (discountType, discountValue). Calculation logic updated in `billing-pdf.tsx` (canonical), with UI and API consuming those functions. Order of operations: cap hours -> base total -> topic discount -> sum topics -> overall discount.

**Tech Stack:** Drizzle ORM schema + migration, TypeScript types, React components, @react-pdf/renderer

**Design doc:** `docs/plans/2026-02-11-billing-discounts-and-caps-design.md`

---

### Task 1: Add discountType enum and new schema columns

**Files:**
- Modify: `app/src/lib/schema.ts`

**Step 1: Add the discountType enum and new columns**

Add after the `pricingMode` enum (line 7):

```typescript
export const discountType = pgEnum("DiscountType", ['PERCENTAGE', 'AMOUNT'])
```

Add to `serviceDescriptionTopics` table (after `fixedFee`, line 23):

```typescript
capHours: numeric({ precision: 6, scale: 2 }),
discountType: discountType(),
discountValue: numeric({ precision: 10, scale: 2 }),
```

Add to `serviceDescriptions` table (after `finalizedById`, line 43):

```typescript
discountType: discountType(),
discountValue: numeric({ precision: 10, scale: 2 }),
```

**Step 2: Generate migration**

Run: `npm run db:generate`

**Step 3: Apply migration to dev database**

Run: `npm run db:push`

**Step 4: Commit**

```
feat(schema): add discountType enum, capHours and discount columns
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `app/src/types/index.ts`

**Step 1: Add DiscountType and update interfaces**

Add after `PricingMode` type (line 116):

```typescript
/**
 * Discount type for topics and service descriptions.
 */
export type DiscountType = "PERCENTAGE" | "AMOUNT";
```

Add to `ServiceDescriptionTopic` interface (after `fixedFee`, line 143):

```typescript
capHours: number | null;
discountType: DiscountType | null;
discountValue: number | null;
```

Add to `ServiceDescription` interface (after `finalizedAt`, line 163):

```typescript
discountType: DiscountType | null;
discountValue: number | null;
```

**Step 2: Commit**

```
feat(types): add DiscountType, capHours, and discount fields to interfaces
```

---

### Task 3: Update calculation logic with tests (TDD)

**Files:**
- Modify: `app/src/lib/billing-pdf.test.ts`
- Modify: `app/src/lib/billing-pdf.tsx`

**Step 1: Write failing tests for capHours**

Add to `billing-pdf.test.ts` in the `calculateTopicTotal` describe block:

```typescript
it("caps hours when rawHours exceeds capHours", () => {
  const topic: ServiceDescription["topics"][0] = {
    id: "1", topicName: "Test", displayOrder: 1,
    pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
    capHours: 20, discountType: null, discountValue: null,
    lineItems: [
      { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 30, fixedAmount: null, displayOrder: 1 },
    ],
  };
  expect(calculateTopicTotal(topic)).toBe(2000); // 20 capped * 100
});

it("does not cap when rawHours is below capHours", () => {
  const topic: ServiceDescription["topics"][0] = {
    id: "1", topicName: "Test", displayOrder: 1,
    pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
    capHours: 50, discountType: null, discountValue: null,
    lineItems: [
      { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 10, fixedAmount: null, displayOrder: 1 },
    ],
  };
  expect(calculateTopicTotal(topic)).toBe(1000); // 10 * 100, no cap hit
});
```

**Step 2: Write failing tests for topic discount**

```typescript
it("applies percentage discount to hourly topic", () => {
  const topic: ServiceDescription["topics"][0] = {
    id: "1", topicName: "Test", displayOrder: 1,
    pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
    capHours: null, discountType: "PERCENTAGE", discountValue: 10,
    lineItems: [
      { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 10, fixedAmount: null, displayOrder: 1 },
    ],
  };
  expect(calculateTopicTotal(topic)).toBe(900); // 1000 - 10%
});

it("applies amount discount to hourly topic", () => {
  const topic: ServiceDescription["topics"][0] = {
    id: "1", topicName: "Test", displayOrder: 1,
    pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
    capHours: null, discountType: "AMOUNT", discountValue: 250,
    lineItems: [
      { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 10, fixedAmount: null, displayOrder: 1 },
    ],
  };
  expect(calculateTopicTotal(topic)).toBe(750); // 1000 - 250
});

it("applies cap AND discount together (cap first, then discount)", () => {
  const topic: ServiceDescription["topics"][0] = {
    id: "1", topicName: "Test", displayOrder: 1,
    pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
    capHours: 20, discountType: "PERCENTAGE", discountValue: 10,
    lineItems: [
      { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 30, fixedAmount: null, displayOrder: 1 },
    ],
  };
  expect(calculateTopicTotal(topic)).toBe(1800); // cap to 20*100=2000, then -10% = 1800
});

it("applies percentage discount to fixed topic", () => {
  const topic: ServiceDescription["topics"][0] = {
    id: "1", topicName: "Test", displayOrder: 1,
    pricingMode: "FIXED", hourlyRate: null, fixedFee: 5000,
    capHours: null, discountType: "PERCENTAGE", discountValue: 20,
    lineItems: [
      { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 10, fixedAmount: null, displayOrder: 1 },
    ],
  };
  expect(calculateTopicTotal(topic)).toBe(4000); // 5000 - 20%
});

it("applies amount discount to fixed topic", () => {
  const topic: ServiceDescription["topics"][0] = {
    id: "1", topicName: "Test", displayOrder: 1,
    pricingMode: "FIXED", hourlyRate: null, fixedFee: 5000,
    capHours: null, discountType: "AMOUNT", discountValue: 500,
    lineItems: [],
  };
  expect(calculateTopicTotal(topic)).toBe(4500); // 5000 - 500
});

it("floors discount result at zero", () => {
  const topic: ServiceDescription["topics"][0] = {
    id: "1", topicName: "Test", displayOrder: 1,
    pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
    capHours: null, discountType: "AMOUNT", discountValue: 5000,
    lineItems: [
      { id: "a", timeEntryId: null, date: "2026-02-01", description: "Work", hours: 2, fixedAmount: null, displayOrder: 1 },
    ],
  };
  expect(calculateTopicTotal(topic)).toBe(0); // 200 - 5000 = -4800, floored to 0
});
```

**Step 3: Write failing tests for calculateGrandTotal**

Add a new describe block:

```typescript
import { calculateGrandTotal } from "./billing-pdf";
// (update the import at the top)

describe("calculateGrandTotal", () => {
  const makeTopic = (overrides: Partial<ServiceDescription["topics"][0]>): ServiceDescription["topics"][0] => ({
    id: "1", topicName: "Test", displayOrder: 1,
    pricingMode: "HOURLY", hourlyRate: 100, fixedFee: null,
    capHours: null, discountType: null, discountValue: null,
    lineItems: [],
    ...overrides,
  });

  it("sums topic totals with no overall discount", () => {
    const topics = [
      makeTopic({ id: "1", lineItems: [{ id: "a", timeEntryId: null, date: null, description: "W", hours: 10, fixedAmount: null, displayOrder: 1 }] }),
      makeTopic({ id: "2", lineItems: [{ id: "b", timeEntryId: null, date: null, description: "W", hours: 5, fixedAmount: null, displayOrder: 1 }] }),
    ];
    expect(calculateGrandTotal(topics, null, null)).toBe(1500);
  });

  it("applies overall percentage discount", () => {
    const topics = [
      makeTopic({ lineItems: [{ id: "a", timeEntryId: null, date: null, description: "W", hours: 10, fixedAmount: null, displayOrder: 1 }] }),
    ];
    expect(calculateGrandTotal(topics, "PERCENTAGE", 10)).toBe(900); // 1000 - 10%
  });

  it("applies overall amount discount", () => {
    const topics = [
      makeTopic({ lineItems: [{ id: "a", timeEntryId: null, date: null, description: "W", hours: 10, fixedAmount: null, displayOrder: 1 }] }),
    ];
    expect(calculateGrandTotal(topics, "AMOUNT", 300)).toBe(700); // 1000 - 300
  });

  it("stacks topic discount and overall discount sequentially", () => {
    const topics = [
      makeTopic({
        discountType: "PERCENTAGE", discountValue: 10,
        lineItems: [{ id: "a", timeEntryId: null, date: null, description: "W", hours: 10, fixedAmount: null, displayOrder: 1 }],
      }),
    ];
    // Topic: 1000 - 10% = 900, Overall: 900 - 5% = 855
    expect(calculateGrandTotal(topics, "PERCENTAGE", 5)).toBe(855);
  });

  it("floors overall discount at zero", () => {
    const topics = [
      makeTopic({ lineItems: [{ id: "a", timeEntryId: null, date: null, description: "W", hours: 1, fixedAmount: null, displayOrder: 1 }] }),
    ];
    expect(calculateGrandTotal(topics, "AMOUNT", 5000)).toBe(0); // 100 - 5000, floored
  });
});
```

**Step 4: Run tests to verify they fail**

Run: `cd app && npm run test -- billing-pdf --run`
Expected: All new tests FAIL (missing fields in type, missing function)

**Step 5: Update calculateTopicTotal in billing-pdf.tsx**

Replace the existing `calculateTopicTotal` (line 389-401):

```typescript
export function calculateTopicTotal(topic: ServiceDescription["topics"][0]): number {
  let baseTotal: number;

  if (topic.pricingMode === "FIXED") {
    baseTotal = topic.fixedFee || 0;
  } else {
    const rawHours = topic.lineItems.reduce((sum, item) => sum + (item.hours || 0), 0);
    const billedHours = topic.capHours ? Math.min(rawHours, topic.capHours) : rawHours;
    const hourlyTotal = billedHours * (topic.hourlyRate || 0);
    const fixedTotal = topic.lineItems.reduce((sum, item) => sum + (item.fixedAmount || 0), 0);
    baseTotal = hourlyTotal + fixedTotal;
  }

  if (topic.discountType === "PERCENTAGE" && topic.discountValue) {
    baseTotal = baseTotal * (1 - topic.discountValue / 100);
  } else if (topic.discountType === "AMOUNT" && topic.discountValue) {
    baseTotal = baseTotal - topic.discountValue;
  }

  return Math.max(baseTotal, 0);
}
```

**Step 6: Add calculateGrandTotal function**

Add after `calculateTopicHours`:

```typescript
export function calculateGrandTotal(
  topics: ServiceDescription["topics"],
  discountType: "PERCENTAGE" | "AMOUNT" | null,
  discountValue: number | null,
): number {
  let subtotal = topics.reduce((sum, topic) => sum + calculateTopicTotal(topic), 0);

  if (discountType === "PERCENTAGE" && discountValue) {
    subtotal = subtotal * (1 - discountValue / 100);
  } else if (discountType === "AMOUNT" && discountValue) {
    subtotal = subtotal - discountValue;
  }

  return Math.max(subtotal, 0);
}
```

**Step 7: Run tests to verify they pass**

Run: `cd app && npm run test -- billing-pdf --run`
Expected: ALL tests PASS

**Step 8: Commit**

```
feat(billing): add capHours and discount logic to calculateTopicTotal and calculateGrandTotal
```

---

### Task 4: Update API — topic routes

**Files:**
- Modify: `app/src/app/api/billing/[id]/topics/route.ts` (POST)
- Modify: `app/src/app/api/billing/[id]/topics/[topicId]/route.ts` (PATCH)

**Step 1: Update POST topic route to accept new fields**

In `route.ts` (topics POST), update the destructure (line 26) and insert (line 55-63):

Destructure new fields from body:
```typescript
const { topicName, pricingMode, hourlyRate, fixedFee, capHours, discountType, discountValue } = body;
```

Add validation after the topicName check:
```typescript
// Validate discount fields
if ((discountType && !discountValue) || (!discountType && discountValue)) {
  return errorResponse("discountType and discountValue must both be set or both be null", 400);
}
if (discountType && !["PERCENTAGE", "AMOUNT"].includes(discountType)) {
  return errorResponse("discountType must be PERCENTAGE or AMOUNT", 400);
}
if (discountValue !== undefined && discountValue !== null) {
  if (typeof discountValue !== "number" || discountValue <= 0) {
    return errorResponse("discountValue must be a positive number", 400);
  }
  if (discountType === "PERCENTAGE" && discountValue > 100) {
    return errorResponse("Percentage discount cannot exceed 100", 400);
  }
}
if (capHours !== undefined && capHours !== null) {
  if (typeof capHours !== "number" || capHours <= 0) {
    return errorResponse("capHours must be a positive number", 400);
  }
}
```

Add new fields to the insert values. Null out capHours for FIXED mode:
```typescript
capHours: (pricingMode === "FIXED" ? null : capHours) ? String(capHours) : null,
discountType: discountType || null,
discountValue: discountValue ? String(discountValue) : null,
```

Update the returning clause to include new fields:
```typescript
capHours: serviceDescriptionTopics.capHours,
discountType: serviceDescriptionTopics.discountType,
discountValue: serviceDescriptionTopics.discountValue,
```

Update the response JSON to serialize new fields:
```typescript
capHours: serializeDecimal(topic.capHours),
discountType: topic.discountType,
discountValue: serializeDecimal(topic.discountValue),
```

**Step 2: Update PATCH topic route to accept new fields**

In `[topicId]/route.ts`, add handling for new fields in the updateData block (after `displayOrder`, line 56-58):

```typescript
if (body.capHours !== undefined) {
  updateData.capHours = body.capHours ? String(body.capHours) : null;
}
if (body.discountType !== undefined) {
  updateData.discountType = body.discountType || null;
}
if (body.discountValue !== undefined) {
  updateData.discountValue = body.discountValue ? String(body.discountValue) : null;
}
```

Add validation before the update:
```typescript
// Validate discount pair
const effectiveDiscountType = body.discountType !== undefined ? body.discountType : undefined;
const effectiveDiscountValue = body.discountValue !== undefined ? body.discountValue : undefined;
if (effectiveDiscountType !== undefined || effectiveDiscountValue !== undefined) {
  if ((effectiveDiscountType && !effectiveDiscountValue) || (!effectiveDiscountType && effectiveDiscountValue)) {
    return errorResponse("discountType and discountValue must both be set or both be null", 400);
  }
  if (effectiveDiscountType && !["PERCENTAGE", "AMOUNT"].includes(effectiveDiscountType)) {
    return errorResponse("discountType must be PERCENTAGE or AMOUNT", 400);
  }
  if (effectiveDiscountValue && (typeof effectiveDiscountValue !== "number" || effectiveDiscountValue <= 0)) {
    return errorResponse("discountValue must be a positive number", 400);
  }
  if (effectiveDiscountType === "PERCENTAGE" && effectiveDiscountValue > 100) {
    return errorResponse("Percentage discount cannot exceed 100", 400);
  }
}
if (body.capHours !== undefined && body.capHours !== null) {
  if (typeof body.capHours !== "number" || body.capHours <= 0) {
    return errorResponse("capHours must be a positive number", 400);
  }
}
```

Null capHours when pricingMode is set to FIXED:
```typescript
if (body.pricingMode === "FIXED") {
  updateData.capHours = null;
}
```

Update returning clause and response to include new fields (same pattern as POST).

**Step 3: Commit**

```
feat(api): accept capHours, discountType, discountValue in topic POST/PATCH
```

---

### Task 5: Update API — service description routes

**Files:**
- Modify: `app/src/app/api/billing/[id]/route.ts` (GET serializer + PATCH)
- Modify: `app/src/app/api/billing/route.ts` (GET list totals)

**Step 1: Update GET [id] serializer**

In the `serializeServiceDescription` function, update the type to include new fields:

Add to the sd parameter type (after `finalizedAt`):
```typescript
discountType: "PERCENTAGE" | "AMOUNT" | null;
discountValue: string | null;
```

Add to topic type (after `fixedFee`):
```typescript
capHours: string | null;
discountType: "PERCENTAGE" | "AMOUNT" | null;
discountValue: string | null;
```

Add to the return object (after `finalizedAt`):
```typescript
discountType: sd.discountType,
discountValue: serializeDecimal(sd.discountValue),
```

Add to each topic in the map (after `fixedFee`):
```typescript
capHours: serializeDecimal(topic.capHours),
discountType: topic.discountType,
discountValue: serializeDecimal(topic.discountValue),
```

Update the DB query columns for topics to include new fields:
```typescript
capHours: true,
discountType: true,
discountValue: true,
```

Update the DB query columns for the SD to include:
```typescript
discountType: true,
discountValue: true,
```

**Step 2: Update PATCH to accept overall discount**

Extend the PATCH handler to accept `discountType` and `discountValue` in addition to `status`. The handler currently only handles status changes. Update it to also allow discount updates when the SD is DRAFT.

After parsing `body`, check if discount fields are present and validate:
```typescript
const { status, discountType: bodyDiscountType, discountValue: bodyDiscountValue } = body;
```

When discount fields are provided (and no status change), validate and update:
```typescript
if (bodyDiscountType !== undefined || bodyDiscountValue !== undefined) {
  if (existing.status === "FINALIZED") {
    return errorResponse("Cannot modify finalized service description", 400);
  }
  // Validate discount pair
  if ((bodyDiscountType && !bodyDiscountValue) || (!bodyDiscountType && bodyDiscountValue)) {
    return errorResponse("discountType and discountValue must both be set or both be null", 400);
  }
  // ... same validation as topic discount
  updateData.discountType = bodyDiscountType || null;
  updateData.discountValue = bodyDiscountValue ? String(bodyDiscountValue) : null;
}
```

Make the `status` field optional (currently required). The PATCH should work for either status changes, discount changes, or both.

**Step 3: Update GET list route totals**

In `app/src/app/api/billing/route.ts`, update the total calculation (lines 57-74) to account for caps, topic discounts, and overall SD discount.

Update the query to include the new columns:
```typescript
topics: {
  columns: {
    pricingMode: true,
    hourlyRate: true,
    fixedFee: true,
    capHours: true,
    discountType: true,
    discountValue: true,
  },
  // ...
},
```

Also fetch SD-level discount columns:
```typescript
columns: {
  // ...existing
  discountType: true,
  discountValue: true,
},
```

Replace the total calculation with the new logic that mirrors `calculateTopicTotal` and `calculateGrandTotal`:
```typescript
const result = allServiceDescriptions.map((sd) => {
  let subtotal = 0;
  for (const topic of sd.topics) {
    let baseTotal: number;
    if (topic.pricingMode === "FIXED" && topic.fixedFee) {
      baseTotal = Number(topic.fixedFee);
    } else if (topic.pricingMode === "HOURLY") {
      const rawHours = topic.lineItems.reduce(
        (sum, item) => sum + (item.hours ? Number(item.hours) : 0), 0
      );
      const capHours = topic.capHours ? Number(topic.capHours) : null;
      const billedHours = capHours ? Math.min(rawHours, capHours) : rawHours;
      baseTotal = billedHours * (topic.hourlyRate ? Number(topic.hourlyRate) : 0);
      baseTotal += topic.lineItems.reduce(
        (sum, item) => sum + (item.fixedAmount ? Number(item.fixedAmount) : 0), 0
      );
    } else {
      baseTotal = 0;
    }
    // Apply topic discount
    if (topic.discountType === "PERCENTAGE" && topic.discountValue) {
      baseTotal = baseTotal * (1 - Number(topic.discountValue) / 100);
    } else if (topic.discountType === "AMOUNT" && topic.discountValue) {
      baseTotal = baseTotal - Number(topic.discountValue);
    }
    subtotal += Math.max(baseTotal, 0);
  }
  // Apply overall discount
  if (sd.discountType === "PERCENTAGE" && sd.discountValue) {
    subtotal = subtotal * (1 - Number(sd.discountValue) / 100);
  } else if (sd.discountType === "AMOUNT" && sd.discountValue) {
    subtotal = subtotal - Number(sd.discountValue);
  }
  const totalAmount = Math.max(Math.round(subtotal * 100) / 100, 0);
  // ...return
});
```

**Step 4: Commit**

```
feat(api): support discount/cap fields in service description GET/PATCH and list totals
```

---

### Task 6: Update server page serializer

**Files:**
- Modify: `app/src/app/(authenticated)/(admin)/billing/[id]/page.tsx`

**Step 1: Serialize new fields**

Add to the topic serialization (after `fixedFee`, around line 70):
```typescript
capHours: serializeDecimal(topic.capHours),
discountType: topic.pricingMode === "FIXED" ? null : (topic.discountType as "PERCENTAGE" | "AMOUNT" | null),
discountValue: serializeDecimal(topic.discountValue),
```

Wait — discountType applies to both FIXED and HOURLY topics. Just serialize it directly:
```typescript
capHours: serializeDecimal(topic.capHours),
discountType: (topic.discountType as "PERCENTAGE" | "AMOUNT" | null) || null,
discountValue: serializeDecimal(topic.discountValue),
```

Add to the SD-level serialization (after `finalizedAt`, around line 63):
```typescript
discountType: (sd.discountType as "PERCENTAGE" | "AMOUNT" | null) || null,
discountValue: serializeDecimal(sd.discountValue),
```

**Step 2: Commit**

```
feat(page): serialize discount and cap fields for client component
```

---

### Task 7: UI — TopicSection cap and discount controls

**Files:**
- Modify: `app/src/components/billing/TopicSection.tsx`

**Step 1: Add capHours handler**

Add after `handleFixedFeeChange` (around line 105):

```typescript
const handleCapHoursChange = useCallback(
  async (value: string) => {
    if (!isEditable) return;
    const cap = parseFloat(value) || null;
    setIsUpdating(true);
    try {
      await onUpdateTopic(topic.id, { capHours: cap });
    } catch {
      // Error handled by parent
    } finally {
      setIsUpdating(false);
    }
  },
  [isEditable, topic.id, onUpdateTopic]
);
```

**Step 2: Add discount handlers**

```typescript
const handleDiscountTypeChange = useCallback(
  async (type: "PERCENTAGE" | "AMOUNT" | null) => {
    if (!isEditable) return;
    setIsUpdating(true);
    try {
      if (!type) {
        await onUpdateTopic(topic.id, { discountType: null, discountValue: null });
      } else {
        await onUpdateTopic(topic.id, {
          discountType: type,
          discountValue: topic.discountValue || 0,
        });
      }
    } catch {
      // Error handled by parent
    } finally {
      setIsUpdating(false);
    }
  },
  [isEditable, topic.id, topic.discountValue, onUpdateTopic]
);

const handleDiscountValueChange = useCallback(
  async (value: string) => {
    if (!isEditable) return;
    const val = parseFloat(value) || null;
    setIsUpdating(true);
    try {
      await onUpdateTopic(topic.id, { discountValue: val });
    } catch {
      // Error handled by parent
    } finally {
      setIsUpdating(false);
    }
  },
  [isEditable, topic.id, onUpdateTopic]
);
```

**Step 3: Update topicTotal calculation**

Replace the existing calculation (lines 49-54) with the cap+discount logic:

```typescript
const rawHours = topic.lineItems.reduce((sum, item) => sum + (item.hours || 0), 0);
const billedHours = topic.capHours && topic.pricingMode === "HOURLY" ? Math.min(rawHours, topic.capHours) : rawHours;

let baseTotal =
  topic.pricingMode === "FIXED"
    ? topic.fixedFee || 0
    : billedHours * (topic.hourlyRate || 0) +
      topic.lineItems.reduce((sum, item) => sum + (item.fixedAmount || 0), 0);

if (topic.discountType === "PERCENTAGE" && topic.discountValue) {
  baseTotal = baseTotal * (1 - topic.discountValue / 100);
} else if (topic.discountType === "AMOUNT" && topic.discountValue) {
  baseTotal = baseTotal - topic.discountValue;
}
const topicTotal = Math.max(baseTotal, 0);
```

**Step 4: Add UI controls inline with rate**

In the pricing controls row (the `<div className="flex items-center gap-6">` around line 201), add cap and discount inputs after the Rate/Fee input section.

For HOURLY mode, add cap hours input to the right of rate:
```tsx
{topic.pricingMode === "HOURLY" && (
  <div className="flex items-center gap-2">
    <label className="text-xs text-[var(--text-muted)]">Cap:</label>
    <input
      type="number"
      value={topic.capHours ?? ""}
      onChange={(e) => handleCapHoursChange(e.target.value)}
      disabled={!isEditable}
      placeholder="No cap"
      className="w-20 px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
      step="0.25"
      min="0"
    />
    <span className="text-xs text-[var(--text-muted)]">hrs</span>
  </div>
)}
```

Add discount toggle + value (for both HOURLY and FIXED modes):
```tsx
<div className="flex items-center gap-2">
  <span className="text-xs text-[var(--text-muted)]">Discount:</span>
  <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleDiscountTypeChange(topic.discountType === "PERCENTAGE" ? null : "PERCENTAGE");
      }}
      disabled={!isEditable || isUpdating}
      className={`px-2 py-1 text-xs font-medium transition-colors ${
        topic.discountType === "PERCENTAGE"
          ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
          : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      } ${!isEditable ? "cursor-not-allowed opacity-60" : ""}`}
    >
      %
    </button>
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleDiscountTypeChange(topic.discountType === "AMOUNT" ? null : "AMOUNT");
      }}
      disabled={!isEditable || isUpdating}
      className={`px-2 py-1 text-xs font-medium transition-colors ${
        topic.discountType === "AMOUNT"
          ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
          : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      } ${!isEditable ? "cursor-not-allowed opacity-60" : ""}`}
    >
      EUR
    </button>
  </div>
  {topic.discountType && (
    <input
      type="number"
      value={topic.discountValue ?? ""}
      onChange={(e) => handleDiscountValueChange(e.target.value)}
      disabled={!isEditable}
      placeholder="0"
      className="w-20 px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
      step="0.01"
      min="0"
    />
  )}
</div>
```

**Step 5: Update the header summary to show cap info**

In the header span showing hours (around line 172), update to show cap:
```tsx
{topic.pricingMode === "HOURLY" && rawHours > 0 && (
  <>
    {` \u2022 ${formatHours(billedHours)}`}
    {topic.capHours && rawHours > topic.capHours && (
      <span className="text-[var(--warning)]"> (capped from {formatHours(rawHours)})</span>
    )}
  </>
)}
```

**Step 6: Commit**

```
feat(ui): add cap and discount controls to TopicSection
```

---

### Task 8: UI — ServiceDescriptionDetail overall discount + grand total

**Files:**
- Modify: `app/src/components/billing/ServiceDescriptionDetail.tsx`

**Step 1: Import calculateGrandTotal or compute inline**

Replace the local `calculateTopicTotal` with imports from `billing-pdf.tsx`:
```typescript
import { calculateTopicTotal, calculateGrandTotal } from "@/lib/billing-pdf";
```

Remove the local `calculateTopicTotal` function (lines 26-35).

**Step 2: Update grandTotal to use calculateGrandTotal**

```typescript
const grandTotal = useMemo(() => {
  return calculateGrandTotal(data.topics, data.discountType, data.discountValue);
}, [data.topics, data.discountType, data.discountValue]);
```

Also compute `subtotal` for display:
```typescript
const subtotal = useMemo(() => {
  return topicTotals.reduce((sum, t) => sum + t.total, 0);
}, [topicTotals]);
```

**Step 3: Add overall discount state and handlers**

```typescript
const [isUpdatingDiscount, setIsUpdatingDiscount] = useState(false);

const handleOverallDiscountTypeChange = useCallback(
  async (type: "PERCENTAGE" | "AMOUNT" | null) => {
    setIsUpdatingDiscount(true);
    try {
      const response = await fetch(`/api/billing/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountType: type,
          discountValue: type ? (data.discountValue || 0) : null,
        }),
      });
      if (response.ok) {
        setData((prev) => ({
          ...prev,
          discountType: type,
          discountValue: type ? (prev.discountValue || 0) : null,
        }));
      }
    } catch (error) {
      console.error("Failed to update discount:", error);
    } finally {
      setIsUpdatingDiscount(false);
    }
  },
  [data.id, data.discountValue]
);

const handleOverallDiscountValueChange = useCallback(
  async (value: string) => {
    const val = parseFloat(value) || null;
    setIsUpdatingDiscount(true);
    try {
      const response = await fetch(`/api/billing/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountType: data.discountType,
          discountValue: val,
        }),
      });
      if (response.ok) {
        setData((prev) => ({ ...prev, discountValue: val }));
      }
    } catch (error) {
      console.error("Failed to update discount value:", error);
    } finally {
      setIsUpdatingDiscount(false);
    }
  },
  [data.id, data.discountType]
);
```

**Step 4: Update the Summary section to show overall discount**

After the topic totals list, before the total row, add an overall discount section:

```tsx
{/* Overall discount controls (DRAFT only) */}
{isEditable && topicTotals.length > 0 && (
  <div className="flex items-center justify-between text-sm pt-2 border-t border-[var(--border-subtle)]">
    <div className="flex items-center gap-2">
      <span className="text-[var(--text-muted)]">Overall Discount:</span>
      <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
        <button onClick={() => handleOverallDiscountTypeChange(data.discountType === "PERCENTAGE" ? null : "PERCENTAGE")} disabled={isUpdatingDiscount} className={`px-2 py-0.5 text-xs font-medium transition-colors ${data.discountType === "PERCENTAGE" ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]" : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"}`}>%</button>
        <button onClick={() => handleOverallDiscountTypeChange(data.discountType === "AMOUNT" ? null : "AMOUNT")} disabled={isUpdatingDiscount} className={`px-2 py-0.5 text-xs font-medium transition-colors ${data.discountType === "AMOUNT" ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]" : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"}`}>EUR</button>
      </div>
      {data.discountType && (
        <input type="number" value={data.discountValue ?? ""} onChange={(e) => handleOverallDiscountValueChange(e.target.value)} placeholder="0" className="w-20 px-2 py-0.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]" step="0.01" min="0" />
      )}
    </div>
    {data.discountType && data.discountValue ? (
      <span className="text-[var(--text-secondary)]">
        -{formatCurrency(data.discountType === "PERCENTAGE" ? subtotal * data.discountValue / 100 : data.discountValue)}
      </span>
    ) : null}
  </div>
)}

{/* Show discount info when finalized */}
{!isEditable && data.discountType && data.discountValue && (
  <div className="flex items-center justify-between text-sm pt-2 border-t border-[var(--border-subtle)]">
    <span className="text-[var(--text-muted)]">
      Overall Discount ({data.discountType === "PERCENTAGE" ? `${data.discountValue}%` : formatCurrency(data.discountValue)})
    </span>
    <span className="text-[var(--text-secondary)]">
      -{formatCurrency(data.discountType === "PERCENTAGE" ? subtotal * data.discountValue / 100 : data.discountValue)}
    </span>
  </div>
)}
```

Update the total row to show "Subtotal" when there's an overall discount, and "Total" as the final:
```tsx
{data.discountType && data.discountValue ? (
  <>
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-secondary)]">Subtotal</span>
      <span className="text-[var(--text-secondary)]">{formatCurrency(subtotal)}</span>
    </div>
    {/* discount row shown above */}
    <div className="flex items-center justify-between text-sm font-medium pt-2 border-t border-[var(--border-subtle)]">
      <span className="text-[var(--text-primary)]">Total</span>
      <span className="text-[var(--text-primary)]">{formatCurrency(grandTotal)}</span>
    </div>
  </>
) : (
  <div className="flex items-center justify-between text-sm font-medium pt-2 border-t border-[var(--border-subtle)]">
    <span className="text-[var(--text-primary)]">Total</span>
    <span className="text-[var(--text-primary)]">{formatCurrency(grandTotal)}</span>
  </div>
)}
```

**Step 5: Commit**

```
feat(ui): add overall discount controls and updated grand total to ServiceDescriptionDetail
```

---

### Task 9: UI — AddTopicModal cap and discount fields

**Files:**
- Modify: `app/src/components/billing/AddTopicModal.tsx`

**Step 1: Update props and state**

Update `onSubmit` prop signature to include new fields:
```typescript
onSubmit: (topicName: string, pricingMode: PricingMode, hourlyRate: number | null, fixedFee: number | null, capHours: number | null, discountType: "PERCENTAGE" | "AMOUNT" | null, discountValue: number | null) => void;
```

Add state:
```typescript
const [capHours, setCapHours] = useState("");
const [discountToggle, setDiscountToggle] = useState<"PERCENTAGE" | "AMOUNT" | null>(null);
const [discountVal, setDiscountVal] = useState("");
```

Update `handleSubmit`:
```typescript
const cap = pricingMode === "HOURLY" && capHours ? parseFloat(capHours) : null;
const dType = discountToggle;
const dVal = discountToggle && discountVal ? parseFloat(discountVal) : null;

onSubmit(trimmedName, pricingMode, rate, fee, cap, dType, dVal);
```

**Step 2: Add UI fields below the rate/fee inputs**

Add cap hours input (only for HOURLY mode) and discount toggle + value.

**Step 3: Update parent call in ServiceDescriptionDetail**

Update `handleAddTopic` to pass through new fields to the API:
```typescript
body: JSON.stringify({ topicName, pricingMode, hourlyRate, fixedFee, capHours, discountType, discountValue }),
```

**Step 4: Commit**

```
feat(ui): add cap and discount fields to AddTopicModal
```

---

### Task 10: Update PDF output

**Files:**
- Modify: `app/src/lib/billing-pdf.tsx`

**Step 1: Update the ServiceDescriptionPDF component**

Update `grandTotal` calculation to use `calculateGrandTotal`:
```typescript
const subtotal = data.topics.reduce((sum, topic) => sum + calculateTopicTotal(topic), 0);
const grandTotal = calculateGrandTotal(data.topics, data.discountType, data.discountValue);
const hasOverallDiscount = data.discountType && data.discountValue;
```

**Step 2: Update Summary of Fees section**

After topic rows, before the total row, add overall discount row if applicable:
```tsx
{hasOverallDiscount && (
  <>
    <View style={styles.summaryRow}>
      <Text style={styles.summaryTopic}>Subtotal</Text>
      <Text style={styles.summaryAmount}>{formatCurrency(subtotal)}</Text>
    </View>
    <View style={styles.summaryRow}>
      <Text style={styles.summaryTopic}>
        Overall Discount ({data.discountType === "PERCENTAGE" ? `${data.discountValue}%` : formatCurrency(data.discountValue!)})
      </Text>
      <Text style={styles.summaryAmount}>
        -{formatCurrency(data.discountType === "PERCENTAGE" ? subtotal * data.discountValue! / 100 : data.discountValue!)}
      </Text>
    </View>
  </>
)}
```

**Step 3: Update topic footer for caps and discounts**

In the topic detail sections, update the footer:

For HOURLY topics with cap:
```tsx
<Text style={styles.topicFooterLabel}>
  Total Time:{topic.capHours && totalHours > topic.capHours ? ` ${formatHours(totalHours)} (capped at ${formatHours(topic.capHours)})` : ""}
</Text>
<Text style={styles.topicFooterValue}>
  {topic.capHours && totalHours > topic.capHours ? formatHours(topic.capHours) : formatHours(totalHours)}
</Text>
```

Actually, simplify: show "Total Time: Xh (capped at Yh)" when cap exceeded, otherwise just "Total Time: Xh".

For topics with discount, add a discount line before the final topic fee:
```tsx
{topic.discountType && topic.discountValue && (
  <View style={styles.topicFooterRow}>
    <Text style={styles.topicFooterLabel}>
      Discount ({topic.discountType === "PERCENTAGE" ? `${topic.discountValue}%` : formatCurrency(topic.discountValue)}):
    </Text>
    <Text style={styles.topicFooterValue}>
      -{formatCurrency(topic.discountType === "PERCENTAGE" ? baseTopicTotal * topic.discountValue / 100 : topic.discountValue)}
    </Text>
  </View>
)}
```

Where `baseTopicTotal` is the total before discount (need to compute this separately for the PDF display).

**Step 4: Commit**

```
feat(pdf): show cap, discount, and overall discount in PDF output
```

---

### Task 11: Run all tests and verify build

**Step 1: Run full test suite**

Run: `cd app && npm run test -- --run`
Expected: ALL tests PASS

**Step 2: Run build**

Run: `cd app && npm run build`
Expected: Build succeeds with no type errors

**Step 3: Manual verification**

1. Start dev server: `npm run dev`
2. Create a new service description for a client
3. On a topic, set cap hours → verify total adjusts
4. On a topic, toggle discount % → set 10% → verify total adjusts
5. Add overall discount → verify grand total adjusts
6. Export PDF → verify cap/discount lines appear
7. Finalize → verify read-only state
8. Unlock → verify editable again

**Step 4: Commit any fixes, then final commit**

```
test: verify billing discounts and time caps end-to-end
```

---

## Verification Checklist

- [ ] `npm run test -- --run` — all tests pass
- [ ] `npm run build` — no type errors
- [ ] `npm run db:push` — schema synced
- [ ] Create SD with hourly topic, set cap < actual hours → total capped
- [ ] Set % discount on topic → total reduced
- [ ] Set EUR discount on topic → total reduced
- [ ] Set overall % discount → grand total reduced
- [ ] Cap + discount together → cap first, then discount
- [ ] Topic discount + overall discount → stacked sequentially
- [ ] PDF shows cap annotation, discount lines, overall discount
- [ ] Finalized SD is read-only (no discount/cap editing)
