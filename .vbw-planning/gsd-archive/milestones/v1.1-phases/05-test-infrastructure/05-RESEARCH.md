# Phase 5: Test Infrastructure - Research

**Researched:** 2026-02-25
**Domain:** Playwright e2e test infrastructure with NextAuth JWT auth bypass for Next.js 16
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use an ADMIN-position test user — gives full access to all routes and features, avoiding auth-related test failures that aren't testing auth
- Test user email: `test@vedalegal.bg` (or matching format of real user emails in schema)
- User must exist in `veda_legal_test` database seed data
- 2 clients: 1 REGULAR (e.g., "Acme Corp"), 1 INTERNAL (e.g., the firm's internal client)
- 2 topics: 1 REGULAR-type (e.g., "Corporate Advisory"), 1 INTERNAL-type (e.g., "Firm Administration")
- 3 subtopics under the REGULAR topic: at least 1 with `isPrefix: true` (e.g., "Client correspondence:") and 1 with `isPrefix: false`
- Seed data is reference data — seeded once in global setup, treated as read-only
- Use port 3001 for the test server to avoid conflicts with a running dev server on 3000
- `reuseExistingServer: true` in dev, full `webServer` start in CI
- Developers must create the `veda_legal_test` database manually once; document the one-time setup command
- data-testid naming: kebab-case matching component names: `client-select`, `topic-cascade-select`, `duration-picker`, `entry-card`, `week-strip`, `submit-button`
- Prefix with context if needed for disambiguation (e.g., `entry-form-submit` vs generic `submit`)
- Use obviously-fake but realistic-looking names (not "Test Client 1")

### Claude's Discretion
- All implementation details: file structure, Playwright config specifics, fixture composition patterns
- Exact seed data values (names, descriptions, hours)
- Error handling in fixtures
- Auth setup project internals (JWT encode params, cookie naming)
- beforeEach vs afterEach cleanup ordering (research recommends beforeEach — follow that)
- .env.test structure and variable naming

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-01 | Auth bypass via JWT cookie injection using `next-auth/jwt` `encode()` | Verified `encode()` in `node_modules/next-auth/jwt/index.js`; salt defaults to `""` for session tokens; cookie name `next-auth.session-token` for localhost. See Auth Architecture section. |
| REQ-02 | Playwright config with setup project, Chromium-only, serial execution, HTML reporter | Verified Playwright 1.57.0 config API via official docs; `defineConfig()`, setup project dependencies, `workers: 1`. See Playwright Config section. |
| REQ-03 | Separate test database (`veda_legal_test`) with seed data | Drizzle ORM 0.45.1 works with any `DATABASE_URL`; same `Pool` constructor, just different connection string. See DB Fixtures section. |
| REQ-04 | DB fixtures with `TRUNCATE ... CASCADE` cleanup in `beforeEach` | Playwright fixtures support `use()` pattern for setup/teardown; raw SQL via `pool.query()`. See DB Cleanup section. |
| REQ-05 | Composed test export (`test.extend()`) combining auth + db fixtures | `mergeTests()` or chained `test.extend()` — both work; single `test.extend()` is simpler for 2 fixtures. See Fixture Composition section. |
| REQ-06 | `data-testid` attributes on 6 key components | Zero `data-testid` exists on production components today; confirmed locations for all 6 components. See data-testid Placement section. |
| REQ-07 | `.env.test` with TEST_DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL | `dotenv` 17.2.3 already installed; load in Playwright config via `dotenv/config`. See Environment section. |
| REQ-08 | `test:e2e` and `test:e2e:ui` npm scripts | Standard npm script additions; `npx playwright test` and `npx playwright test --ui`. See Scripts section. |
| REQ-09 | Playwright artifacts in `.gitignore` | Three paths: `e2e/.auth/`, `test-results/`, `playwright-report/`. See Gitignore section. |
| REQ-10 | Smoke test: `/timesheets` renders without redirect to `/login` | Navigate to `/timesheets`, assert page title/heading or `data-testid` element is visible. See Smoke Test section. |
</phase_requirements>

## Summary

This phase sets up Playwright e2e test infrastructure for a Next.js 16 app using NextAuth v4 with Azure AD SSO. The central challenge is auth bypass: real Azure AD OAuth cannot run in tests (no credentials, MFA, IP restrictions). The solution is JWT cookie injection using `next-auth/jwt`'s `encode()` function, which produces a valid JWE token that passes middleware, `getServerSession()`, and `getToken()` checks without any production code changes.

All required packages are already available. `@playwright/test@1.57.0` is a transitive dependency of `next@16.0.10` (confirmed via `npm ls`). However, it must be added as an explicit `devDependency` to pin the version and survive dependency tree changes. `next-auth@4.24.13` provides the `encode()` function. `drizzle-orm@0.45.1`, `pg@8.16.3`, `@paralleldrive/cuid2@3.0.4`, and `dotenv@17.2.3` are all direct dependencies already in `package.json`.

The most critical finding is the JWT salt/cookie name behavior. When `encode()` is called with `salt: ""` (the default when omitted), the encryption key is derived with an empty salt. The middleware's `getToken()` calls `decode()` also with no salt (defaulting to `""`), so the keys match. The cookie name for `http://localhost:*` is `next-auth.session-token` (no `__Secure-` prefix since NEXTAUTH_URL is not HTTPS). This was verified by reading the actual NextAuth source code in `node_modules/next-auth/src/jwt/index.ts` and `node_modules/next-auth/src/next/middleware.ts`.

**Primary recommendation:** Build the auth setup as a setup project that writes a `storageState` JSON file with the JWT cookie. Use `fs.writeFileSync()` to write the cookie directly — no browser interaction needed for JWT generation. All spec files inherit auth via `storageState` in the Chromium project config.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | 1.57.0 | E2E test runner + browser automation | Already in node_modules (transitive via next); must be added to devDependencies for pinning |
| `next-auth/jwt` | 4.24.13 | JWT `encode()` for auth bypass | Same library that validates tokens in production; guarantees token compatibility |
| `drizzle-orm` | 0.45.1 | Test database seeding and verification | Same ORM as production; no schema translation needed |
| `pg` | 8.16.3 | PostgreSQL connection pool for test DB | Direct SQL for TRUNCATE commands; same driver as production |
| `@paralleldrive/cuid2` | 3.0.4 | Generate IDs for seed data | Same ID format as production (`createId()`) |
| `dotenv` | 17.2.3 | Load `.env.test` in Playwright config | Already a direct dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fs` (Node built-in) | — | Write `storageState` JSON programmatically | Auth setup: write JWT cookie to file without browser |
| `path` (Node built-in) | — | Resolve file paths for storageState, env files | Config and setup files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct `fs.writeFileSync` for storageState | `page.context().storageState()` | Browser approach needs a real page load; JWT generation needs no browser at all — `fs.writeFileSync` is simpler and faster |
| `pool.query('TRUNCATE ...')` | Drizzle's `db.delete()` per table | Raw SQL TRUNCATE is a single statement, handles all FK cascades atomically; delete-per-table requires ordering and is slower |
| Single `test.extend()` | `mergeTests()` from separate fixture files | `mergeTests()` adds indirection for only 2 fixtures; single extend is clearer |

### Installation
```bash
cd app
npm install --save-dev @playwright/test
npx playwright install chromium
```

Note: `npx playwright install chromium` downloads the browser binary to `~/.cache/ms-playwright/`. This is a one-time setup. In CI, use `npx playwright install --with-deps chromium` to also install OS-level dependencies.

## Architecture Patterns

### Recommended Project Structure
```
app/
├── e2e/
│   ├── .auth/                    # gitignored — storageState JSON
│   │   └── user.json
│   ├── fixtures/
│   │   ├── auth.ts               # createSessionToken(), auth cookie generation
│   │   ├── db.ts                 # DB connection, seed, cleanup fixture
│   │   └── test.ts               # Composed test export (test.extend with auth + db)
│   ├── helpers/
│   │   └── seed-data.ts          # Seed data constants and insert functions
│   ├── setup/
│   │   └── auth.setup.ts         # Setup project: generates storageState
│   └── specs/
│       └── smoke.spec.ts         # Phase 5 smoke test
├── playwright.config.ts          # Playwright configuration
├── .env.test                     # Test environment variables
└── package.json                  # Updated with test:e2e scripts
```

### Pattern 1: JWT Cookie Injection (Auth Bypass)
**What:** Generate a valid NextAuth JWE token programmatically and write it as a cookie in the storageState JSON file. No browser interaction, no production code changes.
**When to use:** Auth setup project, run once before all tests.
**Critical details verified from source code:**

1. **Salt:** `encode()` defaults `salt` to `""` when omitted. `getToken()` in middleware calls `decode()` without salt, also defaulting to `""`. These MUST match.
2. **Cookie name:** For `http://localhost:*` (not HTTPS), the cookie name is `next-auth.session-token` (no `__Secure-` prefix). Determined by `secureCookie` flag in `getToken()` which checks `NEXTAUTH_URL?.startsWith("https://")`.
3. **Secret:** Must match `NEXTAUTH_SECRET` env var. Both `encode()` and `getToken()` use this.
4. **Token payload:** Must include `email` and `name` fields. `getServerSession()` extracts `session.user.email` which `getCurrentUser()` in `lib/user.ts` uses to query the database.
5. **Token does NOT need:** `accessToken`, `refreshToken`, `expiresAt` — these are for Microsoft Graph API calls, not session validation.

**Example:**
```typescript
// e2e/fixtures/auth.ts
import { encode } from "next-auth/jwt";

export async function createSessionToken(
  email: string,
  name: string,
  secret: string
): Promise<string> {
  return encode({
    token: {
      email,
      name,
      sub: email, // NextAuth convention
    },
    secret,
    // salt defaults to "" — matches getToken() decode behavior
    // maxAge defaults to 30 days — fine for test sessions
  });
}
```

```typescript
// e2e/setup/auth.setup.ts
import { test as setup } from "@playwright/test";
import fs from "fs";
import path from "path";
import { createSessionToken } from "../fixtures/auth";
import { TEST_USER } from "../helpers/seed-data";

const authFile = path.join(__dirname, "../.auth/user.json");

setup("generate auth state", async () => {
  const secret = process.env.NEXTAUTH_SECRET!;
  const token = await createSessionToken(
    TEST_USER.email,
    TEST_USER.name,
    secret
  );

  const storageState = {
    cookies: [
      {
        name: "next-auth.session-token",
        value: token,
        domain: "localhost",
        path: "/",
        expires: -1,        // session cookie
        httpOnly: true,
        secure: false,       // http://localhost, not HTTPS
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2));
});
```

**Source:** `node_modules/next-auth/src/jwt/index.ts` lines 17-24 (encode), lines 68-79 (getToken cookie name logic), `node_modules/next-auth/src/next/middleware.ts` lines 110-114 (middleware getToken call).

### Pattern 2: DB Fixture with Seed and Cleanup
**What:** A Playwright fixture that provides database connection and runs TRUNCATE on mutable tables before each test.
**When to use:** Every test that creates/modifies data (time entries, submissions).
**Key design decisions:**

1. **Separate `Pool` instance** — The test DB fixture creates its own `pg.Pool` pointing at `TEST_DATABASE_URL`. This is NOT the production Drizzle instance.
2. **Seed in global setup** — Reference data (users, clients, topics, subtopics) is inserted once via a `globalSetup` function. Tests treat this as read-only.
3. **TRUNCATE in `beforeEach`** — Mutable tables (`time_entries`, `timesheet_submissions`) are truncated before each test. This handles mid-test failures leaving stale data. Tables with FK dependencies on mutable tables (like `service_description_line_items` → `time_entries`) must be included.
4. **Tables to truncate:** `time_entries`, `timesheet_submissions`. Service description tables can be included for safety but are not created in Phase 5 tests.

**Example:**
```typescript
// e2e/fixtures/db.ts
import { test as base } from "@playwright/test";
import { Pool } from "pg";

// Tables that tests mutate — order doesn't matter with CASCADE
const MUTABLE_TABLES = [
  "service_description_line_items",
  "service_description_topics",
  "service_descriptions",
  "time_entries",
  "timesheet_submissions",
];

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: 2, // Minimal pool for test cleanup
    });
  }
  return pool;
}

export const test = base.extend<{ db: Pool }>({
  db: async ({}, use) => {
    const p = getPool();
    // Cleanup BEFORE test (handles stale state from previous failures)
    await p.query(
      `TRUNCATE ${MUTABLE_TABLES.join(", ")} CASCADE`
    );
    await use(p);
    // No afterEach cleanup needed — next test's beforeEach handles it
  },
});
```

### Pattern 3: Composed Test Export
**What:** A single `test` export that combines auth (via storageState) and db fixture.
**When to use:** All spec files import `{ test, expect }` from this file instead of `@playwright/test`.

**Example:**
```typescript
// e2e/fixtures/test.ts
import { test as dbTest } from "./db";
export { expect } from "@playwright/test";

// DB fixture is the only runtime fixture needed.
// Auth is handled via storageState in playwright.config.ts (project-level).
export const test = dbTest;
```

Note: Auth does not need to be a runtime fixture because it's handled at the project config level via `storageState`. The composed export primarily provides the `db` fixture and re-exports `expect`.

### Pattern 4: Seed Data as Constants
**What:** Deterministic seed data with fixed IDs, inserted once in global setup.
**When to use:** Global setup runs before all tests, populates reference tables.

**Example:**
```typescript
// e2e/helpers/seed-data.ts
import { createId } from "@paralleldrive/cuid2";

// Generate stable IDs once at module load — consistent within a test run
export const TEST_USER = {
  id: createId(),
  email: "test@vedalegal.bg",
  name: "Elena Petrova",
  position: "ADMIN" as const,
  status: "ACTIVE" as const,
};

export const CLIENTS = {
  regular: {
    id: createId(),
    name: "Balkanova Industries",
    clientType: "REGULAR" as const,
    status: "ACTIVE" as const,
  },
  internal: {
    id: createId(),
    name: "Veda Legal (Internal)",
    clientType: "INTERNAL" as const,
    status: "ACTIVE" as const,
  },
};

export const TOPICS = {
  regular: {
    id: createId(),
    name: "Corporate Advisory",
    topicType: "REGULAR" as const,
    status: "ACTIVE" as const,
    displayOrder: 1,
  },
  internal: {
    id: createId(),
    name: "Firm Administration",
    topicType: "INTERNAL" as const,
    status: "ACTIVE" as const,
    displayOrder: 2,
  },
};

export const SUBTOPICS = {
  correspondence: {
    id: createId(),
    topicId: TOPICS.regular.id,
    name: "Client correspondence:",
    isPrefix: true,
    displayOrder: 1,
    status: "ACTIVE" as const,
  },
  drafting: {
    id: createId(),
    topicId: TOPICS.regular.id,
    name: "Drafting shareholder agreement",
    isPrefix: false,
    displayOrder: 2,
    status: "ACTIVE" as const,
  },
  research: {
    id: createId(),
    topicId: TOPICS.regular.id,
    name: "Legal research:",
    isPrefix: true,
    displayOrder: 3,
    status: "ACTIVE" as const,
  },
};
```

### Anti-Patterns to Avoid
- **Adding `CredentialsProvider` to `lib/auth.ts`:** Auth bypass must live entirely in `e2e/`. Never add test-specific providers to production auth config. The `signIn` callback's user whitelist would be bypassed, creating a real security vulnerability.
- **Using `page.waitForTimeout()`:** Playwright's auto-waiting handles timing. Explicit timeouts create fragile tests that either wait too long (slow) or not enough (flaky).
- **Importing from `@/lib/drizzle` in test fixtures:** The production Drizzle instance reads `DATABASE_URL` from `process.env`, which points at the dev database. Test fixtures must create their own connection with `TEST_DATABASE_URL`.
- **Random/generated seed data:** E2e tests need deterministic assertions. "Acme Corp" must always be "Acme Corp". Use `@faker-js` only in unit test factories, never in e2e seed data.
- **CSS class selectors in tests:** Tailwind v4 utility classes are implementation details. Use `data-testid`, `getByRole`, `getByLabel`, `getByText` exclusively.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT token generation | Custom JWE encryption | `next-auth/jwt` `encode()` | Must match NextAuth's exact HKDF key derivation + A256GCM encryption; hand-rolled crypto will not produce compatible tokens |
| Cookie format for storageState | Custom cookie serialization | Playwright's `storageState` JSON format | Format includes `sameSite`, `httpOnly`, `expires` fields that Chromium expects |
| Database cleanup | DELETE FROM per table in order | `TRUNCATE ... CASCADE` single statement | TRUNCATE handles FK dependencies atomically; manual ordering is fragile and breaks when schema changes |
| Browser installation | Manual Chromium download | `npx playwright install chromium` | Playwright manages browser-to-test-runner version compatibility |

**Key insight:** The auth bypass is the most complex part of this phase, and it's entirely solved by one function call (`encode()`) from a library already installed. The temptation to "simplify" by adding a `CredentialsProvider` or `NODE_ENV` check to production code creates a real security risk and is strictly worse.

## Common Pitfalls

### Pitfall 1: Salt Mismatch Between Encode and Decode
**What goes wrong:** JWT encodes with a non-empty salt but the middleware's `getToken()` decodes with the default empty salt. The encryption keys differ, decryption fails silently, and the middleware redirects to `/login`.
**Why it happens:** The `JWTEncodeParams` type accepts an optional `salt` parameter. If you pass `salt: "next-auth.session-token"` (the cookie name), it won't match the middleware's decode which uses `salt: ""`.
**How to avoid:** Do NOT pass a `salt` parameter to `encode()`. The default `""` matches the middleware's behavior. This was verified by reading both `encode()` (line 18: `salt = ""`) and `getToken()` → `_decode({ token, secret })` (line 100: no salt passed to decode).
**Warning signs:** Smoke test navigates to `/timesheets` but ends up on `/login`. Check the auth setup first.

### Pitfall 2: Wrong Cookie Name for Localhost
**What goes wrong:** Cookie is set as `__Secure-next-auth.session-token` but the middleware looks for `next-auth.session-token`. The token is never found.
**Why it happens:** The `__Secure-` prefix is only used when `NEXTAUTH_URL` starts with `https://`. For `http://localhost:3001`, no prefix is used.
**How to avoid:** Use `next-auth.session-token` as the cookie name. Set `secure: false` in the cookie. This matches the `getToken()` logic at `node_modules/next-auth/src/jwt/index.ts` lines 78-79.
**Warning signs:** Same as Pitfall 1 — redirect to `/login` despite valid JWT content.

### Pitfall 3: Test DB Connects to Dev Database
**What goes wrong:** Time entries created during tests appear in the development database. Worse, TRUNCATE wipes development data.
**Why it happens:** The Playwright `webServer.env` is set, but the test fixture creates its own `Pool` using `DATABASE_URL` (the dev database) instead of `TEST_DATABASE_URL`.
**How to avoid:** Test fixtures must ALWAYS use `process.env.TEST_DATABASE_URL`. The web server gets `DATABASE_URL` set to the test database URL via `webServer.env`. These are two separate concerns: (1) the Next.js server needs `DATABASE_URL` pointing to the test DB, (2) the test fixtures need `TEST_DATABASE_URL` for direct DB operations.
**Warning signs:** Data from tests appears in `localhost:3000` (dev server). Or, dev data disappears after running tests.

### Pitfall 4: Database State Leakage Between Tests
**What goes wrong:** Test B sees data from Test A. Or Test B fails with a unique constraint violation because Test A left a `timesheet_submissions` record for the same user+date.
**Why it happens:** TRUNCATE runs in `afterEach` only. If Test A crashes mid-execution, `afterEach` may not run, and Test B starts with stale data.
**How to avoid:** Run TRUNCATE in `beforeEach` (the fixture setup phase, before `use()`). This guarantees a clean slate regardless of how the previous test ended.
**Warning signs:** Tests pass individually but fail when run as a suite. Or tests fail on second run but pass on first.

### Pitfall 5: Playwright Not Explicitly in devDependencies
**What goes wrong:** `@playwright/test@1.57.0` is currently a transitive dependency of `next@16.0.10`. A Next.js update could change the Playwright version or remove it entirely, breaking all e2e tests.
**Why it happens:** Relying on transitive dependencies for test infrastructure.
**How to avoid:** Add `@playwright/test` as an explicit `devDependency` in `package.json`. This pins the version independently of Next.js.
**Warning signs:** Tests break after `npm update next` with no test code changes.

### Pitfall 6: Missing User in Test Database
**What goes wrong:** JWT cookie is valid (passes middleware), but `getCurrentUser()` in `lib/user.ts` queries the database for the user by email and gets `null`. Redirects to `/login`.
**Why it happens:** The seed data step was skipped or the email in the JWT doesn't match the email in the `users` table.
**How to avoid:** The `email` field in the JWT token payload MUST exactly match the `email` column in the seeded `users` row. Verified: `getCurrentUser()` calls `getServerSession(authOptions)` → `session.user.email` → `db.query.users.findFirst({ where: eq(users.email, email) })`.
**Warning signs:** Middleware passes (no redirect at middleware level), but server component redirects to `/login`.

## Code Examples

### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load .env.test from app directory
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Serial execution — shared test database
  reporter: process.env.CI ? "html" : "list",

  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testDir: "./e2e/setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, "e2e/.auth/user.json"),
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "npm run dev -- --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL!,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
      NEXTAUTH_URL: "http://localhost:3001",
      // Azure AD vars not needed — auth bypass via JWT, no real OAuth
    },
  },
});
```

### Global Setup for Database Seeding
```typescript
// playwright.config.ts — add globalSetup
import { defineConfig } from "@playwright/test";

