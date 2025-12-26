# Timesheet Entry Editing

## Overview

Allow employees to edit time entries after creation to fix mistakes. Previously, entries were immutable (delete and recreate only).

## Rules

- Users can only edit their **own** entries
- Editable fields: client, topic/subtopic, hours, description
- Date is **not** editable (entries stay on the day they were logged)
- Entries linked to a **finalized** service description are **locked** (cannot be edited)
- No audit trail required - entries are updated directly

## API

### `PATCH /api/timesheets/[id]`

**Request body:**
```typescript
{
  clientId?: string;
  subtopicId?: string | null;
  hours?: number;
  description?: string;
}
```

**Authorization checks (in order):**
1. User must be authenticated
2. Entry must exist → 404 if not
3. Entry must belong to current user → 403 if not
4. Entry must not be linked to finalized service description → 403 if locked

**Response:**
- `200` with updated entry on success
- `403` if entry belongs to another user
- `403` if entry is locked (billed)
- `404` if entry not found

### Checking if entry is billed

Query chain: `timeEntries` → `serviceDescriptionLineItems` → `serviceDescriptionTopics` → `serviceDescriptions`

```typescript
const billedEntry = await db
  .select({ status: serviceDescriptions.status })
  .from(serviceDescriptionLineItems)
  .innerJoin(serviceDescriptionTopics,
    eq(serviceDescriptionLineItems.topicId, serviceDescriptionTopics.id))
  .innerJoin(serviceDescriptions,
    eq(serviceDescriptionTopics.serviceDescriptionId, serviceDescriptions.id))
  .where(and(
    eq(serviceDescriptionLineItems.timeEntryId, entryId),
    eq(serviceDescriptions.status, 'FINALIZED')
  ))
  .limit(1);

const isLocked = billedEntry.length > 0;
```

## UI

### Edit button behavior

- Unlocked entry: Edit button (pencil icon) is enabled
- Locked entry: Edit button is disabled (grayed out) with tooltip: "This entry has been billed and cannot be edited"

### Inline editing flow

1. User clicks edit button on EntryCard
2. Card content is replaced with EntryForm component (pre-populated with entry data)
3. Date picker is hidden (date not editable)
4. Button shows "Save Changes" instead of "Add Entry"
5. Cancel button exits edit mode without saving
6. Save calls `PATCH /api/timesheets/[id]`
7. On success, card returns to display mode with updated values

### Data flow

```
TimesheetsContent
  └─ EntriesList (passes isLocked to each entry)
       └─ EntryCard (shows edit button, disabled if locked)
            └─ EntryForm (in edit mode, pre-populated)
```

## Files to Change

### New files
- `app/src/app/api/timesheets/[id]/route.ts` - PATCH endpoint
- `app/src/app/api/timesheets/[id]/route.test.ts` - API tests

### Modified files
- `app/src/components/timesheets/EntryCard.tsx` - add edit button, edit mode, render EntryForm
- `app/src/components/timesheets/EntryForm.tsx` - add initialValues, entryId, onCancel props
- `app/src/types/index.ts` - add isLocked to TimeEntry type
- `app/src/app/(authenticated)/timesheets/page.tsx` or `TimesheetsContent.tsx` - compute and pass isLocked
- `CLAUDE.md` - update Time Entry Immutability section

## Testing

### API tests
- PATCH returns updated entry for own entry
- PATCH returns 403 when editing another user's entry
- PATCH returns 403 when entry is linked to finalized service description
- PATCH returns 404 for non-existent entry
- PATCH validates fields (hours > 0, description not empty)
- PATCH updates topicName/subtopicName when subtopicId changes

### Component tests
- EntryCard shows edit button
- EntryCard edit button is disabled when isLocked={true}
- Clicking edit renders EntryForm with entry values pre-filled
- EntryForm in edit mode shows "Save Changes" button
- EntryForm in edit mode hides date picker
- Cancel button exits edit mode without saving
