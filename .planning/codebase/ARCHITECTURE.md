# Architecture

**Analysis Date:** 2026-02-24

## Pattern Overview

**Overall:** Next.js App Router with server/client component split, REST API routes, and PostgreSQL via Drizzle ORM.

**Key Characteristics:**
- Server Components fetch data directly via Drizzle ORM — no data-fetching layer in between
- Client Components manage interactivity and call Next.js API routes for mutations
- Two-layer authorization: middleware (JWT token check) + route group layouts + API route guards
- Serialization layer converts Drizzle's raw DB types (numeric strings) into typed API responses

## Layers

**Middleware:**
- Purpose: JWT presence check for all routes except `/login` and `/api/auth`
- Location: `app/src/middleware.ts`
- Contains: `withAuth` from NextAuth, route matching config
- Depends on: NextAuth JWT cookies
- Used by: Next.js request pipeline (runs before every request)

**Route Group Layouts (Server Components):**
- Purpose: UI-level access control and layout composition
- Location: `app/src/app/(authenticated)/layout.tsx`, `app/src/app/(authenticated)/(admin)/layout.tsx`
- Contains: `getCurrentUser()` calls, position checks, redirect logic, context provider wrapping
- Depends on: `lib/user.ts`, context providers
- Used by: All page components within each route group

**Page Components (Server Components):**
- Purpose: Data fetching at route level, passing hydrated data to client components
- Location: `app/src/app/(authenticated)/**/*.tsx` (any `page.tsx`)
- Contains: Direct Drizzle queries, data serialization calls, passing props to `*Content.tsx`
- Depends on: `lib/db.ts`, `lib/user.ts`, `lib/billing-utils.ts`
- Used by: Next.js App Router rendering pipeline

**Client Components (`*Content.tsx`, `*Detail.tsx`):**
- Purpose: Interactive UI, state management, optimistic updates, calling API routes for mutations
- Location: `app/src/components/**/*.tsx` (marked `"use client"`)
- Contains: `useState`, `useCallback`, `fetch()` calls to `/api/*`, form handling
- Depends on: `@/types`, context providers, UI components
- Used by: Page components (passed serialized server data as props)

**API Routes:**
- Purpose: Mutation endpoints (POST/PATCH/DELETE) and data endpoints for client-initiated fetches
- Location: `app/src/app/api/**/*.ts`
- Contains: Auth guards, Drizzle queries, validation, JSON responses
- Depends on: `lib/api-utils.ts` or `lib/auth-utils.ts`, `lib/db.ts`, `lib/schema.ts`
- Used by: Client components via `fetch()`

**Library / Utilities:**
- Purpose: Shared logic — auth helpers, validation, billing calculations, date utilities
- Location: `app/src/lib/*.ts`
- Contains: Pure functions, Drizzle client, schema, NextAuth config
- Depends on: External packages only (no components or API routes)
- Used by: All layers above

## Data Flow

**Read (Server-rendered page):**

1. Request arrives → `middleware.ts` checks JWT → allows through
2. `(authenticated)/layout.tsx` calls `getCurrentUser()` → redirects if unauthenticated
3. `(admin)/layout.tsx` calls `getCurrentUser()` → redirects if non-admin (for admin routes)
4. `page.tsx` (Server Component) queries Drizzle directly → calls `serializeServiceDescription()` or similar
5. Page renders client component (e.g., `ServiceDescriptionDetail`) with serialized props
6. Client component hydrates in browser, manages UI state

**Write (Client-initiated mutation):**

1. Client component calls `fetch('/api/timesheets', { method: 'POST', body: ... })`
2. API route calls `requireAuth(request)` or `requireAdmin(request)` from `lib/api-utils.ts`
3. Auth helper checks session → optionally resolves impersonated user
4. API route validates input, runs Drizzle query
5. Returns JSON response
6. Client component updates local state (optimistic or on response)

**Authentication & Impersonation:**

1. Azure AD SSO via NextAuth → JWT stored in cookie
2. `getCurrentUser()` in `lib/user.ts` reads session + checks `impersonate_user_id` cookie
3. If ADMIN has set impersonation cookie, returns impersonated user's profile
4. API routes use `requireAuth()` from `lib/api-utils.ts` which also resolves impersonation
5. `ImpersonationContext` in client components syncs state via `/api/admin/impersonate`

**State Management:**
- Server state: React Server Components (no client cache layer)
- Client state: `useState` local to component trees — no global state store
- Shared client state: Three React contexts — `ImpersonationContext`, `SidebarContext`, `MobileNavContext`
- Context providers are composed in `(authenticated)/layout.tsx`

