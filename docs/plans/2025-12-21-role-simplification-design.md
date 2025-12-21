# Role Simplification Design

## Overview

Simplify the role system from 5 roles (ADMIN, PARTNER, ASSOCIATE, PARALEGAL, EMPLOYEE) to 2 roles (ADMIN, EMPLOYEE) with clear access boundaries.

## Role Definitions

### ADMIN
- Full access to: Clients, Employees, Timesheets, Billing, Reports
- Can view and manage all employee timesheets
- Can create/update/delete clients and employees

### EMPLOYEE
- Access to: Employees (read-only), Timesheets (own entries only)
- Can view all employees but cannot modify
- Can only see and manage their own timesheet entries

## Access Matrix

### Navigation Visibility

| Nav Item | Admin | Employee |
|----------|-------|----------|
| Clients | Visible | Hidden |
| Employees | Visible | Visible |
| Timesheets | Visible | Visible |
| Billing | Visible | Hidden |
| Reports | Visible | Hidden |

### Removed from Navigation
- Dashboard (placeholder)
- Cases (placeholder)
- Calendar (placeholder)
- Settings (placeholder)

### API Permissions

| Endpoint | Admin | Employee |
|----------|-------|----------|
| `GET /api/clients` | All clients | 403 Forbidden |
| `POST/PUT/DELETE /api/clients` | Allowed | 403 Forbidden |
| `GET /api/employees` | All employees | All employees |
| `POST/PUT/DELETE /api/employees` | Allowed | 403 Forbidden |
| `GET /api/timesheets` | All entries | Own entries only |
| `POST/PUT/DELETE /api/timesheets` | Any entry | Own entries only |

## Database Migration

### Role Mapping
- PARTNER → ADMIN
- ASSOCIATE → ADMIN
- PARALEGAL → EMPLOYEE
- EMPLOYEE → EMPLOYEE (unchanged)
- ADMIN → ADMIN (unchanged)

### New Enum
```prisma
enum UserRole {
  ADMIN
  EMPLOYEE
}
```

## Files to Change

### Schema & Migration
- `prisma/schema.prisma` – Update UserRole enum
- New migration SQL – Map old roles to new roles

### Authorization
- `src/lib/api-utils.ts` – Replace `WRITE_ROLES` with `requireAdmin()` helper

### API Routes
- `src/app/api/clients/route.ts` – Use `requireAdmin()` for all operations
- `src/app/api/employees/route.ts` – `requireAdmin()` for mutations, `requireAuth()` for GET
- `src/app/api/timesheets/route.ts` – Add user-based filtering for Employee role
- `src/app/api/timesheets/dates/route.ts` – Add user-based filtering for Employee role

### UI Components
- `src/components/layout/Sidebar.tsx` – Filter nav items by role, remove placeholder pages
- `src/app/(authenticated)/layout.tsx` – Pass user role to Sidebar

### Route Protection
- `src/app/(authenticated)/clients/page.tsx` – Redirect Employee to `/timesheets`
- `src/app/(authenticated)/billing/page.tsx` – Redirect Employee (placeholder)
- `src/app/(authenticated)/reports/page.tsx` – Redirect Employee (placeholder)
