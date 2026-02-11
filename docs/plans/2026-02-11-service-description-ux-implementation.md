# Service Description UX Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use the frontend-design skill when implementing UI components (Tasks 4-8).

**Goal:** Overhaul the service description detail page UI/UX — fix alignment, improve visual hierarchy, add Lawyer column, restructure pricing controls into a grid.

**Architecture:** Pure frontend refactor + small data layer extension. No new components or files. Modify 5 existing files: type definition, 2 data-fetching locations (server component + API route), 3 UI components.

**Tech Stack:** Next.js 16, React, Tailwind CSS v4, Drizzle ORM, Vitest

---

### Task 1: Add `employeeName` to the type definition

**Files:**
- Modify: `app/src/types/index.ts:126-137`

**Step 1: Add the field**

In `app/src/types/index.ts`, add `employeeName` to the `ServiceDescriptionLineItem` interface, after the `originalHours` field:

```typescript
export interface ServiceDescriptionLineItem {
  id: string;
  timeEntryId: string | null;
  date: string | null;
  description: string;
  hours: number | null;
  fixedAmount: number | null;
  displayOrder: number;
  // Original values from TimeEntry (for showing changes)
  originalDescription?: string;
  originalHours?: number;
  // Lawyer who logged the time entry
  employeeName?: string;
}
```

**Step 2: Verify no type errors**

Run: `cd app && npx tsc --noEmit`
Expected: No errors (field is optional, so existing code is compatible)

**Step 3: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat(types): add employeeName to ServiceDescriptionLineItem"
```

---

### Task 2: Extend server component query to include employee name

**Files:**
- Modify: `app/src/app/(authenticated)/(admin)/billing/[id]/page.tsx:30-36` (query) and `:76-86` (serializer)

**Step 1: Extend the Drizzle query**

In the `db.query.serviceDescriptions.findFirst` call, extend the `timeEntry` relation to also fetch the user's name. Change lines 33-35 from:

```typescript
timeEntry: {
  columns: { description: true, hours: true },
},
```

to:

```typescript
timeEntry: {
  columns: { description: true, hours: true },
  with: {
    user: {
      columns: { name: true },
    },
  },
},
```

**Step 2: Serialize the employee name**

In the `lineItems.map` serializer (around line 76-86), add the `employeeName` field. Change the line item mapping from:

```typescript
lineItems: topic.lineItems.map((item) => ({
  id: item.id,
  timeEntryId: item.timeEntryId,
  date: item.date || null,
  description: item.description,
  hours: serializeDecimal(item.hours),
  fixedAmount: serializeDecimal(item.fixedAmount),
  displayOrder: item.displayOrder,
  originalDescription: item.timeEntry?.description,
  originalHours: item.timeEntry ? serializeDecimal(item.timeEntry.hours) ?? undefined : undefined,
})),
```

to:

```typescript
lineItems: topic.lineItems.map((item) => ({
  id: item.id,
  timeEntryId: item.timeEntryId,
  date: item.date || null,
  description: item.description,
  hours: serializeDecimal(item.hours),
  fixedAmount: serializeDecimal(item.fixedAmount),
  displayOrder: item.displayOrder,
  originalDescription: item.timeEntry?.description,
  originalHours: item.timeEntry ? serializeDecimal(item.timeEntry.hours) ?? undefined : undefined,
  employeeName: item.timeEntry?.user?.name ?? undefined,
})),
```

**Step 3: Verify no type errors**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add app/src/app/\(authenticated\)/\(admin\)/billing/\[id\]/page.tsx
git commit -m "feat(billing): include employee name in server component query"
```

---

### Task 3: Extend API route query to include employee name

**Files:**
- Modify: `app/src/app/api/billing/[id]/route.ts:42-51` (type), `:147-163` (query), `:82-92` (serializer)

**Step 1: Update the type annotation in `serializeServiceDescription`**

In the `serializeServiceDescription` function parameter type (around line 42-51), update the `lineItems` array's `timeEntry` type from:

```typescript
timeEntry: { description: string; hours: string } | null;
```

to:

```typescript
timeEntry: { description: string; hours: string; user: { name: string | null } | null } | null;
```

**Step 2: Extend the Drizzle query**

In the GET handler's `db.query.serviceDescriptions.findFirst` call (around line 159-161), change:

```typescript
with: {
  timeEntry: {
    columns: { description: true, hours: true },
  },
},
```

to:

