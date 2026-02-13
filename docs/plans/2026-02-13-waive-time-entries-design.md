# Waive Time Entries in Service Descriptions

**Date:** 2026-02-13
**Status:** Approved

## Problem

When creating a service description, there is no way to exclude time entries from billing without them resurfacing as "unbilled" in future service descriptions. The only option is to delete the line item, but the underlying time entry remains unbilled and reappears next time.

## Solution

Add a waive mechanism to line items within service descriptions. Two waive modes:

- **EXCLUDED** — Line item hidden from SD view, PDF, and all totals. The time entry link stays intact so it won't resurface as unbilled.
- **ZERO** — Line item remains visible in SD and PDF with original hours displayed alongside a "Waived" label, but contributes 0 to all billing totals.

## Constraints

- Waiving happens while editing a DRAFT service description (not before SD creation)
- Un-waive is possible while the SD is still DRAFT
- Once FINALIZED, waive state is locked (existing finalization lock handles this)
- No reason/note required when waiving
- No bulk waive — one item at a time

## Schema Changes

Add one column to `service_description_line_items`:

| Column | Type | Default | Nullable |
|--------|------|---------|----------|
| `waiveMode` | enum (`EXCLUDED`, `ZERO`) | — | YES (null = not waived) |

States:
- `waiveMode=null` → Normal line item (not waived)
- `waiveMode='EXCLUDED'` → Hidden from output, still linked to time entry
- `waiveMode='ZERO'` → Visible with "Waived" label, 0 in totals

A single nullable column is sufficient — `waiveMode IS NOT NULL` implies "waived", eliminating the need for a separate `isWaived` boolean and avoiding invalid state combinations.

## API Changes

### PATCH `/api/billing/[id]/topics/[topicId]/items/[itemId]`

Extended to accept:

```json
{ "waiveMode": "EXCLUDED" }
{ "waiveMode": "ZERO" }
{ "waiveMode": null }
```

Validation:
- SD must be DRAFT (already enforced)
- `waiveMode` must be `EXCLUDED`, `ZERO`, or `null` (to un-waive)

### Unbilled Queries

`POST /api/billing` (SD creation) and `GET /api/billing/unbilled-summary` currently filter out entries linked to FINALIZED SDs.

Change: also filter out entries where `waiveMode IS NOT NULL` in any SD (DRAFT or FINALIZED), so waived-but-excluded entries don't show up as unbilled while the draft is open.

**Note:** If a DRAFT SD is deleted, cascade deletes remove its line items, and previously waived entries correctly become "unbilled" again.

### Serialization

`serializeServiceDescription` in `billing-utils.ts` passes through `waiveMode` on each line item.

## Billing Calculations

All calculation functions in `billing-pdf.tsx`:

- **`calculateTopicBaseTotal`** — EXCLUDED items filtered out before summing. ZERO items contribute 0.
- **`calculateTopicTotal`** — Same (calls `calculateTopicBaseTotal`).
- **`calculateTopicHours`** — EXCLUDED items skipped. ZERO items contribute 0.
- **`calculateGrandTotal`** — Same (calls `calculateTopicTotal`).

Also update the independent `rawHours` calculation in `TopicSection.tsx` to filter consistently.

## PDF Generation

- **EXCLUDED items:** Omitted entirely from the rendered PDF.
- **ZERO items:** Shown with original hours displayed + "Waived" label. Contribute 0 to totals.

## UI Changes

### LineItemRow

- New action in row context menu: **"Waive"** with submenu — "Exclude from billing" / "Include at $0"
- **EXCLUDED rows:** Dimmed/faded with strikethrough text, collapsed to compact single line. Visible to admin for un-waiving.
- **ZERO rows:** Fully visible with a "Waived" badge next to description. Hours shown normally, strikethrough on the amount.
- **"Restore"** action in menu to un-waive (`waiveMode=null`)
- All waive actions disabled when SD is FINALIZED

### TopicSection Hours Summary

Show waived hours separately: `4:30 (1:30 waived)`

Only non-waived hours count toward the displayed total (EXCLUDED skipped, ZERO as 0).

## Types

Update `ServiceDescriptionLineItem` in `types/index.ts`:

```typescript
export type WaiveMode = "EXCLUDED" | "ZERO";

export interface ServiceDescriptionLineItem {
  // ... existing fields ...
  waiveMode: WaiveMode | null;
}
```
