# Last Login Column for Employees Table

## Overview

Add a "Last Login" column to the employees table showing when each employee last signed in via Microsoft 365 SSO. Display uses relative time (e.g., "2 hours ago") with absolute date/time visible on hover.

## Current State

- `lastLogin` field already exists in User schema (`prisma/schema.prisma:19`)
- Field is already updated during sign-in in `auth.ts` signIn callback
- Employees table currently shows: Name, Email, Role, Created, Actions

## Design

### Column Placement

Name → Email → Role → Created → **Last Login** → Actions

### Display Format

**Primary display (relative time):**
- Less than 1 minute → "Just now"
- Less than 1 hour → "X minutes ago"
- Less than 24 hours → "X hours ago"
- Less than 7 days → "X days ago"
- Less than 30 days → "X weeks ago"
- Otherwise → "X months ago"
- Null value → "Never"

**Hover tooltip (absolute):** "21 Dec 2024, 14:32"

## Implementation

### Files to Modify

1. **`app/src/app/(authenticated)/employees/page.tsx`**
   - Add `lastLogin` to the Prisma select query
   - Serialize `lastLogin` to ISO string for client component

2. **`app/src/app/api/employees/route.ts`**
   - Add `lastLogin` to `EMPLOYEE_SELECT` constant
   - Update `serializeEmployee` to handle `lastLogin`

3. **`app/src/components/employees/EmployeesContent.tsx`**
   - Add `lastLogin: string | null` to `Employee` interface
   - Add `formatRelativeTime(dateStr: string | null): string` helper
   - Add `formatAbsoluteTime(dateStr: string | null): string` helper for tooltip
   - Add new column definition with hover tooltip via `title` attribute

### No Changes Required

- Database schema (field already exists)
- Auth logic (already updates `lastLogin` on sign-in)
- Types in `@/types` (Employee interface is local to component)
