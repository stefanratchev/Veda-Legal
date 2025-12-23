# Client Section Improvements Design

## Overview

Enhancements to the clients section: multiple contact emails, notes field, CSV export, and improved modal behavior.

## Features

### 1. Secondary Emails Field

**Problem:** Currently only one email per client. Need to store alternate contacts.

**Solution:** Add `secondaryEmails` string field to Client model.

**Schema change:**
```prisma
model Client {
  // ... existing fields ...
  secondaryEmails String?    // Comma-separated additional emails
}
```

**UI:** Single-line text input after main email field. Placeholder: `finance@acme.com, legal@acme.com`

### 2. Notes Field

**Problem:** Notes field exists in schema but not exposed in UI.

**Solution:** Add 5-row resizable textarea to ClientModal, positioned after Status dropdown.

**No schema change required** - field already exists.

### 3. CSV Export

**Trigger:** "Export CSV" button in clients page header (secondary style, next to "Add Client").

**Behavior:**
- Exports all clients (ignores filters)
- Client-side generation
- Filename: `clients-export-YYYY-MM-DD.csv`

**Columns:**
1. Name
2. Timesheet Code
3. Invoiced Name
4. Invoice Attn
5. Email
6. Secondary Emails
7. Hourly Rate
8. Phone
9. Address
10. Practice Area
11. Status
12. Notes
13. Created (YYYY-MM-DD format)

### 4. Modal Close Behavior

**Problem:** Clicking outside modals closes them, causing accidental data loss.

**Solution:** Remove backdrop click handler from all modals. Add Escape key handler.

**Affected modals (7):**
- ClientModal.tsx
- EmployeeModal.tsx
- TopicModal.tsx
- SubtopicModal.tsx
- CreateServiceDescriptionModal.tsx
- AddTopicModal.tsx
- AddLineItemModal.tsx

**Escape key implementation:**
```typescript
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  document.addEventListener("keydown", handleEscape);
  return () => document.removeEventListener("keydown", handleEscape);
}, [onClose]);
```

## Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `secondaryEmails` field |
| `src/components/clients/ClientModal.tsx` | Add secondary emails + notes fields, escape handler |
| `src/components/clients/ClientsContent.tsx` | Add export button + CSV generation |
| `src/app/api/clients/route.ts` | Handle new fields in GET/POST/PATCH |
| `src/components/employees/EmployeeModal.tsx` | Remove backdrop click, add escape |
| `src/components/topics/TopicModal.tsx` | Remove backdrop click, add escape |
| `src/components/topics/SubtopicModal.tsx` | Remove backdrop click, add escape |
| `src/components/billing/CreateServiceDescriptionModal.tsx` | Remove backdrop click, add escape |
| `src/components/billing/AddTopicModal.tsx` | Remove backdrop click, add escape |
| `src/components/billing/AddLineItemModal.tsx` | Remove backdrop click, add escape |

## Migration

Single migration: add `secondaryEmails` nullable string to clients table.

```bash
npm run db:migrate
```

## Notes

- All changes are additive - no breaking changes
- Existing client data unaffected
- Phone, address, practiceArea export as empty until those fields are added to UI
