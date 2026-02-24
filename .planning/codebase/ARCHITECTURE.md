# Architecture

**Analysis Date:** 2026-02-24

## Pattern Overview

**Overall:** Client-Server with Next.js App Router, Server Components for data fetching, Client Components for interactivity

**Key Characteristics:**
- Server components (`src/app/**/*.tsx`) fetch data via Drizzle ORM and pass to UI as props
- Client components (`"use client"`) handle user interactions and call API routes for mutations
- API routes (`src/app/api/**/*.ts`) serve as backend endpoints with position-based access control
- Three-layer security: middleware authentication, route-group UI redirects, API endpoint authorization checks
- Type-safe data flow with shared types in `@/types` and Drizzle schema as source of truth

## Layers

**Presentation Layer:**
- Purpose: Render UI, handle user interactions, manage local state and UI transitions
- Location: `src/components/`, `src/app/(authenticated)/*/page.tsx`
- Contains: React components (pages, layouts, interactive UI), context providers, hooks
- Depends on: API routes for mutations, types for interfaces, lib utilities for calculations
- Used by: Browser clients

**Business Logic Layer:**
- Purpose: Core calculations, validation, data transformation, authorization rules
- Location: `src/lib/` (api-utils.ts, billing-utils.ts, date-utils.ts, submission-utils.ts, auth-utils.ts)
- Contains: Position-based access control, validation functions, date/time utilities, billing calculations
- Depends on: Database schema, types
- Used by: API routes and server components

**Data Access Layer:**
- Purpose: Query and mutation operations, ORM interaction, database integrity
- Location: `src/lib/schema.ts` (Drizzle schema), `src/lib/db.ts` (client instance)
- Contains: Table definitions with relations, indexes, foreign keys, enums
- Depends on: PostgreSQL schema, Drizzle ORM
- Used by: API routes and server components

**API Route Layer:**
- Purpose: Request routing, authentication/authorization, request/response handling
- Location: `src/app/api/**/*.ts`
- Contains: GET/POST/DELETE/PATCH handlers with auth checks and error handling
- Depends on: Database layer, business logic layer
- Used by: Client components and external services

## Data Flow

**Time Entry Creation (Typical Write Flow):**

1. User fills form in `EntryForm.tsx` (client component)
2. Submit triggers POST `/api/timesheets` with entry data
3. API route validates auth via `requireWriteAccess()` in `src/app/api/timesheets/route.ts`
4. Validates hours/description against constants from `api-utils.ts`
5. Inserts via Drizzle ORM into `timeEntries` table
6. Returns serialized entry (numeric strings converted to numbers via `serializeDecimal()`)
7. Client component receives response, updates local state with `setData()`
8. UI re-renders with new entry

**Service Description Retrieval (Typical Read Flow):**

1. User navigates to `/billing/[id]` page
2. Next.js server component `src/app/(authenticated)/(admin)/billing/[id]/page.tsx` renders
3. Server fetches via Drizzle: `db.query.serviceDescriptions.findFirst()` with nested `with:` relations
4. Component passes fetched data to `ServiceDescriptionDetail` (client component) as prop
5. Client component renders topics and line items, manages drag-and-drop state
6. User edits → client makes API calls → updates local state → re-renders

**State Management:**

- **Page-level state:** React `useState()` in client components (e.g., modal open/close, form values)
- **Request-level state:** React `cache()` in server components (one lookup per request, shared across tree)
- **Session state:** NextAuth session, stored in HTTP-only cookies, validated per API request
- **Persistent state:** Database (Drizzle ORM), file storage (retainer fee snapshots in service description)
- **Context state:** `ImpersonationContext`, `SidebarContext`, `MobileNavContext` (localStorage persists sidebar)

## Key Abstractions

**Position-Based Access Control:**
- Purpose: Enforce role-based permissions for sensitive operations (billing, clients, topics)
- Examples: `src/lib/api-utils.ts` (constants ADMIN_POSITIONS, WRITE_POSITIONS, TEAM_VIEW_POSITIONS)
- Pattern: Define position groups → check position in middleware, layout guards, API routes
- Three tiers: Admin (ADMIN/PARTNER), Write (all staff), Team View (ADMIN/PARTNER only)

**API Auth Functions:**
- Purpose: Centralized authentication and authorization for all endpoints
- Examples: `requireAuth()`, `requireAdmin()`, `requireWriteAccess()` in `src/lib/api-utils.ts`
- Pattern: Call at start of API handler, return error or session → extract user email → lookup in database
- Supports: Server session + JWT fallback (for chunked cookies), user impersonation via cookie

**User Impersonation:**
- Purpose: Allow ADMIN to see app as another user (for support/testing)
- Examples: `src/lib/user.ts`, `src/app/api/admin/impersonate/route.ts`, `ImpersonationContext.tsx`
- Pattern: ADMIN sets `impersonate_user_id` cookie → `getCurrentUser()` and `requireAuth()` check cookie → return impersonated user
- Constraints: Only ADMIN can impersonate, impersonated user must not be INACTIVE

**Service Description Pricing:**
- Purpose: Calculate billable hours and fees with support for multiple modes (hourly, fixed, retainer)
- Examples: `src/lib/billing-pdf.tsx`, `src/lib/billing-utils.ts`
- Pattern: Calculate per-topic totals, apply caps/discounts, then service-description-level discount
- Retainer mode: HOURLY topics consume retainer hours, overage at special rate; FIXED topics always separate
- Write-off modes: EXCLUDED (hidden entirely), ZERO (shown at $0)

