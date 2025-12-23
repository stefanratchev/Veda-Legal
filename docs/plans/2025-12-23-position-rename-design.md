# Rename Role to Position with New Values

## Summary

Replace the `role` field with `position` field. Add Partner and Senior Associate positions. Partners have admin-level permissions; Associates and Senior Associates have employee-level permissions.

## Database Schema

**Enum change:**
```prisma
enum Position {
  ADMIN           -- hidden from UI, for system admin only
  PARTNER         -- admin-level permissions
  SENIOR_ASSOCIATE -- employee-level permissions
  ASSOCIATE       -- employee-level permissions (default)
}

model User {
  position    Position  @default(ASSOCIATE)
}
```

**Migration:**
1. Rename enum `UserRole` → `Position`
2. Rename column `role` → `position`
3. Add new values: `PARTNER`, `SENIOR_ASSOCIATE`
4. Map existing data: `ADMIN` stays `ADMIN`, `EMPLOYEE` → `ASSOCIATE`

## Permission Logic

Update `lib/api-utils.ts`:

```typescript
const ADMIN_POSITIONS = ['ADMIN', 'PARTNER'] as const;

export function hasAdminAccess(position: string): boolean {
  return ADMIN_POSITIONS.includes(position as typeof ADMIN_POSITIONS[number]);
}
```

Replace all `role === 'ADMIN'` checks with `hasAdminAccess(position)`.

## UI Changes

### Employee Table
- Column header: "Position" (was "Role")
- Display values: Admin, Partner, Senior Associate, Associate

### Employee Modal (Edit/Create)
- Dropdown label: "Position"
- **Options: Partner, Senior Associate, Associate only** (Admin not selectable)
- Display names with spaces (e.g., "Senior Associate")

## Files to Update

1. `prisma/schema.prisma` - enum and field rename
2. `lib/api-utils.ts` - permission helpers
3. `lib/auth-utils.ts` - if role checks exist
4. `components/employees/EmployeesContent.tsx` - table column
5. `components/employees/EmployeeModal.tsx` - dropdown options
6. `components/layout/Sidebar.tsx` - nav filtering
7. `app/(authenticated)/layout.tsx` - role display
8. API routes checking roles - use new helper