export default defineConfig({
  globalSetup: require.resolve("./e2e/helpers/global-setup"),
  // ... rest of config
});
```

```typescript
// e2e/helpers/global-setup.ts
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import { TEST_USER, CLIENTS, TOPICS, SUBTOPICS } from "./seed-data";

export default async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

  const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
  });

  try {
    // Apply migrations (ensure schema is up to date)
    // This uses drizzle-kit — run via child_process or require drizzle-kit API
    // Alternative: just run `npm run db:migrate` manually before tests

    const now = new Date().toISOString();

    // Upsert test user
    await pool.query(
      `INSERT INTO users (id, email, name, position, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (id) DO UPDATE SET email = $2, name = $3, position = $4, status = $5, updated_at = $6`,
      [TEST_USER.id, TEST_USER.email, TEST_USER.name, TEST_USER.position, TEST_USER.status, now]
    );

    // Upsert clients
    for (const client of [CLIENTS.regular, CLIENTS.internal]) {
      await pool.query(
        `INSERT INTO clients (id, name, "clientType", status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)
         ON CONFLICT (id) DO UPDATE SET name = $2, "clientType" = $3, status = $4, updated_at = $5`,
        [client.id, client.name, client.clientType, client.status, now]
      );
    }

    // Upsert topics
    for (const topic of [TOPICS.regular, TOPICS.internal]) {
      await pool.query(
        `INSERT INTO topics (id, name, "topicType", status, display_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         ON CONFLICT (id) DO UPDATE SET name = $2, "topicType" = $3, status = $4, display_order = $5, updated_at = $6`,
        [topic.id, topic.name, topic.topicType, topic.status, topic.displayOrder, now]
      );
    }

    // Upsert subtopics
    for (const st of [SUBTOPICS.correspondence, SUBTOPICS.drafting, SUBTOPICS.research]) {
      await pool.query(
        `INSERT INTO subtopics (id, topic_id, name, is_prefix, display_order, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         ON CONFLICT (id) DO UPDATE SET topic_id = $2, name = $3, is_prefix = $4, display_order = $5, status = $6, updated_at = $7`,
        [st.id, st.topicId, st.name, st.isPrefix, st.displayOrder, st.status, now]
      );
    }
  } finally {
    await pool.end();
  }
}
```

**Important caveat on column names:** The Drizzle schema uses camelCase in TypeScript (`clientType`, `topicType`, `displayOrder`, `isPrefix`) but the actual PostgreSQL column names may be snake_case (`client_type`, `topic_type`, `display_order`, `is_prefix`) or quoted camelCase depending on how drizzle-kit generated the migration. Check the actual migration SQL to confirm column names. The schema file uses `clientType: clientType()` which in Drizzle typically maps to `"clientType"` (quoted camelCase) in PostgreSQL. Verify by inspecting the database or migration files.

### Smoke Test
```typescript
// e2e/specs/smoke.spec.ts
import { test, expect } from "../fixtures/test";

