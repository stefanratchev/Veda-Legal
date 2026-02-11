# Billing Discounts & Time Caps

## Overview

Add per-topic hour caps and discounts (percentage or euro amount) to service descriptions, plus an overall service-description-level discount. These features extend the existing HOURLY and FIXED pricing modes.

## Data Model

### `service_description_topics` — 3 new columns

| Column | Type | Purpose |
|--------|------|---------|
| `capHours` | numeric(6,2), nullable | Max billable hours. `null` = no cap. Ignored for FIXED mode. |
| `discountType` | enum: `PERCENTAGE` \| `AMOUNT`, nullable | Kind of discount. `null` = no discount. |
| `discountValue` | numeric(10,2), nullable | Discount value (e.g., `10` for 10% or `500` for €500). |

### `service_descriptions` — 2 new columns

| Column | Type | Purpose |
|--------|------|---------|
| `discountType` | enum: `PERCENTAGE` \| `AMOUNT`, nullable | Overall invoice discount type. |
| `discountValue` | numeric(10,2), nullable | Overall discount value. |

### Validation

- `discountType` and `discountValue` must both be set or both be null.
- `discountValue` must be > 0 when set.
- Percentage discount must be between 0 and 100.
- `capHours` must be > 0 when set.
- `capHours` is ignored/nulled when `pricingMode` is `FIXED`.

## Calculation Logic

### Topic total

```
1. If FIXED mode:
     baseTotal = fixedFee

2. If HOURLY mode:
     rawHours = sum(lineItem.hours)
     billedHours = capHours ? min(rawHours, capHours) : rawHours
     hourlyTotal = billedHours × hourlyRate
     fixedTotal = sum(lineItem.fixedAmount)   // disbursements
     baseTotal = hourlyTotal + fixedTotal

3. Apply topic discount:
     if discountType === "PERCENTAGE":
       topicTotal = baseTotal × (1 - discountValue / 100)
     elif discountType === "AMOUNT":
       topicTotal = baseTotal - discountValue
     else:
       topicTotal = baseTotal

4. Floor at zero:
     topicTotal = max(topicTotal, 0)
```

### Grand total

```
1. subtotal = sum of all topicTotals (after their individual caps/discounts)

2. Apply overall discount:
     if sd.discountType === "PERCENTAGE":
       grandTotal = subtotal × (1 - sd.discountValue / 100)
     elif sd.discountType === "AMOUNT":
       grandTotal = subtotal - sd.discountValue
     else:
       grandTotal = subtotal

3. Floor at zero:
     grandTotal = max(grandTotal, 0)
```

### Order of operations

1. Cap hours (topic-level)
2. Calculate topic base total
3. Apply topic discount
4. Sum all topic totals into subtotal
5. Apply overall service-description discount

Discounts apply to the full total including disbursements (fixed-amount line items).

### Calculation locations (keep in sync)

- `billing-pdf.tsx` — `calculateTopicTotal()` (canonical)
- `TopicSection.tsx` — live UI display
- `ServiceDescriptionDetail.tsx` — grand total display
- `GET /api/billing` — list view totals

## UI Changes

### TopicSection.tsx — per-topic controls

Single row layout: **rate** | **hour cap** | **discount toggle (% / €) + value**

- Hour cap input only visible when `pricingMode === "HOURLY"`.
- In the topic total area:
  - Cap active and exceeded: `"30.50 hrs (capped at 20.00 hrs)"`
  - Discount active: show base amount dimmed, then `"Discount (10%): -€300.00"`, then adjusted total.

### ServiceDescriptionDetail.tsx — overall discount

- Below topics, above grand total: "Overall Discount" section with `%` / `€` toggle + value input (DRAFT only).
- Display: subtotal, then `"Overall Discount (10%): -€X"`, then grand total.

### AddTopicModal.tsx

- Add optional hour cap and discount fields below existing pricing mode / rate inputs.

### BillingContent.tsx (list view)

- No UI changes — `totalAmount` comes from the updated server calculation.

## PDF Output

### Topic section

- **With hour cap:** `"Total: 25.50 hrs (capped at 20.00 hrs) × €100.00/hr = €2,000.00"`
- **With discount:** Line below topic total: `"Discount (10%): -€200.00"` then `"Topic fee: €1,800.00"`
- **With both:** Capped hours in total line, discount line below, then adjusted fee.
- **FIXED with discount:** `"Fixed fee: €5,000.00"`, then `"Discount (€500.00): -€500.00"`, then `"Topic fee: €4,500.00"`

### Summary of Fees

- Each topic row shows its final adjusted total.
- Overall discount: row after subtotal `"Overall Discount (5%): -€X"`, then grand total.

## API Changes

### Topic routes

`POST /api/billing/[id]/topics` and `PATCH /api/billing/[id]/topics/[topicId]`:
- Accept `capHours`, `discountType`, `discountValue` in request body.
- Apply validation rules from Data Model section.
- Null `capHours` if `pricingMode` is `FIXED`.

### Service description routes

`PATCH /api/billing/[id]`:
- Extend to accept `discountType` and `discountValue` for overall discount.
- Same validation. Only when status is `DRAFT`.

### List view

`GET /api/billing`:
- Update server-side total calculation to account for caps/discounts at both levels.

### Create

`POST /api/billing`:
- No changes. New service descriptions start with no caps/discounts.

## Testing

### Calculation tests (`billing-pdf.test.ts`)

- HOURLY topic with cap: raw hours exceed cap → only capped hours billed
- HOURLY topic with cap: raw hours below cap → no effect
- HOURLY topic with percentage discount
- HOURLY topic with euro amount discount
- HOURLY topic with cap AND discount (cap first, then discount)
- FIXED topic with percentage discount
- FIXED topic with euro amount discount
- Discount producing negative total → floors at 0
- Grand total with overall percentage discount
- Grand total with overall euro amount discount
- Stacking: topic discount + overall discount applied sequentially

### API tests

- `discountType` without `discountValue` rejected (and vice versa)
- Percentage > 100 rejected
- Negative values rejected
- `capHours` nulled when `pricingMode` is `FIXED`
- Overall discount saved and returned on GET
- List view total reflects caps and discounts

## Files to Change

| Area | Files |
|------|-------|
| Schema | `lib/schema.ts` |
| Types | `types/index.ts` |
| Calculation | `lib/billing-pdf.tsx` |
| API - topics | `api/billing/[id]/topics/route.ts`, `api/billing/[id]/topics/[topicId]/route.ts` |
| API - SD | `api/billing/[id]/route.ts`, `api/billing/route.ts` |
| UI - topic | `components/billing/TopicSection.tsx` |
| UI - modal | `components/billing/AddTopicModal.tsx` |
| UI - detail | `components/billing/ServiceDescriptionDetail.tsx` |
| PDF | `lib/billing-pdf.tsx` |
| Tests | `lib/billing-pdf.test.ts` + new API test files |
