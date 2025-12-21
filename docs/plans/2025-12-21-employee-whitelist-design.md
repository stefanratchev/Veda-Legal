# Employee Whitelist System Design

## Overview

Replace the current "auto-create on login" model with a controlled whitelist system where only pre-authorized employees can access the application.

## Current State

- Users are automatically created in the database on first Azure AD login via `db.user.upsert()`
- Anyone with Azure AD access can log in and become an employee
- Admins can only edit existing users, not create or remove them
- No visibility into who has access until they've logged in

## Goals

1. **Pre-provisioning** - Admins can add employees before they log in and assign roles upfront
2. **Visibility** - Clear view of who is authorized, who has logged in, and who is pending
3. **Control** - Only whitelisted email addresses can access the system

---

## Data Model Changes

### New UserStatus Enum

```prisma
enum UserStatus {
  PENDING    // Created by admin, hasn't logged in yet
  ACTIVE     // Has logged in at least once
  INACTIVE   // Deactivated by admin (soft delete)
}
```

### Updated User Model

```prisma
model User {
  id        String     @id @default(cuid())
  email     String     @unique
  name      String?
  image     String?
  role      Role       @default(EMPLOYEE)
  status    UserStatus @default(PENDING)
  lastLogin DateTime?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  timeEntries TimeEntry[]
}
```

### Login Rules by Status

| Status | Can Login? | Behavior |
|--------|------------|----------|
| PENDING | Yes | Transitions to ACTIVE, updates name/image from Azure AD |
| ACTIVE | Yes | Updates name/image from Azure AD, updates lastLogin |
| INACTIVE | No | Blocked with "account deactivated" message |
| Not in DB | No | Blocked with "not authorized" message |

---

## Authentication Flow Changes

### Modified signIn Callback (auth.ts)

```
User attempts login via Azure AD
         |
   Email in database?
         |
    +----+----+
    No        Yes
    |          |
  BLOCK    Check status
            |
    +-------+-------+
  PENDING  ACTIVE  INACTIVE
    |        |        |
  Allow    Allow    BLOCK
  (->ACTIVE)        ("Account
                    deactivated")
```

### Key Changes

1. **Remove `upsert`** - Replace with `findUnique` lookup
2. **Check existence** - If no user found, return `false` with error
3. **Check status** - If `INACTIVE`, return `false` with error
4. **Update on login** - If `PENDING` or `ACTIVE`:
   - Set status to `ACTIVE`
   - Update name and image from Azure AD
   - Update `lastLogin` timestamp
   - **Keep the existing role unchanged**

### Error Messages

- Not in system: "Your account is not authorized to access this application. Please contact your administrator."
- Deactivated: "Your account has been deactivated. Please contact your administrator."

---

## API Changes

### Endpoint Summary

| Method | Purpose | Access | Status |
|--------|---------|--------|--------|
| GET /api/employees | List employees | All authenticated | Modified |
| POST /api/employees | Create employee | ADMIN only | **New** |
| PATCH /api/employees | Update employee | ADMIN only | Modified |
| DELETE /api/employees | Deactivate employee | ADMIN only | **New** |

### POST /api/employees (Create)

**Request:**
```typescript
{
  email: string,    // Required, valid format, unique
  name?: string,    // Optional (will come from Azure AD on login)
  role: "ADMIN" | "EMPLOYEE"  // Required
}
```

**Response:**
```typescript
{
  id: string,
  email: string,
  name: string | null,
  role: "ADMIN" | "EMPLOYEE",
  status: "PENDING",
  createdAt: string
}
```

**Validations:**
- Email must be valid format
- Email must not already exist in database
- Role must be ADMIN or EMPLOYEE

**Creates user with:**
- `status: PENDING`
- `lastLogin: null`

### DELETE /api/employees (Deactivate)

**Request:**
```typescript
{ id: string }
```

**Validations:**
- User must exist
- Cannot deactivate yourself

**Behavior:**
- Sets `status` to `INACTIVE`
- Does not delete the record (preserves time entries and audit trail)

### GET /api/employees (Modified)

**Query params:**
- `includeInactive=true` - Include deactivated users (admin only)

**Default behavior:**
- Returns only `PENDING` and `ACTIVE` users
- Adds `status` field to response

### PATCH /api/employees (Modified)

**Additional allowed field:**
- `status` - Can set to `ACTIVE` or `INACTIVE` (for reactivation)

---

## UI Changes

### Employees Page

#### 1. Add "Add Employee" Button (Admin Only)
- Located in page header, next to search
- Opens EmployeeModal in create mode

#### 2. EmployeeModal Updates
- Support create mode (new) and edit mode (existing)
- Create mode fields:
  - Email (required) - text input with validation
  - Name (optional) - text input
  - Role (required) - dropdown
- Edit mode: same as current (name, role only - email not editable)

#### 3. Enhanced Employee Table

**New "Status" column with badges:**
- `PENDING` - Amber/yellow badge, displays "Invited"
- `ACTIVE` - Green badge, displays "Active"
- `INACTIVE` - Gray badge, displays "Deactivated" (only visible with filter)

**Last Login column:**
- Shows "Never" for `PENDING` users

#### 4. Status Filter Dropdown
- Options:
  - "All Active" (default) - shows PENDING + ACTIVE
  - "Pending Only" - shows only PENDING
  - "Include Deactivated" - shows all statuses

#### 5. Row Actions (Admin Only)
- **Deactivate** - For PENDING and ACTIVE users
  - Confirmation dialog: "Deactivate [name]? They will no longer be able to log in."
  - Cannot deactivate yourself (button disabled with tooltip)
- **Reactivate** - For INACTIVE users only
  - Sets status back to ACTIVE

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Admin adds email that already exists | Error: "An employee with this email already exists" |
| Admin tries to deactivate themselves | Blocked: Button disabled with explanatory tooltip |
| Deactivated user tries to log in | Blocked with "account deactivated" message |
| Unknown email tries to log in | Blocked with "not authorized" message |
| Admin reactivates a user | Status -> ACTIVE, user can log in again |
| User logs in, name changed in Azure AD | Name and image update on each login |

---

## Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `UserStatus` enum, add `status` field to User |
| `src/lib/auth.ts` | Replace upsert with whitelist check logic |
| `src/app/api/employees/route.ts` | Add POST, DELETE handlers; update GET, PATCH |
| `src/components/employees/EmployeeModal.tsx` | Support create mode, add email field |
| `src/components/employees/EmployeesContent.tsx` | Add button, status column, filters, actions |
| `src/app/(authenticated)/employees/page.tsx` | Minor updates for new data/props |

## Files Unchanged

- Time entries, clients, reports, billing pages
- Other API routes
- Role-based access logic

---

## Migration Notes

### Existing Users

When the migration runs, all existing users should be set to `ACTIVE` status (they've already logged in under the old system).

```sql
UPDATE "User" SET status = 'ACTIVE' WHERE status IS NULL;
```

### Rollback

If needed, reverting to the old behavior requires:
1. Removing the status check from `auth.ts`
2. Restoring the `upsert` logic
3. The status field can remain (no data loss)