test.describe("Smoke Test", () => {
  test("loads timesheets page without redirect to /login", async ({ page }) => {
    await page.goto("/timesheets");

    // Should NOT be redirected to /login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/timesheets/);

    // Key UI components should be visible (proving auth + seed data work)
    await expect(page.getByTestId("client-select")).toBeVisible();
    await expect(page.getByTestId("topic-cascade-select")).toBeVisible();
    await expect(page.getByTestId("duration-picker")).toBeVisible();
    await expect(page.getByTestId("week-strip")).toBeVisible();
  });

  test("dropdowns contain seed data", async ({ page }) => {
    await page.goto("/timesheets");

    // Open client dropdown and verify seed clients are present
    await page.getByTestId("client-select").click();
    await expect(page.getByText("Balkanova Industries")).toBeVisible();
    await expect(page.getByText("Veda Legal (Internal)")).toBeVisible();
  });
});
```

### data-testid Placement on Production Components
```typescript
// ClientSelect.tsx — add to outermost div
<div ref={dropdownRef} className={`relative ${className}`} data-testid="client-select">

// TopicCascadeSelect.tsx — add to outermost div
<div ref={dropdownRef} className={`relative ${className}`} data-testid="topic-cascade-select">

// DurationPicker.tsx — add to outermost div
<div className={className} data-testid="duration-picker">

