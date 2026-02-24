# Coding Conventions

**Analysis Date:** 2026-02-24

## Naming Patterns

**Files:**
- Source files: camelCase (e.g., `dateUtils.ts`, `WeekStrip.tsx`)
- Test files: `{name}.test.ts` or `{name}.test.tsx` for co-located tests
- API routes: directory structure matches URL (e.g., `/api/timesheets/[id]/route.ts`)
- Components: PascalCase for component files (e.g., `ClientSelect.tsx`, `EntryForm.tsx`)
- Utilities and libraries: camelCase (e.g., `api-utils.ts`, `date-utils.ts`, `billing-config.ts`)

**Functions:**
- camelCase throughout (e.g., `formatDateLong`, `isValidEmail`, `requireAuth`, `createMockUser`)
- Prefix query functions with present tense: `getWeekDays`, `getMonthName`, `getUserFromSession`
- Prefix validation functions with verb: `isValid*`, `requireAuth`, `requireAdmin`, `canViewTeamTimesheets`
- Helper functions preceded with verb: `serializeDecimal`, `parseDate`, `formatHours`

**Variables:**
- camelCase for all variable declarations
- Constants in UPPER_SNAKE_CASE (e.g., `MAX_HOURS_PER_ENTRY`, `MIN_DESCRIPTION_LENGTH`, `EMPTY_SET`, `ADMIN_POSITIONS`)
- Boolean variables prefixed with `is`, `has`, or `can` (e.g., `isLocked`, `hasAdminAccess`, `canViewTeamTimesheets`, `isM365Loading`)
- Mock variables prefixed with `mock` (e.g., `mockRequireAuth`, `mockDb`, `mockOnSelectDate`)

**Types:**
- Interfaces: PascalCase, with optional `Props` suffix for component props (e.g., `WeekStripProps`, `Client`, `TimeEntry`, `MockUser`)
- Type aliases: PascalCase (e.g., `ClientType`, `TopicType`)
- Enum values: UPPER_SNAKE_CASE (e.g., `ACTIVE`, `INACTIVE`, `ADMIN`, `PARTNER`)

## Code Style

**Formatting:**
- ESLint with Next.js core-web-vitals and TypeScript support (config: `eslint.config.mjs`)
- Prettier installed (v3.8.1), assumed default settings (2-space indent, 80-char line length inferred from patterns)
- No explicit `.prettierrc` file - uses Prettier defaults

**Linting:**
- ESLint 9 with `eslint-config-next` for Next.js best practices
- TypeScript strict mode enforced
- Errors on unused variables and imports

**Line Length:**
- Prefer wrapping at ~80-100 characters for readability
- Multiline JSX fragments common for component structure

## Import Organization

**Order:**
1. External libraries (`react`, `next`, npm packages)
2. Internal absolute imports using `@/` path alias
3. No relative imports - always use path alias

**Path Aliases:**
- `@/` → `src/` directory (configured in `vitest.config.ts`)
- Examples: `@/lib/db`, `@/components/timesheets/WeekStrip`, `@/test/mocks/factories`

**Patterns:**
```typescript
// External
import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Internal absolute
import { db } from "@/lib/db";
import { formatDateLong } from "@/lib/date-utils";
import { WeekStrip } from "@/components/timesheets/WeekStrip";
import { createMockUser } from "@/test/mocks/factories";
```

## Error Handling

**API Routes:**
- Return `{ error: string }` object with HTTP status code
- Use `NextResponse.json()` for all responses
- Status codes: 401 (unauthorized), 403 (forbidden), 404 (not found), 400 (bad request), 500 (server error)
- Example pattern:
```typescript
const auth = await requireAuth(request);
if ("error" in auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}
```

**Validation:**
- Dedicated validator functions: `isValidEmail`, `isValidHours`, `isValidDescription`, `isNotFutureDate`
- Return boolean from validators, check result before proceeding
- Validation constants defined in `api-utils.ts`: `MAX_HOURS_PER_ENTRY`, `MIN_DESCRIPTION_LENGTH`, `MAX_DESCRIPTION_LENGTH`, `MAX_NAME_LENGTH`, `MAX_EMAIL_LENGTH`

**Exception Handling:**
- Try-catch blocks used sparingly; rely on explicit error handling
- Type guards used for discriminated unions (e.g., `if ("error" in auth)`)

## Logging

**Framework:** No custom logging framework; uses `console` directly

**Patterns:**
- Debug logs in components use `console.log()` during development
- No logging in tests unless debugging a specific failure
- No production logging configuration visible

## Comments

**When to Comment:**
- JSDoc comments for all exported functions and types explaining purpose and behavior
- Example: `/** Format hours for display (e.g., "2h 30m", "45m", "3h") */`
- Inline comments for non-obvious logic or edge case handling (e.g., DST edge cases, timezone calculations)

**JSDoc/TSDoc:**
- Used for public API functions in utility modules
- Parameter and return types documented in JSDoc
- Example format:
```typescript
/**
 * Parse hours into separate hours and minutes components.
 * Minutes are rounded to nearest 15-minute increment.
 */
export function parseHoursToComponents(hours: number): { hours: number; minutes: number }
```

**Design Documentation:**
- Significant design decisions documented as comments within function
- Example in `WeekStrip.tsx`: `/** Returns the appropriate status icon for a date based on submission status. Priority: submitted > overdue > null **/`

## Function Design

**Size:**
- Functions kept concise, typically 20-50 lines
- Complex logic extracted into separate helper functions
- Example: `getLockedEntryIds()` in `route.ts` extracted as standalone async function

**Parameters:**
- Prefer object parameters for functions with 3+ parameters
- Example: `MockRequestOptions` interface in `createMockRequest()`
- Destructure in parameter list when appropriate

**Return Values:**
- Functions return discriminated unions for error handling: `{ error: string; status: number } | { session: AuthSession }`
- Use Set for efficient lookups (e.g., `getLockedEntryIds()` returns `Set<string>`)
- Async functions always return Promise with explicit type

## Module Design

**Exports:**
- Named exports preferred (not default exports)
- Example: `export function formatDateLong()` not `export default formatDateLong()`
- All exports are functions or interfaces

**Barrel Files:**
- `src/test/mocks/index.ts` re-exports common mocks
- `src/test/helpers/index.ts` re-exports test helpers
- Pattern allows cleaner imports: `import { createMockUser } from "@/test/mocks"`

**File Organization:**
- Utilities grouped by domain: `date-utils.ts`, `api-utils.ts`, `billing-utils.ts`, `submission-utils.ts`
- Tests co-located with source: `date-utils.ts` paired with `date-utils.test.ts`
- Mocks organized hierarchically: `src/test/mocks/` contains auth.ts, db.ts, factories.ts

---

*Convention analysis: 2026-02-24*
