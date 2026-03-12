# Research: Bulk Waive Implementation for Ready to Bill Page

## Current Architecture

### UI Components

**UnbilledClientsSection.tsx** (`app/src/components/billing/UnbilledClientsSection.tsx`)
- **Role**: Main container component for Ready to Bill page
- **State**:
  - `clients` — list of unbilled client summaries fetched from API
  - `dateRange` — active date filter (preset: "all-time", "last-month", etc., or custom from/to dates)
  - `searchQuery` — client name search filter
  - Tracks loading/refetching state
- **Date Range Logic**:
  - User selects date range via `DateRangePicker` component (line 140)
  - When a non-"all-time" range is active, the filter dates are passed to `handleCreateServiceDescription` (line 101-102) and used as the period for SD creation
  - Date range params are sent to unbilled-summary API: `?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD` (line 56-57)
- **Interaction**: Client cards call `onCreateServiceDescription` callback, which navigates to SD editor or creates one
- **Current limitation**: No selection state, no bulk actions

**UnbilledClientCard.tsx** (`app/src/components/billing/UnbilledClientCard.tsx`)
- **Role**: Individual client card UI (displays name, estimated value, hours, date range)
- **Action**: Single button to "Create Service Description" or "Continue Draft"
- **Props**: Standard client info (name, hours, dates, existing draft ID) + callback
- **Current limitation**: No checkbox/selection support; purely presentational for single-client action

### API Routes

**GET /api/billing/unbilled-summary** (`app/src/app/api/billing/unbilled-summary/route.ts`)
- **Query params**:
  - `dateFrom` (optional, YYYY-MM-DD)
  - `dateTo` (optional, YYYY-MM-DD)
- **Filtering**:
  - Line 45-46: Excludes `isWrittenOff = true` entries
  - Line 44: Excludes entries already in FINALIZED SDs
  - Date range filters (line 49-54) applied to `timeEntries.date`
- **Returns**:
  - Array of unbilled clients with aggregated hours, estimated value, oldest/newest entry dates
  - Also includes draft SD info if one exists for the client
- **Key finding**: The API already filters out written-off entries, so bulk waive will prevent entries from appearing in this list

**POST /api/billing** (`app/src/app/api/billing/route.ts`)
- **Role**: Create new service description with linked time entries
- **Time Entry Filtering** (line 218-233):
  - Fetches unbilled entries for the client in date range
  - Filters out written-off entries (line 227): `if (entry.isWrittenOff) return false;`
  - Filters out entries in FINALIZED SDs
  - Groups by topic
  - Creates line items linked to each entry
- **Key finding**: The flow already handles `isWrittenOff` entries correctly — they're excluded during SD creation

**PATCH /api/timesheets/[id]** (`app/src/app/api/timesheets/[id]/route.ts`)
- **Role**: Update individual time entry (user edits their own entry)
- **Editable fields**: hours, description, client, topic/subtopic
- **Current limitation**: Does not support updating `isWrittenOff` directly
- **Note**: User can only edit entries that aren't linked to a FINALIZED SD (line 108-130)

**PATCH /api/billing/[id]/topics/[topicId]/items/[itemId]** (`app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts`)
- **Role**: Update line item in service description (admin-only)
- **Waive behavior** (line 66-78):
  - `writeOff` param maps to `waiveMode` on the line item:
    - `"HIDDEN"` → `waiveMode = "EXCLUDED"` (removed from bill)
    - `"VISIBLE"` → `waiveMode = "ZERO"` (zero-rated on bill)
    - `null` → `waiveMode = null` (not waived)
  - When a waive action is applied, updates the linked time entry's `isWrittenOff = true` (line 96-100)
  - When a waive is removed, clears `isWrittenOff = false` only if no other line items for that time entry still have `waiveMode` set (line 103-115)
- **Key pattern**: This is the model for bulk waive — set `isWrittenOff = true` on time entries

### Database Schema