// EntryCard.tsx — add to outermost div
<div className="bg-[var(--bg-surface)] rounded-lg p-3" data-testid="entry-card">

// WeekStrip.tsx — add to outermost div
<div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-3" data-testid="week-strip">

// EntryForm.tsx — add to submit button (both mobile and desktop instances)
// Mobile submit button:
<button onClick={onSubmit} ... data-testid="submit-button">
// Desktop submit button:
<button onClick={onSubmit} ... data-testid="submit-button">
```

**Note on EntryForm submit buttons:** There are two submit buttons (mobile and desktop, controlled by responsive classes). Both should get `data-testid="submit-button"`. Since only one is visible at a time (hidden via `lg:hidden` / `hidden lg:flex`), Playwright's `getByTestId("submit-button")` will match the visible one. Alternatively, use `entry-form-submit-mobile` and `entry-form-submit-desktop` for disambiguation, but this adds complexity for no test benefit since Playwright's `.click()` targets the visible element.

### .env.test Structure
```bash
# app/.env.test
# Test database — MUST be separate from development database
TEST_DATABASE_URL=postgresql://localhost:5432/veda_legal_test

# NextAuth config for test environment
NEXTAUTH_SECRET=test-secret-at-least-32-characters-long-for-e2e
NEXTAUTH_URL=http://localhost:3001
```

### npm Scripts
```json
{
  "scripts": {
    "test:e2e": "npx playwright test",
    "test:e2e:ui": "npx playwright test --ui"
  }
}
```

### .gitignore Additions
```
# Playwright
/e2e/.auth/
/test-results/
/playwright-report/
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `globalSetup` function for auth | Setup projects with dependencies | Playwright 1.31 (2023) | Setup project is a proper test with fixtures; can use `page`/`request`; better error reporting |
| `global-setup.ts` for browser state | `auth.setup.ts` in setup project | Playwright 1.31 (2023) | Setup project files can use `test()` with all Playwright capabilities |
| Random test data with Faker | Deterministic constants | Always (for e2e) | Random data causes assertion failures; e2e needs predictable state |
| `afterEach` cleanup only | `beforeEach` cleanup (defensive) | Community best practice | Handles mid-test failures leaving stale state |

