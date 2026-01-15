# Billing Page: Unbilled Clients Cards

**Date:** 2026-01-15
**Status:** Approved

## Problem

The current billing page requires users to select a client from a dropdown before seeing if that client has unbilled hours. This makes it difficult to know which clients need billing without guessing.

## Solution

Add a visual "Clients Ready to Bill" section at the top of the billing page showing cards for each client with unbilled hours. Cards display the estimated unbilled value, hours, and date range. Clicking a card creates a service description immediately.

## Design

### Page Layout

The billing page will have two sections:

1. **Top: "Clients Ready to Bill"**
   - Grid of client cards (3 columns desktop, 2 tablet, 1 mobile)
   - Sorted by estimated unbilled value (highest first)
   - Empty state: "All caught up! No unbilled hours to bill." with link to timesheets

2. **Bottom: "Service Descriptions"**
   - Existing service descriptions list (unchanged)
   - Keeps current filtering (All/Draft/Finalized) and search

### Client Card Design

```
┌─────────────────────────────────┐
│  CLIENT NAME          [DRAFT]   │  ← Badge only if draft exists
│                                 │
│  $4,250                         │  ← Large, accent color
│  estimated unbilled             │
│                                 │
│  17.5 hours                     │
│  Oct 15 – Dec 20, 2024          │  ← Date range of unbilled work
│                                 │
│  [Create Service Description →] │  ← Or "Continue Draft →"
└─────────────────────────────────┘
```

**Card states:**
- **No draft exists:** Button says "Create Service Description →"
- **Draft in progress:** Shows "DRAFT" badge, button says "Continue Draft →"

### Click Behavior

**If no draft exists:**
1. Call `POST /api/billing` with client ID and full unbilled date range
2. Existing API creates service description with all unbilled entries
3. Navigate to `/billing/[id]` detail page

**If draft exists:**
1. Navigate directly to `/billing/[existingDraftId]`
2. No new service description created

### Empty State

When no clients have unbilled hours:
- Hide the cards grid
- Show: "All caught up! No unbilled hours to bill."
- Include subtle link to timesheets page

## API

### New Endpoint: `GET /api/billing/unbilled-summary`

Returns clients with unbilled hours for the cards display.

**Response:**
```typescript
interface UnbilledSummaryResponse {
  clients: Array<{
    clientId: number
    clientName: string
    hourlyRate: number | null
    totalUnbilledHours: number
    estimatedValue: number | null      // null if no hourlyRate set
    oldestEntryDate: string            // "2024-10-15"
    newestEntryDate: string            // "2024-12-20"
    existingDraftId: number | null     // ID of DRAFT service description
    existingDraftPeriod: string | null // "Nov 1 – Nov 30, 2024"
  }>
}
```

**Query logic:**
1. Find all time entries NOT linked to a FINALIZED service description
2. Filter to ACTIVE clients only
3. Group by client
4. For each client:
   - Sum total hours
   - Find min/max entry dates
   - Calculate estimated value (hours × client hourlyRate)
   - Check for existing DRAFT service description
5. Sort by estimatedValue descending (nulls last)
6. Return only clients with totalUnbilledHours > 0

**Authorization:** Requires authenticated user with billing access (ADMIN/PARTNER).

## Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `app/src/app/api/billing/unbilled-summary/route.ts` | API endpoint |
| `app/src/components/billing/UnbilledClientsSection.tsx` | Cards grid container |
| `app/src/components/billing/UnbilledClientCard.tsx` | Individual card |

### Files to Modify

| File | Change |
|------|--------|
| `app/src/components/billing/BillingContent.tsx` | Add UnbilledClientsSection above existing list |

### No Changes Needed

- Service description detail page (`/billing/[id]`)
- `POST /api/billing` endpoint (create service description)
- Database schema
- Existing service descriptions list component

### Component Hierarchy

```
BillingContent
├── UnbilledClientsSection
│   ├── Section heading with count badge
│   ├── UnbilledClientCard (× N)
│   └── Empty state (when no unbilled clients)
└── [Existing service descriptions list]
```

### Styling

- Cards use `--bg-elevated` background
- Estimated value in `--accent-pink`
- Hours and date range in muted text
- Responsive grid using existing Tailwind patterns
- Hover state with subtle elevation
- DRAFT badge uses existing badge styling

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Client has no hourlyRate set | Show "Rate not set" instead of dollar amount |
| Draft exists for client | Show DRAFT badge, click opens existing draft |
| All entries already in finalized SDs | Client doesn't appear in cards |
| New work logged after draft created | Included in card's hours (full unbilled total shown) |
| Client marked inactive | Doesn't appear in cards |

## Testing Requirements

- Unit tests for unbilled-summary API endpoint
- Unit tests for card click behavior (create vs continue draft)
- Component tests for UnbilledClientCard rendering states
- Integration test for full flow: card click → service description created → redirect
