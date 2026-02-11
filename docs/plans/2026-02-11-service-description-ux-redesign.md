# Service Description Detail Page — UX Redesign

**Date:** 2026-02-11
**Scope:** UI/UX overhaul of the service description detail page (`/billing/[id]`)
**Approach:** Grid pricing controls + polish (no structural page changes)

## Context

The service description detail page is clunky: pricing controls are crammed into one horizontal row, alignment is inconsistent, the line items table lacks visual hierarchy, and key data (which lawyer did the work) is missing.

Typical usage: 4-8 topics per service description, with equal time spent adjusting pricing and editing line items.

## Changes

### 1. Header

- Remove redundant grand total (summary section is the single source of truth)
- Move status badge next to the period line instead of next to client name
- Bump period text from `text-sm` to `text-base`

### 2. Summary Section

- Dotted leaders between topic names and amounts (flex spacer with `border-b border-dotted`)
- Always show subtotal row (not conditional on discount)
- Discount controls on their own dedicated row (label + toggles + input left, amount right)
- Grand total gets `text-lg font-semibold` emphasis
- All currency values use `tabular-nums` for column alignment

### 3. Topic Pricing Controls

- Replace single horizontal flex row with 2-column grid:
  - Left column "Pricing": Mode toggle + Rate/Fee input (stacked vertically)
  - Right column "Adjustments": Cap input + Discount toggle/input (stacked vertically)
- Subtle group borders (`border border-[var(--border-subtle)] rounded-lg p-3`) around each column
- Labels bump from `text-xs` to `text-sm` with fixed width (`w-16`) for alignment
- Toggle buttons get slightly more padding (`px-3 py-1.5`)
- When FIXED mode, right column only shows Discount (cap is irrelevant)

### 4. Line Items Table

- **New "Lawyer" column** between Date and Description (`w-28`)
  - Shows `timeEntry.user.name` for linked items
  - Shows "—" for manually created items (no `timeEntryId`)
- Increase row padding from `py-2` to `py-3`
- Alternate row shading: even rows get subtle `bg-[var(--bg-deep)]/50`
- Rename "Time" column header to "Hours"
- Shrink Actions column from `w-16` to `w-10`
- Move "Add Line Item" button into `<tfoot>` (part of the table)
- Empty state: dashed-border drop zone (`border-2 border-dashed rounded-lg py-6 text-center`)

### 5. Footer Actions

- "Add Topic" becomes full-width dashed border button directly below the last topic
- "Export PDF" and "Finalize" stay as right-aligned buttons in footer bar
- Remove `border-t` divider (dashed add-topic button provides separation)

### 6. Data Layer

- Extend API GET `/api/billing/[id]` query to fetch `timeEntry.user.name`
- Add `employeeName?: string` to `ServiceDescriptionLineItem` type
- Serialize `item.timeEntry?.user?.name` in the API response

## Files to Modify

1. `app/src/types/index.ts` — add `employeeName` field
2. `app/src/app/api/billing/[id]/route.ts` — extend query + serializer
3. `app/src/components/billing/ServiceDescriptionDetail.tsx` — header, summary, footer
4. `app/src/components/billing/TopicSection.tsx` — pricing grid, table improvements
5. `app/src/components/billing/LineItemRow.tsx` — Lawyer column, padding, row shading