**timeEntries table** (`app/src/lib/schema.ts`, line 158-198)
- Column: `isWrittenOff: boolean().default(false).notNull()` (line 169)
- Index on `clientId`, `date`, `userId`, `topicId`, `subtopicId` (line 173-177)
- No direct index on `isWrittenOff` — sequential scan if filtering by it
- The column is already in place and being used; no schema migration needed

**serviceDescriptionLineItems table** (line 70-94)
- Column: `waiveMode: waiveModeEnum()` (line 78)
- Links to `timeEntryId` (nullable)
- Separate concept from time entry's `isWrittenOff` — waiveMode controls how the line item is displayed in the invoice

## Key Findings

### 1. `isWrittenOff` Column Behavior
- **Already exists** on `timeEntries` table (line 169 of schema.ts)
- **Set by**: Line item waiving in SD editor (route.ts line 99-100)
- **Read by**: `unbilled-summary` API (line 46) and `POST /api/billing` SD creation (line 227)
- **Effect**: Written-off entries don't appear in Ready to Bill page and aren't pulled into new SDs
- **Distinction**: `isWrittenOff` on the time entry is separate from `waiveMode` on the line item
  - `isWrittenOff = true` means the entry shouldn't be billed (ever)
  - `waiveMode` (EXCLUDED/ZERO) is transient per SD and controls how the entry is shown on a specific invoice

### 2. Date Range Filtering Works at Multiple Levels
- **UI level**: DateRangePicker in UnbilledClientsSection
- **API level**: `unbilled-summary` accepts `dateFrom` and `dateTo` query params
- **SD creation level**: When creating an SD, the date range from the filter is used as the period (line 101-102 of UnbilledClientsSection)
- **For bulk waive**: Must apply the same date filtering — only waive entries within the active date range

### 3. No Direct Time Entry Bulk Update API Exists
- `/api/timesheets/[id]` (PATCH) updates a single entry by ID; requires user authentication; supports limited fields
- No admin-only bulk endpoint for updating `isWrittenOff` on multiple time entries
- **Required for bulk waive**: New API endpoint `PATCH /api/timesheets/bulk-waive` or similar

### 4. Line Item Waive Pattern Is Not Reusable for Bulk Waive
- The SD editor's waive logic (route.ts line 66-78) operates on line items, not time entries directly
- It maps `writeOff` action → `waiveMode` → `isWrittenOff` on the time entry
- Bulk waive on the Ready to Bill page skips the SD entirely (no line items yet)
- Must set `isWrittenOff` directly on time entries without creating line items

### 5. Authorization: Admin Only
- `requireAdmin` is used in all billing/SD routes
- Bulk waive should require the same: ADMIN or PARTNER role
- UnbilledClientsSection is rendered in `(admin)` route group (`/billing`), so it's already protected at the UI level
- API endpoint must enforce `requireAdmin`

### 6. Confirmation Modal Is Not Part of Existing Components
- UnbilledClientCard has no modal support
- SD editor uses modals for editing topics/items, but that's a different context
- Bulk waive confirmation modal will be new UI

### 7. Undo UI Is Not Supported in Current Architecture
- Once entries are written off, they don't appear in the ready-to-bill list
- To undo, user would need to:
  - Edit the time entry directly (via timesheets page)
  - Or restore waiveMode on a line item in a draft SD if the entry was already pulled into one
- **Current decision**: No undo UI — but entries can be "un-waived" by editing them (though not through Ready to Bill page itself)

## Implementation Approach

### 1. New API Endpoint: `PATCH /api/timesheets/bulk-waive`

**Location**: `app/src/app/api/timesheets/bulk-waive/route.ts`

**Request Body**:
```json
{
  "clientId": "string",
  "dateFrom": "YYYY-MM-DD",
  "dateTo": "YYYY-MM-DD",
  "action": "WAIVE" | "UN_WAIVE"
}
```

**Logic**:
1. Check auth: `requireAdmin()`
2. Validate request body
3. Build WHERE conditions:
   - `eq(timeEntries.clientId, clientId)`
   - `gte(timeEntries.date, dateFrom)`
   - `lte(timeEntries.date, dateTo)`
   - `eq(timeEntries.isWrittenOff, false)` for WAIVE action (skip already-waived)
   - `eq(timeEntries.isWrittenOff, true)` for UN_WAIVE action