```typescript
with: {
  timeEntry: {
    columns: { description: true, hours: true },
    with: {
      user: {
        columns: { name: true },
      },
    },
  },
},
```

**Step 3: Serialize the employee name**

In the `serializeServiceDescription` function's `lineItems.map` (around line 82-92), add after `originalHours`:

```typescript
employeeName: item.timeEntry?.user?.name ?? undefined,
```

**Step 4: Verify no type errors**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add app/src/app/api/billing/\[id\]/route.ts
git commit -m "feat(api): include employee name in billing API response"
```

---

### Task 4: Redesign the page header

**Files:**
- Modify: `app/src/components/billing/ServiceDescriptionDetail.tsx:367-411`

> **Use the frontend-design skill for this task.**

**Changes to the header section (lines 367-411):**

1. Remove the grand total display (the entire `<div className="text-right">` block, lines 405-410)
2. Move the status badge from next to the client name (line 387-398) to below, next to the period text
3. Bump period text from `text-sm` to `text-base`

**Target structure:**

```tsx
{/* Header */}
<div className="flex items-center gap-4">
  <button
    onClick={handleBack}
    className="p-2 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
    title="Back to billing"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
    </svg>
  </button>
  <div>
    <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
      {data.client.invoicedName || data.client.name}
    </h1>
    <div className="flex items-center gap-3 mt-1">
      <p className="text-[var(--text-muted)] text-base">
        {formatPeriod(data.periodStart, data.periodEnd)}
      </p>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded ${
          isFinalized
            ? "bg-[var(--success-bg)] text-[var(--success)]"
            : "bg-[var(--warning-bg)] text-[var(--warning)]"
        }`}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: isFinalized ? "var(--success)" : "var(--warning)" }}
        />
        {isFinalized ? "Finalized" : "Draft"}
      </span>
    </div>
  </div>
</div>
```

**Step 1: Replace the header JSX**

Replace lines 369-411 (the header section inside `<div className="space-y-6">`) with the target structure above.

**Step 2: Verify visually**

Run: `cd app && npm run dev`
Navigate to `/billing/<any-id>` and verify the header shows client name on top, period + badge below, no total.

**Step 3: Commit**

```bash
git add app/src/components/billing/ServiceDescriptionDetail.tsx
git commit -m "feat(billing): redesign header - remove redundant total, reposition badge"
```

---

### Task 5: Redesign the summary section

**Files:**
- Modify: `app/src/components/billing/ServiceDescriptionDetail.tsx:413-507`

> **Use the frontend-design skill for this task.**

**Changes to the summary section:**

1. Add dotted leaders between topic names and amounts
2. Always show subtotal (not conditional on discount)
3. Discount controls on their own row with proper spacing
4. Grand total with `text-lg font-semibold` emphasis
5. All currency values use `tabular-nums` via `font-[number:tabular-nums]` or `[font-variant-numeric:tabular-nums]` class

**Target structure for the summary section:**

