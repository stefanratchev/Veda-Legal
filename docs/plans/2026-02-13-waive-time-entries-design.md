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

Add two columns to `service_description_line_items`:

| Column | Type | Default | Nullable |
|--------|------|---------|----------|
| `isWaived` | boolean | false | NOT NULL |
| `waiveMode` | enum (`EXCLUDED`, `ZERO`) | — | YES (null when not waived) |

States:
- `isWaived=false, waiveMode=null` → Normal line item
- `isWaived=true, waiveMode='EXCLUDED'` → Hidden from output, still linked to time entry
- `isWaived=true, waiveMode='ZERO'` → Visible with "Waived" label, 0 in totals

## API Changes

### PATCH `/api/billing/[id]/topics/[topicId]/items/[itemId]`

Extended to accept:

```json
{ "isWaived": true, "waiveMode": "EXCLUDED" }
{ "isWaived": true, "waiveMode": "ZERO" }
{ "isWaived": false }
```

Validation:
- SD must be DRAFT (already enforced)
- If `isWaived=true`, `waiveMode` is required and must be `EXCLUDED` or `ZERO`
- If `isWaived=false`, `waiveMode` is ignored/cleared to null

### Unbilled Queries

`POST /api/billing` (SD creation) and `GET /api/billing/unbilled-summary` currently filter out entries linked to FINALIZED SDs.

Change: also filter out entries where `isWaived=true` in any SD (DRAFT or FINALIZED), so waived-but-excluded entries don't show up as unbilled while the draft is open.

### Serialization

`serializeServiceDescription` in `billing-utils.ts` passes through `isWaived` and `waiveMode` on each line item.

## Billing Calculations

All calculation functions in `billing-pdf.tsx`:

- **`calculateTopicBaseTotal`** — EXCLUDED items filtered out before summing. ZERO items contribute 0.
- **`calculateTopicTotal`** — Same (calls `calculateTopicBaseTotal`).
- **`calculateTopicHours`** — EXCLUDED items skipped. ZERO items contribute 0.
- **`calculateGrandTotal`** — Same (calls `calculateTopicTotal`).

## PDF Generation

- **EXCLUDED items:** Omitted entirely from the rendered PDF.
- **ZERO items:** Shown with original hours displayed + "Waived" label. Contribute 0 to totals.

## UI Changes

### LineItemRow

- New action in row context menu: **"Waive"** with submenu — "Exclude from billing" / "Include at $0"
- **EXCLUDED rows:** Dimmed/faded with strikethrough text, collapsed to compact single line. Visible to admin for un-waiving.
- **ZERO rows:** Fully visible with a "Waived" badge next to description. Hours shown normally, strikethrough on the amount.
- **"Restore"** action in menu to un-waive (`isWaived=false`)
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
  isWaived: boolean;
  waiveMode: WaiveMode | null;
}
```
