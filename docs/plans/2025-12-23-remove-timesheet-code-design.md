# Remove Timesheet Code Design

## Overview

Remove the `timesheetCode` field from the Client model entirely. This simplifies data entry and cleans up the UI - the code was unnecessary complexity that isn't used for external integrations.

## Motivation

- **Simplify data entry**: Users don't need to manage/remember codes when creating clients
- **Clean up UI**: The code clutters the interface and isn't used for lookups
- **No external dependencies**: The code is only used internally in this app

## Design

### Database Schema

Remove `timesheetCode` from the Client model in `prisma/schema.prisma`:

```prisma
model Client {
  id            String   @id @default(cuid())
  name          String
  // timesheetCode removed
  // ... other fields
}
```

Create a migration to drop the column. TimeEntry records reference `clientId`, not `timesheetCode`, so they're unaffected.

### TypeScript Types

Update `src/types/index.ts` - remove `timesheetCode` from the Client interface.

### API Routes

**`/api/clients/route.ts`:**
- GET: Remove from select/response
- POST: Remove from required fields

**`/api/reports/route.ts`:**
- Remove from client data in responses

**`/api/timesheets/route.ts`:**
- Remove from any client info in responses

### UI Components

**Client management (`src/components/clients/`):**
- `ClientsContent.tsx`: Remove column from data table
- `ClientModal.tsx`: Remove input field from form

**Client selection (`src/components/ui/ClientSelect.tsx`):**
- Show name only in dropdown (remove code prefix)

**Billing (`src/components/billing/`):**
- `BillingContent.tsx`: Remove from client display
- `CreateServiceDescriptionModal.tsx`: Remove code references

**Reports (`src/components/reports/`):**
- `ReportsContent.tsx`, `ByClientTab.tsx`, `ByEmployeeTab.tsx`: Remove from client displays

**Timesheets:**
- `src/app/(authenticated)/timesheets/page.tsx`: Remove from entry display

### Cleanup

- **Delete** `scripts/import-clients.ts` entirely
- **Modify** `prisma/seed-clients.ts`: Remove timesheetCode from seed data
- **Update** `CLAUDE.md`: Remove timesheetCode from domain terminology

## Scope Summary

| Area | Files | Action |
|------|-------|--------|
| Database | 1 schema + 1 migration | Modify |
| Types | 1 file | Modify |
| API Routes | 3 files | Modify |
| UI Components | ~10 files | Modify |
| Seed data | 1 file | Modify |
| Import script | 1 file | Delete |
| Docs | CLAUDE.md | Modify |

**Total: ~17 files modified, 1 deleted**