**Drag-and-Drop Sorting:**
- Purpose: Reorder topics and line items within service description
- Examples: `src/components/billing/ServiceDescriptionDetail.tsx` (@dnd-kit)
- Pattern: Prefixed IDs (`topic:`, `item:`, `topic-drop:`) distinguish entity types; separate collision detection for topics vs items
- Constraints: Line items can move between topics; topics reorder only

**Date and Timezone Handling:**
- Purpose: Consistent date representation and submission deadline calculation in Bulgaria timezone
- Examples: `src/lib/date-utils.ts`, `src/lib/submission-utils.ts`
- Pattern: Store as ISO strings, use `Intl.DateTimeFormat` for timezone offset (handles DST), deadline is 10 AM EET daily
- Validation: Use `isNotFutureDate()` for user input, `getTimezoneOffsetHours()` for Bulgaria time

## Entry Points

**Web Application:**
- Location: `src/app/layout.tsx` → `src/app/(authenticated)/layout.tsx`
- Triggers: User navigates to `https://domain/`
- Responsibilities: Set up theme, fonts, providers (NextAuth SessionProvider), sidebar/header layout

**API Authentication:**
- Location: `src/app/api/auth/[...nextauth]/route.ts`
- Triggers: User clicks "Login" → redirected to Microsoft 365 login
- Responsibilities: NextAuth configuration, Azure AD integration, session creation, token refresh

**Authenticated Routes:**
- Location: `src/app/(authenticated)/` (dashboard, timesheets, team, billing, clients, reports, topics)
- Triggers: Middleware allows access only if session exists
- Responsibilities: Route group layout provides sidebar, contexts; child pages fetch data and render UI

**Admin Routes:**
- Location: `src/app/(authenticated)/(admin)/` (billing, clients, topics, reports)
- Triggers: User with ADMIN/PARTNER position accesses route
- Responsibilities: Layout-level redirect to `/timesheets` if non-admin; API routes double-check with `requireAdmin()`

**API Routes:**
- Location: `src/app/api/*/route.ts`
- Triggers: Client component calls `fetch('/api/...')` or form submission
- Responsibilities: Authenticate user, check permissions, validate input, execute database operations, return JSON

## Error Handling

**Strategy:** Fail-fast at each layer with clear error messages

**Patterns:**

**API Route Level:**
```typescript
// Check auth first
const auth = await requireAuth(request);
if ("error" in auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

// Validate input
if (!isValidHours(hours)) {
  return errorResponse("Hours must be between 0 and 12", 400);
}

// Execute, catch database errors
try {
  const result = await db.insert(...)...;
  return successResponse(result);
} catch (error) {
  console.error("Database error:", error);
  return errorResponse("Failed to create entry", 500);
}
```

**Server Component Level:**
- If data fetch fails or user not found, throw error (Next.js error boundary catches)
- Error boundary: `src/app/(authenticated)/error.tsx` renders user-friendly error UI

**Client Component Level:**
- Catch API response errors in `.then()` / `.catch()`
- Set error state, render error message in UI
- Example: `src/components/billing/ServiceDescriptionDetail.tsx` tracks `addTopicError`, displays in modal

**Validation:**
- Input validation before database operations (length, format, range)
- Schema constraints at database level (unique indexes, foreign keys, enums)
- Type safety via TypeScript (Drizzle ensures schema matches types)

## Cross-Cutting Concerns

**Logging:**
- Approach: `console.error()` for exceptions (visible in server logs during development and production)
- Example: `src/app/(authenticated)/error.tsx` logs error to console
- No structured logging library; errors bubble up to Sentry or cloud provider logs

**Validation:**
- Location: `src/lib/api-utils.ts` (constants and functions)
- Constants: `MAX_HOURS_PER_ENTRY = 12`, `MIN_DESCRIPTION_LENGTH = 10`, `MAX_NAME_LENGTH = 255`
- Functions: `isValidEmail()`, `isValidHours()`, `isValidDescription()`, `parseDate()`, `isNotFutureDate()`

**Authentication:**
- Mechanism: NextAuth.js with Microsoft 365 (Azure AD) SSO
- Configuration: `src/lib/auth.ts` (providers, callbacks)
- Middleware: `src/middleware.ts` allows `/login` and `/api/auth/*` without token, requires token for all others
- API enforcement: Every non-public endpoint calls `requireAuth()`, `requireAdmin()`, or `requireWriteAccess()`

**Authorization:**
- Position-based: Five levels (ADMIN, PARTNER, SENIOR_ASSOCIATE, ASSOCIATE, CONSULTANT)
- Checked in: UI route groups (layout redirects), API endpoints (requireAdmin), middleware (implicit via session check)
- Admin operations: client management, billing/invoicing, topic management, reports, impersonation
- Write access: all staff can log time entries; PARTNER/SENIOR_ASSOCIATE/ASSOCIATE required for daily submissions
- Team view: only ADMIN/PARTNER can view others' timesheets

**Serialization:**
- Issue: Drizzle returns numeric fields as strings (database precision)
- Solution: `serializeDecimal()` converts to numbers for JSON response
- Applied to: `hours`, `hourlyRate`, `fixedFee`, `capHours`, `retainerFee`, `retainerHours`, discount values
- Example: `src/app/api/timesheets/route.ts` calls `serializeDecimal(entry.hours)`

---

*Architecture analysis: 2026-02-24*
