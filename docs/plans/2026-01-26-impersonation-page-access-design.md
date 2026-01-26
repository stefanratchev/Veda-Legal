# Impersonation-Aware Page Access Control

## Problem

When an admin impersonates a non-admin user, the sidebar correctly hides admin-only menu items. However, navigating directly to admin URLs (e.g., `/clients`) still allows access because page-level access checks use `getCurrentUser()`, which returns the real user instead of the impersonated user.

## Solution

Two changes:

1. **Route group for admin pages** - Move admin-only pages into an `(admin)` route group with a shared layout that enforces access control
2. **Update `getCurrentUser()`** - Return the impersonated user when impersonation is active, mirroring how `requireAuth()` already works for API routes

## Implementation

### 1. Folder Structure

Move admin-only pages into `(admin)` route group:

```
app/(authenticated)/
├── (admin)/                      # Admin-only route group
│   ├── layout.tsx                # Single access check
│   ├── billing/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── clients/page.tsx
│   ├── reports/
│   │   └── ...
│   └── topics/
│       └── ...
├── employees/                    # Everyone can view
├── timesheets/                   # Everyone can access
├── layout.tsx
└── page.tsx
```

The `(admin)` parentheses create a route group - URLs remain unchanged (`/clients`, not `/admin/clients`).

### 2. Admin Layout

Create `app/(authenticated)/(admin)/layout.tsx`:

```typescript
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api-utils";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || !["ADMIN", "PARTNER"].includes(user.position)) {
    redirect("/timesheets");
  }

  return children;
}
```

### 3. Update `getCurrentUser()`

Modify `lib/api-utils.ts` to respect impersonation:

```typescript
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.email) return null;

  const realUser = await db.query.users.findFirst({
    where: eq(users.email, session.user.email),
  });

  if (!realUser) return null;

  // Check for impersonation
  const cookieStore = await cookies();
  const impersonateUserId = cookieStore.get("impersonate_user_id")?.value;

  if (impersonateUserId && realUser.position === "ADMIN") {
    const impersonatedUser = await db.query.users.findFirst({
      where: eq(users.id, impersonateUserId),
    });
    if (impersonatedUser && impersonatedUser.status !== "INACTIVE") {
      return impersonatedUser;
    }
  }

  return realUser;
}
```

### 4. Cleanup Redundant Checks

Remove position checks from pages now protected by the admin layout:

| File | Remove |
|------|--------|
| `clients/page.tsx` | Position check + redirect |
| `billing/page.tsx` | Position check + redirect |
| `billing/[id]/page.tsx` | Position check + redirect |

Keep position checks in:
- `reports/page.tsx` - `isAdmin` for data filtering (always true now, but harmless)
- `team/page.tsx` - `readOnly` prop (controls UI, not access)
- `timesheets/page.tsx` - `isAdmin` for UI features
- `layout.tsx` - `isAdmin` for sidebar menu filtering

## Testing

### Unit Tests

- `getCurrentUser()` returns impersonated user when cookie is set and real user is ADMIN
- `getCurrentUser()` returns real user when no cookie
- `getCurrentUser()` returns real user when cookie exists but real user is not ADMIN

### Manual Verification

1. Log in as ADMIN
2. Navigate to `/clients`, `/billing`, `/reports`, `/topics` - all should work
3. Impersonate a non-admin user (e.g., ASSOCIATE)
4. Try navigating directly to `/clients` - should redirect to `/timesheets`
5. Same for `/billing`, `/billing/[id]`, `/reports`, `/topics`
6. Stop impersonation - admin pages accessible again

## Files Changed

- `lib/api-utils.ts` - Update `getCurrentUser()`
- `app/(authenticated)/(admin)/layout.tsx` - New file
- `app/(authenticated)/(admin)/billing/` - Moved from `billing/`
- `app/(authenticated)/(admin)/clients/` - Moved from `clients/`
- `app/(authenticated)/(admin)/reports/` - Moved from `reports/`
- `app/(authenticated)/(admin)/topics/` - Moved from `topics/`