```tsx
{/* Summary Section */}
<div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)] p-5">
  <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Summary</h2>
  <div className="space-y-2.5">
    {/* Topic rows with dotted leaders */}
    {topicTotals.map((topic) => (
      <div key={topic.id} className="flex items-baseline gap-2 text-sm">
        <span className="text-[var(--text-primary)] shrink-0">{topic.name}</span>
        <span className="flex-1 border-b border-dotted border-[var(--border-subtle)]" />
        <span className="text-[var(--text-secondary)] shrink-0 [font-variant-numeric:tabular-nums]">
          {formatCurrency(topic.total)}
        </span>
      </div>
    ))}
    {topicTotals.length === 0 && (
      <p className="text-sm text-[var(--text-muted)] italic">No topics yet</p>
    )}

    {/* Subtotal + Discount + Grand Total */}
    {topicTotals.length > 0 && (
      <>
        {/* Subtotal - always shown */}
        <div className="flex items-center justify-between text-sm pt-3 border-t border-[var(--border-subtle)]">
          <span className="text-[var(--text-secondary)]">Subtotal</span>
          <span className="text-[var(--text-secondary)] [font-variant-numeric:tabular-nums]">
            {formatCurrency(subtotal)}
          </span>
        </div>

        {/* Discount controls (DRAFT only) */}
        {isEditable && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="text-[var(--text-muted)]">Overall Discount</span>
              <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
                <button
                  onClick={() => handleOverallDiscountTypeChange(data.discountType === "PERCENTAGE" ? null : "PERCENTAGE")}
                  disabled={isUpdatingDiscount}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    data.discountType === "PERCENTAGE"
                      ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                  }`}
                >
                  %
                </button>
                <button
                  onClick={() => handleOverallDiscountTypeChange(data.discountType === "AMOUNT" ? null : "AMOUNT")}
                  disabled={isUpdatingDiscount}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    data.discountType === "AMOUNT"
                      ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                  }`}
                >
                  EUR
                </button>
              </div>
              {data.discountType && (
                <input
                  type="number"
                  value={data.discountValue ?? ""}
                  onChange={(e) => handleOverallDiscountValueChange(e.target.value)}
                  placeholder="0"
                  className="w-20 px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
                  step="0.01"
                  min="0"
                />
              )}
            </div>
            {data.discountType && data.discountValue ? (
              <span className="text-[var(--text-secondary)] [font-variant-numeric:tabular-nums]">
                -{formatCurrency(data.discountType === "PERCENTAGE" ? subtotal * data.discountValue / 100 : data.discountValue)}
              </span>
            ) : null}
          </div>
        )}

        {/* Discount display when finalized */}
        {!isEditable && data.discountType && data.discountValue && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">
              Overall Discount ({data.discountType === "PERCENTAGE" ? `${data.discountValue}%` : formatCurrency(data.discountValue)})
            </span>
            <span className="text-[var(--text-secondary)] [font-variant-numeric:tabular-nums]">
              -{formatCurrency(data.discountType === "PERCENTAGE" ? subtotal * data.discountValue / 100 : data.discountValue)}
            </span>
          </div>
        )}

        {/* Grand Total */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
          <span className="text-lg font-semibold text-[var(--text-primary)]">Total</span>
          <span className="text-lg font-semibold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </>
    )}
  </div>
</div>
```

**Step 1: Replace the summary section JSX**

Replace lines 413-507 with the target structure above.

**Step 2: Verify visually**

Check dotted leaders, subtotal always visible, discount controls properly spaced, grand total prominent.

**Step 3: Commit**

```bash
git add app/src/components/billing/ServiceDescriptionDetail.tsx
git commit -m "feat(billing): redesign summary with dotted leaders and improved hierarchy"
```

---

### Task 6: Redesign the footer actions

**Files:**
- Modify: `app/src/components/billing/ServiceDescriptionDetail.tsx:527-580`

> **Use the frontend-design skill for this task.**

**Changes:**

1. Move "Add Topic" from the footer to directly below the topics list as a full-width dashed button
2. Keep Export PDF and Finalize as a right-aligned footer

**Target structure — replace the Topics + Footer sections (lines 509-580):**

```tsx
{/* Topic Sections */}
<div className="space-y-4">
  {data.topics.map((topic) => (
    <TopicSection
      key={topic.id}
      topic={topic}
      serviceDescriptionId={data.id}
      isEditable={isEditable}
      clientHourlyRate={data.client.hourlyRate}
      onUpdateTopic={handleUpdateTopic}
      onDeleteTopic={handleDeleteTopic}
      onAddLineItem={handleAddLineItem}
      onUpdateLineItem={handleUpdateLineItem}
      onDeleteLineItem={handleDeleteLineItem}
    />
  ))}

  {/* Add Topic Button - dashed, inline with topics */}
  {isEditable && (
    <button
      onClick={handleOpenAddTopic}
      className="w-full py-3 border-2 border-dashed border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors flex items-center justify-center gap-2"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
      </svg>
      Add Topic
    </button>
  )}
</div>

{/* Footer Actions */}
<div className="flex items-center justify-end gap-3 pt-4">
  <button
    onClick={handleExportPDF}
    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface)] transition-colors"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    Export PDF
  </button>
  <button
    onClick={handleToggleStatus}
    disabled={isUpdatingStatus}
    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50 ${
      isFinalized
        ? "text-[var(--warning)] border border-[var(--warning)] hover:bg-[var(--warning-bg)]"
        : "bg-[var(--accent-pink)] text-[var(--bg-deep)] hover:bg-[var(--accent-pink-dim)]"
    }`}
  >
    {isUpdatingStatus ? (
      "..."
    ) : isFinalized ? (
      <>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
        Unlock
      </>
    ) : (
      <>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Finalize
      </>
    )}
  </button>
