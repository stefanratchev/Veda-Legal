# Billing Start Date Filter

**Date:** 2026-02-04
**Status:** Approved

## Problem

Time entries before February 1, 2026 should not appear in the Billing page as "Clients Ready to Bill". These are historical/test entries that predate the go-live date for billing.

## Solution

Add a `BILLING_START_DATE` constant (`2026-02-01`) that excludes older time entries from all billing-related queries.

## Files to Change

### 1. New: `lib/billing-config.ts`

```typescript
/**
 * Billing configuration constants.
 */

/**
 * The earliest date for time entries to be included in billing.
 * Entries before this date are excluded from:
 * - "Clients Ready to Bill" summary
 * - Auto-populated line items when creating service descriptions
 *
 * Format: YYYY-MM-DD (string comparison works with Drizzle ORM)
 */
export const BILLING_START_DATE = "2026-02-01";
```

### 2. Update: `api/billing/unbilled-summary/route.ts`

Add `gte` to drizzle-orm imports and import the config constant:

```typescript
import { eq, and, isNull, sql, min, max, sum, gte } from "drizzle-orm";
import { BILLING_START_DATE } from "@/lib/billing-config";
```

Update WHERE clause (lines 64-69):

```typescript
.where(
  and(
    eq(clients.status, "ACTIVE"),
    gte(timeEntries.date, BILLING_START_DATE),
    isNull(serviceDescriptions.id)
  )
)
```

### 3. Update: `api/billing/route.ts` (POST handler)

Add import:

```typescript
import { BILLING_START_DATE } from "@/lib/billing-config";
```

Update filter (lines 177-188):

```typescript
const filteredEntries = unbilledEntries.filter((entry) => {
  // Check date range (with billing start date as floor)
  const effectiveStartDate = startDateStr < BILLING_START_DATE
    ? BILLING_START_DATE
    : startDateStr;
  if (entry.date < effectiveStartDate || entry.date > endDateStr) {
    return false;
  }
  // Check if any billing line item is in a FINALIZED service description
  const hasFinalized = entry.billingLineItems.some(
    (li) => li.topic?.serviceDescription?.status === "FINALIZED"
  );
  return !hasFinalized;
});
```

## Files NOT Requiring Changes

| File | Reason |
|------|--------|
| `api/reports/route.ts` | Filters by user-provided date range |
| `api/timesheets/route.ts` | Filters by specific day (user's view) |
| `api/billing/[id]/route.ts` | Fetches by service description ID |
| `api/billing/[id]/pdf/route.tsx` | Fetches existing SD, not raw entries |

## Testing

1. Verify "Clients Ready to Bill" excludes entries before 2026-02-01
2. Verify creating a service description with period starting before 2026-02-01 still excludes old entries
3. Verify entries on/after 2026-02-01 appear correctly