**Deprecated/outdated:**
- `globalSetup` for auth state generation: Still works but setup projects are the recommended pattern since v1.31. Setup projects have proper test context, better parallelization, and clearer error messages.
- `port` option in webServer config: Deprecated in favor of `url` option (which checks HTTP status codes).

## Open Questions

1. **Drizzle column name mapping**
   - What we know: The TypeScript schema uses camelCase property names (`clientType`, `topicType`, `displayOrder`, `isPrefix`). Drizzle-kit generates SQL migrations.
   - What's unclear: Whether the actual PostgreSQL column names are `"clientType"` (quoted camelCase) or `client_type` (snake_case). This affects the raw SQL INSERT statements in the seed function.
   - Recommendation: Check the first migration file (`drizzle/0000_pretty_thing.sql`) to confirm exact column names. Alternatively, use Drizzle ORM for seeding instead of raw SQL (but this requires setting up a Drizzle instance for the test database). The safest approach may be to use Drizzle for seeding since it handles the column name mapping automatically.

2. **Migrations on test database**
   - What we know: Migrations are in `drizzle/` directory. `drizzle-kit migrate` applies them using `DATABASE_URL`.
   - What's unclear: Whether `globalSetup` should run migrations automatically or require a manual one-time step.
   - Recommendation: Document a one-time setup command: `createdb veda_legal_test && DATABASE_URL=postgresql://localhost:5432/veda_legal_test npm run db:migrate`. The `globalSetup` should NOT run migrations automatically — it's slow (~2s) and masks schema issues that should be caught during development.

