# User Impersonation for Admins

## Overview

Allow ADMIN users to impersonate other users to verify production functionality from their perspective. This enables admins to see exactly what regular users see and interact with the system as them.

## Requirements

- Only ADMIN position can impersonate (not PARTNER)
- Full impersonation - can act as the user completely (create time entries, submit timesheets, etc.)
- Visual indicator in sidebar (bottom-left user section) with exit option
- Auto-exits on browser close (no persistent state)
- No audit logging required

## Architecture

### Core Mechanism

Cookie-based impersonation that integrates with the existing `requireAuth()` pattern.

When an admin clicks "Impersonate" on a user row:
1. App calls `POST /api/admin/impersonate` with target user ID
2. Endpoint verifies caller is ADMIN and target exists
3. Sets session cookie `impersonate_user_id`

Cookie configuration:
- `httpOnly: true` (not accessible via JavaScript)
- `sameSite: 'strict'`
- `path: '/'`
- No `maxAge`/`expires` → clears on browser close

### Auth Flow

`requireAuth()` in `api-utils.ts` modified to:
1. Authenticate real user as normal (JWT/session)
2. Check if `impersonate_user_id` cookie exists
3. If yes, verify real user has ADMIN position
4. Return impersonated user's identity instead of real user

All existing API routes automatically respect impersonation since they use `requireAuth()`.

## API Endpoints

### POST /api/admin/impersonate

Start impersonating a user.

**Request:**
```json
{ "userId": "user-id-to-impersonate" }
```

**Logic:**
1. Call `requireAuth()` to get current user
2. Look up current user in DB, verify `position === 'ADMIN'`
3. Verify target user exists and is ACTIVE
4. Prevent self-impersonation
5. Set `impersonate_user_id` cookie
6. Return `{ success: true, user: { id, name, email, position } }`

### DELETE /api/admin/impersonate

Stop impersonating.

**Logic:**
1. Call `requireAuth()` to verify logged in
2. Clear the `impersonate_user_id` cookie
3. Return `{ success: true }`

### GET /api/admin/impersonate

Get current impersonation state.

**Logic:**
1. Check if `impersonate_user_id` cookie exists
2. If yes, fetch that user's details
3. Return `{ impersonating: true, user: { id, name, position } }` or `{ impersonating: false }`

## UI Changes

### Team Page - Impersonate Button

Add "Impersonate" action to each user row. Visible only when:
- Current user's position is ADMIN
- Row is not the current user

Clicking calls `POST /api/admin/impersonate`, then redirects to `/timesheets`.

### Sidebar - Impersonation Indicator

When impersonating, the user profile footer:
- Shows impersonated user's name, position, avatar
- Adds colored border/background tint for visual distinction
- Dropdown includes "Exit Impersonation" above "Sign out"

### ImpersonationContext

React context providing impersonation state:
- `isImpersonating: boolean`
- `impersonatedUser: { id, name, position } | null`
- `startImpersonation(userId): Promise<void>`
- `stopImpersonation(): Promise<void>`

Fetches from `GET /api/admin/impersonate` on mount.

## requireAuth() Modifications

Updated flow:
```
1. Authenticate real user via JWT/session (existing logic)
2. If no valid session → return 401
3. Read `impersonate_user_id` cookie from request
4. If cookie exists:
   a. Look up real user in DB, check position === 'ADMIN'
   b. If not admin → ignore cookie, return real user
   c. Look up impersonated user in DB
   d. If not found or INACTIVE → ignore cookie, return real user
   e. Return session with impersonated user's email/name
5. If no cookie → return real user (existing behavior)
```

## Security

- Cookie is `httpOnly` - client JS cannot read/modify
- Every request re-validates real user is ADMIN
- If admin's position changes mid-session, impersonation stops
- Cannot impersonate INACTIVE users

## Edge Cases

**Admin pages while impersonating non-admin:** Shows limited access - this is expected (seeing what user sees).

**Self-impersonation:** Blocked at API level with error response.

**Impersonating inactive user:** Blocked at API level.

## Files to Create

- `app/src/app/api/admin/impersonate/route.ts` - API endpoints
- `app/src/contexts/ImpersonationContext.tsx` - React context

## Files to Modify

- `app/src/lib/api-utils.ts` - Update `requireAuth()`
- `app/src/components/layout/Sidebar.tsx` - Impersonation indicator
- `app/src/app/(authenticated)/team/page.tsx` - Impersonate button
- `app/src/app/(authenticated)/layout.tsx` - Wrap with ImpersonationProvider