## Key Abstractions

**`getCurrentUser()` — `app/src/lib/user.ts`:**
- Purpose: Authoritative user resolution for Server Components
- Pattern: React `cache()` wrapped async function — deduped per request
- Returns `AuthenticatedUser` (id, name, position, initials, image)
- Handles impersonation transparently

**`requireAuth()` / `requireAdmin()` — `app/src/lib/api-utils.ts`:**
- Purpose: Auth guards for API routes
- Pattern: Called at top of every API handler, returns `{ session }` or `{ error, status }`
- Both versions handle impersonation cookie logic

**`serializeServiceDescription()` — `app/src/lib/billing-utils.ts`:**
- Purpose: Converts raw Drizzle query result (numeric strings) to typed `ServiceDescription`
- Pattern: Called in both server pages and API routes before returning data

**Billing Calculations — `app/src/lib/billing-pdf.tsx`:**
- Purpose: Single source of truth for all billing math
- Functions: `calculateTopicTotal()`, `calculateGrandTotal()`, `calculateRetainerSummary()`, `calculateRetainerGrandTotal()`
- Also contains the React PDF template (`ServiceDescriptionPDF`) for PDF export
- Used by both client components (for live UI totals) and server API route for PDF generation

**Drizzle Schema — `app/src/lib/schema.ts`:**
- Purpose: Single source of truth for all DB tables, enums, and relations
- Pattern: All table definitions + relations co-located; re-exported via `lib/db.ts`
- DB types inferred via `InferSelectModel` / `InferInsertModel` in `lib/db-types.ts`

## Entry Points

**Root Layout — `app/src/app/layout.tsx`:**
- Triggers: Every request
- Responsibilities: Font loading (Roboto, Roboto Condensed), `SessionProvider` wrapper via `Providers.tsx`, HTML/body structure

**Authenticated Layout — `app/src/app/(authenticated)/layout.tsx`:**
- Triggers: Any route under `/(authenticated)/`
- Responsibilities: `getCurrentUser()` call, `ImpersonationProvider`, `MobileNavProvider`, `SidebarProvider`, `Sidebar`, `OverdueBanner`, `MobileHeader`

**Admin Layout — `app/src/app/(authenticated)/(admin)/layout.tsx`:**
- Triggers: Any route under `/(authenticated)/(admin)/`
- Responsibilities: Position check — redirects non-ADMIN/PARTNER to `/timesheets`

**Middleware — `app/src/middleware.ts`:**
- Triggers: Every request matching the path pattern
- Responsibilities: JWT presence check, blocks unauthenticated requests before any layout runs

**API Auth — `app/src/app/api/auth/[...nextauth]/`:**
- Triggers: NextAuth callbacks (signIn, jwt, session)
- Responsibilities: Azure AD SSO, whitelist check, token refresh, user record update on login

## Error Handling

**Strategy:** Catch-and-log at API boundaries; UI error boundaries at route level.

**Patterns:**
- API routes wrap Drizzle queries in `try/catch` → return `NextResponse.json({ error }, { status: 500 })`
- Client components use `try/catch` around `fetch()` → display inline error states
- Route-level error boundary: `app/src/app/(authenticated)/error.tsx` (Client Component with `reset()`)
- Auth errors return early from API handlers: `if ("error" in auth) return NextResponse.json(...)` pattern used consistently

## Cross-Cutting Concerns

**Logging:** `console.error()` / `console.warn()` in API routes and auth callbacks — no structured logging library.

**Validation:** Input validated in API routes using helpers from `lib/api-utils.ts` (`isValidHours`, `isValidEmail`, `isValidDescription`, `parseDate`, `isNotFutureDate`). Constants: `MAX_HOURS_PER_ENTRY = 12`, `MIN_DESCRIPTION_LENGTH = 10`.

**Authentication:** Two-path auth check — `getServerSession(authOptions)` first, fallback to `getToken()` (JWT) for chunked-cookie scenarios. Both `lib/api-utils.ts` and `lib/auth-utils.ts` implement this pattern (slight duplication — `auth-utils.ts` is the newer, cleaner version used by admin routes).

**ID Generation:** `createId()` from `@paralleldrive/cuid2` used for all new record IDs.

**Decimal Serialization:** Drizzle returns `numeric` columns as strings — `serializeDecimal()` in `lib/api-utils.ts` converts to `number | null` before returning JSON.

---

*Architecture analysis: 2026-02-24*