3. **NEXTAUTH_SECRET value in .env.test**
   - What we know: `encode()` needs a secret that matches what the test server's NextAuth uses for `decode()`.
   - What's unclear: Whether a hardcoded test secret is acceptable or if it should reference the dev `.env` secret.
   - Recommendation: Use a dedicated test secret in `.env.test`. The test server loads NEXTAUTH_SECRET from `webServer.env`, and the auth setup loads it from `.env.test`. As long as both point to the same `.env.test` file, they match. A short, obvious string like `"test-secret-for-e2e-minimum-32-chars!!"` makes it clear this is not a production secret.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.57.0 (`@playwright/test`) |
| Config file | `app/playwright.config.ts` (Wave 0 gap — does not exist yet) |
| Quick run command | `cd app && npm run test:e2e` |
| Full suite command | `cd app && npx playwright test` |
| Estimated runtime | ~15-30 seconds (1 test with dev server startup) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-01 | Auth bypass via JWT cookie — page loads without /login redirect | e2e (smoke) | `npx playwright test smoke` | No — Wave 0 gap |
| REQ-02 | Playwright config works — test launches and completes | e2e (smoke) | `npx playwright test smoke` | No — Wave 0 gap |
| REQ-03 | Test database with seed data — dropdowns show clients/topics | e2e (smoke) | `npx playwright test smoke` | No — Wave 0 gap |
| REQ-04 | TRUNCATE cleanup prevents state leakage — run twice produces same result | e2e (idempotency) | `npx playwright test && npx playwright test` | No — verified manually by running suite twice |
| REQ-05 | Composed test export works — spec files import from fixtures/test | e2e (smoke) | `npx playwright test smoke` | No — Wave 0 gap |
| REQ-06 | data-testid attributes exist — Playwright locators find components | e2e (smoke) | `npx playwright test smoke` | No — Wave 0 gap |
| REQ-07 | .env.test loads correctly — server connects to test DB | e2e (smoke) | `npx playwright test smoke` | No — Wave 0 gap |
| REQ-08 | npm scripts exist — `npm run test:e2e` works | manual | `npm run test:e2e` | No — Wave 0 gap |
| REQ-09 | .gitignore excludes artifacts | manual | `git status` after test run | No — manual verification |
| REQ-10 | Smoke test passes — /timesheets renders | e2e (smoke) | `npx playwright test smoke` | No — Wave 0 gap |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task run: `cd app && npm run test:e2e`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green + run twice to verify idempotency
- **Estimated feedback latency per task:** ~15-30 seconds (single smoke test)

