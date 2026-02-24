# Coding Conventions

**Analysis Date:** 2026-02-24

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `EntryCard.tsx`, `ServiceDescriptionDetail.tsx`)
- API routes: lowercase `route.ts` (Next.js App Router convention)
- Utility modules: kebab-case (e.g., `date-utils.ts`, `api-utils.ts`, `billing-utils.ts`)
- Test files: co-located with source, same name + `.test.ts` / `.test.tsx` suffix
- Hook files: camelCase starting with `use` (e.g., `useClickOutside.ts`, `useCurrentDate.ts`)

**Functions:**
- camelCase for all functions: `formatHours`, `requireAdmin`, `createMockUser`
- Boolean-returning functions use `is`/`has`/`can` prefix: `isValidEmail`, `hasAdminAccess`, `canViewTeamTimesheets`
- Async API handlers named by HTTP method (uppercase export): `GET`, `POST`, `PATCH`, `DELETE`

**Variables:**
- camelCase throughout: `mockRequireAdmin`, `userEmail`, `serviceDescription`
- Constants: SCREAMING_SNAKE_CASE for module-level constants: `ADMIN_POSITIONS`, `MIN_DESCRIPTION_LENGTH`, `MAX_HOURS_PER_ENTRY`

**Types/Interfaces:**
- PascalCase: `TimeEntry`, `ServiceDescription`, `MockUser`
- Type aliases for unions: `ClientType`, `PricingMode`, `WaiveMode`
- Interface props named `[ComponentName]Props`: `EntryCardProps`, `LineItemRowProps`

## Code Style

**Formatting:**
- No Prettier config found — formatting is enforced via ESLint (eslint-config-next)
- Double quotes for strings in JSX attributes
- Trailing commas in multi-line arrays and objects (consistent across codebase)
- 2-space indentation

**Linting:**
- Tool: ESLint 9 with `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Config: `app/eslint.config.mjs`
- `@ts-ignore` not used — `@typescript-eslint/no-explicit-any` violations are commented with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` when unavoidable (e.g., `createMockRequest` in `app/src/test/helpers/api.ts`)

## Import Organization

**Order (consistently observed):**
1. React and framework imports (`"use client"` directive at top of file if needed)
2. Next.js imports (`next/server`, `next/navigation`)
3. Third-party library imports (`drizzle-orm`, `@dnd-kit/*`, etc.)
4. Internal alias imports (`@/lib/...`, `@/types`, `@/components/...`)
5. Relative imports (`./ComponentName`)

**Path Aliases:**
- `@` resolves to `app/src/` (configured in `vitest.config.ts` and `tsconfig.json`)
- Use `@/types` for shared types
- Use `@/lib/...` for utilities
- Use `@/components/...` for components
- Use `@/test/...` for test helpers

**Example:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceDescriptions } from "@/lib/schema";
import { requireAdmin, errorResponse } from "@/lib/api-utils";
import { serializeServiceDescription } from "@/lib/billing-utils";
```

## Error Handling

**API Routes pattern:**
```typescript
// 1. Auth check first, return early on error
const auth = await requireAdmin(request);
if ("error" in auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

// 2. Parse JSON with try/catch
let body;
try {
  body = await request.json();
} catch {
  return errorResponse("Invalid JSON", 400);
}

// 3. Validate inputs, return 400 for bad input
if (!body.someField) {
  return errorResponse("someField is required", 400);
}

// 4. Business logic in try/catch, 500 for unexpected errors
try {
  // DB operations
} catch (error) {
  console.error("Descriptive context message:", error);
  return errorResponse("Human-readable failure message", 500);
}
```

**Error responses always use `errorResponse()` helper from `@/lib/api-utils`:**
```typescript
return errorResponse("Service description not found", 404);
```

**Discriminated union result pattern for auth:**
- `requireAuth` / `requireAdmin` return `{ session } | { error, status }`
- Check with `if ("error" in auth)` before proceeding

## Logging

**Framework:** `console.error` only (no logging library)

**Pattern:**
- `console.error` in API routes catch blocks: `console.error("Database error fetching X:", error)`
- `console.error` in client components for fetch failures: `console.error("Failed to fetch entries:", err)`
- No `console.log` or `console.warn` in source code

## Comments

**When to Comment:**
- File-level JSDoc block for utility modules (e.g., `date-utils.ts`, `api-utils.ts`, `types/index.ts`)
- Function-level JSDoc for public utility functions
- Inline comments for non-obvious logic (timezone edge cases, regex patterns)
- Section dividers with `// 1.`, `// 2.` etc. in complex API handlers
- `// ============================================================================` dividers in longer files

**JSDoc Pattern:**
```typescript
/**
 * Parse hours into separate hours and minutes components.
 * Minutes are rounded to nearest 15-minute increment.
 */
export function parseHoursToComponents(hours: number): { hours: number; minutes: number } {
```

## Function Design

**Size:** Functions are focused and single-purpose. Utility functions rarely exceed 20 lines.

**Parameters:**
- Props interfaces defined inline for components: `interface EntryCardProps { ... }`
- Optional params use `?` or default values: `readOnly = false`, `enabled: boolean = true`
- Overrides pattern for test factories: `createMockUser(overrides: Partial<MockUser> = {})`

**Return Values:**
- API routes always return `NextResponse`
- Utility functions return typed values, never `any` where avoidable
- Async functions explicitly return `Promise<T>` in type signatures for interface props

## TypeScript Usage

**Strict typing:** All shared types defined in `app/src/types/index.ts`

**Type imports:** Use `import type { ... }` for type-only imports:
```typescript
import type { ServiceDescription, WriteOffAction } from "@/types";
```

**Enums:** Prefer string union types over TypeScript enums:
```typescript
export type PricingMode = "HOURLY" | "FIXED";
export type WaiveMode = "EXCLUDED" | "ZERO";
```

**`as const` arrays for position groups:**
```typescript
const ADMIN_POSITIONS = ["ADMIN", "PARTNER"] as const;
```

## React Component Patterns

**Client Components:** Marked with `"use client"` at top of file when using hooks or browser APIs.

**Server Components:** Default — fetch data directly with Drizzle in `page.tsx` or layout files.

**Props pattern:**
```typescript
interface ComponentProps {
  requiredProp: string;
  optionalProp?: boolean;
}

export function ComponentName({ requiredProp, optionalProp = false }: ComponentProps) {
```

**Performance:** `memo` used for list-row components: `export const LineItemRow = memo(function LineItemRow(...)`

**Ref pattern:** `useRef<HTMLElement>(null)` — always typed with explicit null initial value.

## Module Design

**Exports:** Named exports preferred over default exports throughout:
```typescript
export function formatHours(...) { ... }
export function parseHoursToComponents(...) { ... }
```

**Barrel Files:** `app/src/types/index.ts` serves as a barrel. No barrel files in `lib/` or `components/` — import directly from specific files.

**Test utilities:** Exported from `app/src/test/mocks/index.ts` as barrel for mock helpers.

---

*Convention analysis: 2026-02-24*