</div>
```

**Step 1: Replace the topics + footer sections**

Replace lines 509-580 with the target structure above.

**Step 2: Verify visually**

Check that "Add Topic" appears as a dashed button directly below topics, and Export PDF + Finalize are right-aligned at the bottom.

**Step 3: Commit**

```bash
git add app/src/components/billing/ServiceDescriptionDetail.tsx
git commit -m "feat(billing): redesign footer - dashed Add Topic button, cleaner action bar"
```

---

### Task 7: Redesign topic pricing controls

**Files:**
- Modify: `app/src/components/billing/TopicSection.tsx:272-411`

> **Use the frontend-design skill for this task.**

**Changes:**

1. Replace single flex row with 2-column grid
2. Left column "Pricing": mode toggle + rate/fee (stacked)
3. Right column "Adjustments": cap + discount (stacked)
4. Labels bumped to `text-sm` with `w-16` for alignment
5. Subtle group borders around each column
6. When FIXED mode, right column only shows Discount

**Target structure for pricing controls (replace lines 272-411):**

```tsx
{/* Pricing controls */}
<div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-deep)]">
  <div className="grid grid-cols-2 gap-4">
    {/* Left column: Pricing */}
    <div className="border border-[var(--border-subtle)] rounded-lg p-3 space-y-3">
      <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Pricing</h4>

      {/* Mode toggle */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-[var(--text-secondary)] w-16 shrink-0">Mode</label>
        <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
          <button
            onClick={(e) => { e.stopPropagation(); handlePricingModeChange("HOURLY"); }}
            disabled={!isEditable || isUpdating}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              topic.pricingMode === "HOURLY"
                ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            } ${!isEditable ? "cursor-not-allowed opacity-60" : ""}`}
          >
            Hourly
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handlePricingModeChange("FIXED"); }}
            disabled={!isEditable || isUpdating}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              topic.pricingMode === "FIXED"
                ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            } ${!isEditable ? "cursor-not-allowed opacity-60" : ""}`}
          >
            Fixed
          </button>
        </div>
      </div>

      {/* Rate or Fee */}
      {topic.pricingMode === "HOURLY" ? (
        <div className="flex items-center gap-3">
          <label className="text-sm text-[var(--text-secondary)] w-16 shrink-0">Rate</label>
          <input
            type="number"
            value={topic.hourlyRate ?? ""}
            onChange={(e) => handleHourlyRateChange(e.target.value)}
            onBlur={(e) => handleHourlyRateChange(e.target.value)}
            disabled={!isEditable}
            placeholder={clientHourlyRate ? String(clientHourlyRate) : "0"}
            className="w-24 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
            step="0.01"
            min="0"
          />
          <span className="text-xs text-[var(--text-muted)]">EUR/h</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <label className="text-sm text-[var(--text-secondary)] w-16 shrink-0">Fee</label>
          <input
            type="number"
            value={topic.fixedFee ?? ""}
            onChange={(e) => handleFixedFeeChange(e.target.value)}
            onBlur={(e) => handleFixedFeeChange(e.target.value)}
            disabled={!isEditable}
            placeholder="0"
            className="w-24 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
            step="0.01"
            min="0"
          />
          <span className="text-xs text-[var(--text-muted)]">EUR</span>
        </div>
      )}
    </div>

    {/* Right column: Adjustments */}
    <div className="border border-[var(--border-subtle)] rounded-lg p-3 space-y-3">
      <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Adjustments</h4>

      {/* Cap (HOURLY only) */}
      {topic.pricingMode === "HOURLY" && (
        <div className="flex items-center gap-3">
          <label className="text-sm text-[var(--text-secondary)] w-16 shrink-0">Cap</label>
          <input
            type="number"
            value={topic.capHours ?? ""}
            onChange={(e) => handleCapHoursChange(e.target.value)}
            disabled={!isEditable}
            placeholder="No cap"
            className="w-24 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
            step="0.25"
            min="0"
          />
          <span className="text-xs text-[var(--text-muted)]">hrs</span>
        </div>
      )}

      {/* Discount */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-[var(--text-secondary)] w-16 shrink-0">Discount</label>
        <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
          <button
            onClick={(e) => { e.stopPropagation(); handleDiscountTypeChange(topic.discountType === "PERCENTAGE" ? null : "PERCENTAGE"); }}
            disabled={!isEditable || isUpdating}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
              topic.discountType === "PERCENTAGE"
                ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            } ${!isEditable ? "cursor-not-allowed opacity-60" : ""}`}
          >
            %
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDiscountTypeChange(topic.discountType === "AMOUNT" ? null : "AMOUNT"); }}
            disabled={!isEditable || isUpdating}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
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
            className="w-20 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
            step="0.01"
            min="0"
          />
        )}
      </div>
    </div>
  </div>
</div>
```