4. Update: Set `isWrittenOff = true` (or `false` for undo)
5. Return: Count of updated entries + summary data
6. Side effect: No need to touch line items (they're only created when SD is created)

**Error Cases**:
- Client not found → 404
- No entries matched → Return 0 count (not an error, just no-op)
- Entries already in FINALIZED SD → Skip (don't block, but exclude from update)

**Response**:
```json
{
  "success": true,
  "updatedCount": 42,
  "message": "Waived 42 time entries for Client XYZ"
}
```

### 2. Update UnbilledClientsSection Component

**Add State**:
```tsx
const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
const [showConfirmModal, setShowConfirmModal] = useState(false);
const [isWaiving, setIsWaiving] = useState(false);
```

**Add Checkbox Header**:
- Add header above the client grid with:
  - "Select clients to waive" label
  - Count of selected clients: `{selectedClientIds.size} selected`
  - "Bulk Waive" button (disabled if no selection)

**Handle Selection**:
```tsx
const toggleClientSelection = (clientId: string) => {
  const newSet = new Set(selectedClientIds);
  if (newSet.has(clientId)) {
    newSet.delete(clientId);
  } else {
    newSet.add(clientId);
  }
  setSelectedClientIds(newSet);
};
```

**Pass Selection State to Cards**:
- Add `isSelected` and `onToggleSelect` props to `UnbilledClientCard`
- Card renders checkbox instead of (or alongside) the main action button when in "select mode"

**Confirmation Modal**:
- Show when "Bulk Waive" button is clicked
- Display:
  - Count of selected clients
  - Summary of entries that will be waived (fetch current data for each selected client?)
  - If date range is active: "Will waive entries within [dateFrom] to [dateTo]"
  - If date range is all-time: "Will waive all unbilled entries"
  - Cancel / Confirm buttons

**Handle Waive Action**:
```tsx
const handleBulkWaive = async () => {
  setIsWaiving(true);
  try {
    const promises = Array.from(selectedClientIds).map(clientId =>
      fetch("/api/timesheets/bulk-waive", {
        method: "PATCH",
        body: JSON.stringify({
          clientId,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
          action: "WAIVE",
        }),
      }).then(r => r.json())
    );

    const results = await Promise.all(promises);
    const totalWaived = results.reduce((sum, r) => sum + r.updatedCount, 0);

    // Show success toast/message
    // Clear selection
    setSelectedClientIds(new Set());
    // Refetch unbilled-summary to update the UI
    await fetchUnbilledClients();
  } catch (error) {
    // Show error toast
  } finally {
    setIsWaiving(false);
    setShowConfirmModal(false);
  }
};
```

### 3. Update UnbilledClientCard Component

**Add Props**:
```tsx
interface UnbilledClientCardProps {
  // ... existing props
  isSelected?: boolean;
  onToggleSelect?: (clientId: string) => void;
}
```

**Conditional Rendering**:
- If `isSelected` is true/false (i.e., selection mode is active):
  - Show checkbox on left side + modified button behavior
- If `isSelected` is undefined (normal mode):
  - Keep current "Create Service Description" button

**Checkbox Behavior**:
- Checkbox is not a direct trigger; instead, clicking the card (or a new radio area) toggles selection
- Or: Add checkbox to the top-right corner, keep the button

### 4. No Schema Changes Required
- `isWrittenOff` column already exists
- No new columns, no migrations

### 5. Test Cases

**API Route Tests** (`app/src/app/api/timesheets/bulk-waive/route.test.ts`):
- Bulk waive with valid clientId, dateFrom, dateTo
- Verify correct entries are updated
- Verify count matches
- Bulk waive with all-time dates (omit dateFrom/dateTo)
- Un-waive entries
- Error: invalid clientId
- Error: unauthenticated request
- Error: non-admin user

**Component Tests** (`app/src/components/billing/UnbilledClientsSection.test.tsx`):
- Render with selection UI
- Toggle client selection
- Show/hide confirmation modal
- Call API with correct payload
- Refetch after success
- Show error message on failure

## Risks and Edge Cases

### 1. Date Range Scope Is Implicit
**Risk**: User might forget they have an active date filter and waive more entries than intended.
**Mitigation**:
- Confirmation modal explicitly shows the date range being applied
- If "all-time" filter: clearly state "All unbilled entries for [Client] will be waived"
- If custom range: "Entries between [dateFrom] and [dateTo] will be waived"

### 2. Entries Already in Finalized SDs
**Risk**: Waiving a time entry that's already linked to a finalized SD doesn't make sense (the entry is already billed).
**Mitigation**:
- The API should skip entries already in FINALIZED SDs (filter them out in the WHERE clause)
- The `unbilled-summary` API already does this, so the UI won't show these entries as "unbilled" anyway
- No risk in practice, but the bulk-waive API should handle it gracefully

### 3. Concurrent Edits
**Risk**: User selects clients, then someone else creates an SD with one of those clients, then the waive runs.
**Current behavior**: The waive will still run, setting `isWrittenOff = true` on the entries. Those entries are then not pulled into future SDs, but if they were already in a draft SD, the draft still has them as line items.
**Mitigation**: This is acceptable — entries that are written off simply won't be auto-included in future SDs. Admins can still manage existing draft SDs manually.

### 4. Multiple Date Ranges Not Supported
**Current design**: Single contiguous date range per action.
**Future limitation**: Can't waive entries from, say, Jan 1-10 AND Feb 15-20 in one action.
**Mitigation**: Not a problem for MVP; date ranges are typically contiguous (e.g., "last month").

### 5. No Audit Log
**Current limitation**: No audit trail for bulk waive actions (only the `isWrittenOff` flag is set).
**Future enhancement**: Could add a log table or use `updatedAt` timestamp to infer the action, but not required for MVP.

### 6. No Undo UI in Ready to Bill
**Current design**: Written-off entries disappear from the Ready to Bill list.
**To undo**: User must:
- Navigate to the Timesheets page
- Find the entry and edit it (if it's their own entry)
- Or ask the admin to manually reset `isWrittenOff` via a different interface (which doesn't exist yet)
**Mitigation**: This is acceptable per the task description ("No undo UI"), but document it in the component.

### 7. Client-Level Scope Only
**Risk**: User can't waive individual entries or date-range subsets within a client.
**Current design**: By design (task requirement: "Client-level selection").
**Mitigation**: If granular waiving is needed later, the SD editor already supports per-line-item waiving.

## Recommendations

1. **Start with API endpoint first**: Implement `PATCH /api/timesheets/bulk-waive` with comprehensive tests. This is the core logic and is testable independently.

2. **UI in two phases**:
   - Phase 1: Confirmation modal + button to trigger waive (in UnbilledClientsSection, single-client action)
   - Phase 2: Multi-client selection UI (checkboxes, bulk waive button)

   This lets you test and iterate on the core flow before adding complexity.

3. **Confirmation Modal Should Show Scope Clearly**:
   - If date range is active: "This will waive [N] unbilled entries from [dateFrom] to [dateTo] for [Client Name]"
   - If all-time: "This will waive [N] total unbilled entries for [Client Name]"
   - Fetch live count before showing the modal (or show "Fetching...") to give accurate info

4. **Consider a "Waive All for Client" Button on UnbilledClientCard**:
   - Even before multi-select is implemented, admins might want a quick "waive this client's unbilled time" action
   - This could live on the card alongside "Create Service Description"
   - Simpler UX than multi-select flow

5. **Test with Real Data Scenarios**:
   - Client with 50+ unbilled entries over several months → waive subset by date range
   - Client with entries already in a DRAFT SD → verify waive doesn't affect the draft
   - Client with entries in FINALIZED SD → verify they're excluded from the waive

6. **Document the Behavior**:
   - Add a note to UnbilledClientsSection JSDoc: "Waiving entries hides them from this page and future SDs, but entries already in draft SDs retain their line items."
   - Add a comment to the bulk-waive API route explaining the scope and limitations