### Wave 0 Gaps (must be created before implementation)
- [ ] `app/playwright.config.ts` — Playwright configuration
- [ ] `app/e2e/setup/auth.setup.ts` — Auth setup project
- [ ] `app/e2e/fixtures/auth.ts` — JWT encode helper
- [ ] `app/e2e/fixtures/db.ts` — Database fixture with cleanup
- [ ] `app/e2e/fixtures/test.ts` — Composed test export
- [ ] `app/e2e/helpers/seed-data.ts` — Seed data constants
- [ ] `app/e2e/helpers/global-setup.ts` — Database seeding function
- [ ] `app/e2e/specs/smoke.spec.ts` — Smoke test
- [ ] `app/.env.test` — Test environment variables
- [ ] `@playwright/test` in `devDependencies` — `npm install --save-dev @playwright/test`
- [ ] `npx playwright install chromium` — Browser binary installation

*(All are gaps — this is a greenfield infrastructure phase)*

## Sources

### Primary (HIGH confidence)
- `node_modules/next-auth/src/jwt/index.ts` — Verified `encode()` salt default (`""`), `getToken()` cookie name logic, `getDerivedEncryptionKey()` HKDF parameters
- `node_modules/next-auth/src/next/middleware.ts` — Verified middleware calls `getToken()` without custom salt or cookieName
- `node_modules/next-auth/src/core/lib/cookie.ts` — Verified `next-auth.session-token` cookie naming with `useSecureCookies` logic
- `node_modules/next-auth/jwt/types.d.ts` — Verified `JWTEncodeParams` interface: `token`, `secret`, `salt`, `maxAge`
- [Playwright Authentication Docs](https://playwright.dev/docs/auth) — storageState pattern, setup projects, cookie format
- [Playwright Test Fixtures](https://playwright.dev/docs/test-fixtures) — `test.extend()`, `mergeTests()`, `use()` pattern
- [Playwright webServer Configuration](https://playwright.dev/docs/test-webserver) — `webServer.env`, `reuseExistingServer`, `url` option
- [Playwright Test Configuration](https://playwright.dev/docs/test-configuration) — `workers`, `reporter`, `retries`, `testDir`
- Direct codebase analysis: `lib/auth.ts`, `lib/user.ts`, `middleware.ts`, `lib/api-utils.ts`, `lib/drizzle.ts`, `lib/schema.ts`, `package.json`, `vitest.config.ts`, `.github/workflows/ci.yml`, `components/ui/ClientSelect.tsx`, `components/ui/TopicCascadeSelect.tsx`, `components/ui/DurationPicker.tsx`, `components/timesheets/EntryCard.tsx`, `components/timesheets/WeekStrip.tsx`, `components/timesheets/EntryForm.tsx`

### Secondary (MEDIUM confidence)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) — locator hierarchy, test isolation patterns
- [Checklyhq - Speed Up Tests with StorageState](https://www.checklyhq.com/blog/speed-up-playwright-tests-with-storage-state/) — storageState JSON format with cookies and origins structure

### Tertiary (LOW confidence)
- None — all findings verified against installed source code or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All packages verified in `node_modules` or `package.json`; zero new packages needed beyond adding `@playwright/test` to devDependencies
- Architecture: HIGH — JWT encode/decode flow traced through actual NextAuth source code; salt, cookie name, and token payload verified line-by-line
- Pitfalls: HIGH — Based on direct source code analysis of NextAuth internals; database schema FK constraints verified in `schema.ts`
- data-testid placement: HIGH — All 6 component files read; exact JSX locations identified for attribute addition

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable — Playwright and NextAuth are mature; no breaking changes expected)