**Step 1: Replace pricing controls JSX**

Replace lines 272-411 with the target structure above.

**Step 2: Verify visually**

Check 2-column grid, label alignment, FIXED mode hides cap, toggles work.

**Step 3: Commit**

```bash
git add app/src/components/billing/TopicSection.tsx
git commit -m "feat(billing): redesign pricing controls as 2-column grid"
```

---

### Task 8: Redesign line items table and add Lawyer column

**Files:**
- Modify: `app/src/components/billing/TopicSection.tsx:413-459` (table structure)
- Modify: `app/src/components/billing/LineItemRow.tsx:115-191` (row rendering)

> **Use the frontend-design skill for this task.**

**Step 1: Update the table structure in TopicSection.tsx**

Replace the line items table + add button (lines 413-459) with:

```tsx
{/* Line items */}
{topic.lineItems.length === 0 ? (
  <div className="p-6">
    {isEditable ? (
      <button
        onClick={handleOpenAddItem}
        className="w-full py-6 border-2 border-dashed border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Line Item
      </button>
    ) : (
      <p className="text-center text-sm text-[var(--text-muted)] italic">No line items</p>
    )}
  </div>
) : (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
          <th className="px-4 py-2.5 text-left font-medium w-24">Date</th>
          <th className="px-4 py-2.5 text-left font-medium w-28">Lawyer</th>
          <th className="px-4 py-2.5 text-left font-medium">Description</th>
          <th className="px-4 py-2.5 text-right font-medium w-24">Hours</th>
          {isEditable && <th className="px-4 py-2.5 text-right font-medium w-10"></th>}
        </tr>
      </thead>
      <tbody>
        {topic.lineItems.map((item, index) => (
          <LineItemRow
            key={item.id}
            item={item}
            isEditable={isEditable}
            isEvenRow={index % 2 === 0}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
          />
        ))}
      </tbody>
      {isEditable && (
        <tfoot>
          <tr className="border-t border-[var(--border-subtle)]">
            <td colSpan={5}>
              <button
                onClick={handleOpenAddItem}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors w-full"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Line Item
              </button>
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  </div>
)}
```

Also remove the old "Add line item button" section (lines 446-459) since it's now in the tfoot/empty state.

**Step 2: Update LineItemRow props and rendering**

In `app/src/components/billing/LineItemRow.tsx`, add `isEvenRow` prop:

```typescript
interface LineItemRowProps {
  item: ServiceDescriptionLineItem;
  isEditable: boolean;
  isEvenRow: boolean;
  onUpdate: (itemId: string, updates: { description?: string; hours?: number }) => Promise<void>;
  onDelete: (itemId: string) => void;
}
```

Update the component signature:

```typescript
export function LineItemRow({ item, isEditable, isEvenRow, onUpdate, onDelete }: LineItemRowProps) {
```

Update the `<tr>` (line 116) to include alternating background and increased padding:

```tsx
<tr className={`border-t border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-colors ${isUpdating ? "opacity-50" : ""} ${isEvenRow ? "bg-[var(--bg-deep)]/50" : ""}`}>
```

Add the Lawyer column between Date and Description (after the Date `<td>`, before the Description `<td>`):

```tsx
{/* Lawyer */}
<td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
  {item.employeeName || "\u2014"}
</td>
```

Update all existing `<td>` elements from `py-2` to `py-3`.

Update the Actions `<td>` — no width change needed (header handles it).

**Step 3: Verify visually**

Check Lawyer column shows names, manual items show "—", alternating rows, increased padding, Add button in tfoot.

**Step 4: Run type check**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add app/src/components/billing/TopicSection.tsx app/src/components/billing/LineItemRow.tsx
git commit -m "feat(billing): redesign line items table - add Lawyer column, improve spacing"
```

---

### Task 9: Final verification

**Step 1: Run the full type check**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 2: Run existing tests**

Run: `cd app && npm run test -- --run`
Expected: All tests pass

**Step 3: Visual smoke test**

Run: `cd app && npm run dev`
Navigate to `/billing/<id>` and verify:
- Header: client name, period + badge below, no total
- Summary: dotted leaders, always-visible subtotal, prominent grand total
- Pricing controls: 2-column grid, labels aligned, FIXED hides cap
- Line items: Lawyer column, alternating rows, add button in tfoot
- Footer: dashed Add Topic below topics, Export/Finalize right-aligned

**Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix(billing): address UX polish issues from visual review"
```
