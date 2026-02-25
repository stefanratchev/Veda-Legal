# Architecture Research

**Domain:** Playwright e2e test integration with Next.js 16 + NextAuth v4 (JWT) + PostgreSQL/Drizzle
**Researched:** 2026-02-25
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Playwright Test Runner                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ auth.setup  │  │ timesheet   │  │ submission  │  │  weekstrip   │  │
│  │   .ts       │  │  .spec.ts   │  │  .spec.ts   │  │  .spec.ts    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  │
│         │                │               │                │           │
│         │  ┌─────────────┴───────────────┴────────────────┴────────┐  │
│         │  │          Shared Fixtures & Helpers                     │  │
│         │  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │  │
│         │  │  │ auth     │  │ db-seed  │  │ page-objects     │     │  │
│         │  │  │ fixture  │  │ fixture  │  │ (TimesheetsPage) │     │  │
│         │  │  └──────────┘  └──────────┘  └──────────────────┘     │  │
│         │  └──────────────────────┬────────────────────────────────┘  │
│         │                        │                                    │
├─────────┴────────────────────────┼────────────────────────────────────┤
│                    storageState  │  DB seeding/cleanup                │
│                    (JWT cookie)  │  (direct Drizzle)                  │
│                        │         │                                    │
├────────────────────────┼─────────┼────────────────────────────────────┤
│               Next.js Dev Server │(port 3001)                         │
│  ┌─────────────────────┼─────────┼──────────────────────────────┐    │
│  │          Middleware  │         │                               │    │
│  │    (withAuth - JWT   │         │                               │    │
│  │     validation)      │         │                               │    │
│  │          │           │         │                               │    │
│  │  ┌───────┴─────┐    │    ┌────┴───────┐                       │    │
│  │  │ Server      │    │    │ API Routes │                       │    │
│  │  │ Components  │    │    │ (requireAuth│                       │    │
│  │  │ (getCurrent │    │    │  via JWT)   │                       │    │
│  │  │  User)      │    │    └────┬───────┘                       │    │
│  │  └─────────────┘    │         │                               │    │
│  └─────────────────────┼─────────┼───────────────────────────────┘    │
│                        │         │                                    │
├────────────────────────┼─────────┼────────────────────────────────────┤
│                   Test Database  │(veda_legal_test)                    │
│  ┌─────────────────────┼─────────┼───────────────────────────────┐    │
│  │         PostgreSQL   │         │                               │    │
│  │  ┌──────────┐  ┌────┴────┐  ┌─┴────────┐  ┌──────────────┐   │    │
│  │  │ users    │  │ clients │  │ time_    │  │ timesheet_  │   │    │
│  │  │          │  │         │  │ entries  │  │ submissions │   │    │
│  │  └──────────┘  └─────────┘  └──────────┘  └──────────────┘   │    │
│  └───────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Auth Setup Project | Generate JWT cookie, save as storageState | `next-auth/jwt` `encode()` + `storageState` file |
| DB Seed Fixture | Insert/clean test data around each test | Direct Drizzle ORM connection to test database |
| Page Object Models | Encapsulate page interactions | Playwright locator wrappers per page |
| Test Specs | Assert user-visible behavior | Playwright test files using fixtures |
| Web Server | Serve the app under test | `npm run dev` on port 3001 with test env vars |
| Test Database | Isolated PostgreSQL database | Same schema as dev, seeded per-test |

## Recommended Project Structure

```
app/
├── e2e/                           # All Playwright e2e files (OUTSIDE src/)
│   ├── playwright.config.ts       # Playwright configuration
│   ├── .env.test                  # Test-specific env vars (DATABASE_URL, NEXTAUTH_SECRET)
│   ├── fixtures/
│   │   ├── auth.ts                # Auth fixture: JWT encode + cookie injection
│   │   ├── db.ts                  # Database fixture: seed/cleanup helpers
│   │   └── test.ts                # Extended test with all fixtures composed
│   ├── helpers/
│   │   ├── seed-data.ts           # Test data factories (users, clients, topics, entries)
│   │   └── db-utils.ts            # Drizzle client for test DB + migration runner
│   ├── page-objects/
│   │   └── timesheets.page.ts     # TimesheetsPage: locators + action methods
│   ├── setup/
│   │   └── auth.setup.ts          # Setup project: generate storageState files
│   └── specs/
│       ├── timesheet-entry.spec.ts    # Create, edit, delete time entries
│       ├── weekstrip-nav.spec.ts      # Date navigation via WeekStrip
│       └── submission.spec.ts         # Daily submit/revoke flow
├── src/                           # Existing source (unchanged)
│   ├── test/                      # Existing Vitest test helpers (unchanged)
│   └── ...
└── vitest.config.ts               # Existing Vitest config (unchanged)
```

### Structure Rationale

- **`e2e/` at app root (not inside `src/`):** Playwright tests are a separate test runner from Vitest. Keeping them outside `src/` prevents Vitest from picking them up (vitest.config.ts includes `src/**/*.test.ts`) and avoids confusion. Playwright has its own config file.
- **`fixtures/`:** Playwright fixtures are the idiomatic way to share setup/teardown logic. Composing auth + db fixtures into a custom `test` export gives every spec file automatic auth and data isolation.
- **`page-objects/`:** Encapsulating page interactions (fill client dropdown, click save, wait for entry card) keeps specs readable and reduces maintenance when UI changes.
- **`setup/`:** Playwright's setup project pattern (preferred over `globalSetup` since Playwright 1.31+) generates auth state files that downstream test projects depend on. This runs once, not per-test.
- **`specs/`:** Test files grouped by feature, matching the milestone scope.

## Architectural Patterns

### Pattern 1: JWT Cookie Injection (Auth Bypass)

**What:** Generate a valid NextAuth JWT token using `encode()` from `next-auth/jwt`, inject it as a `next-auth.session-token` cookie via Playwright's `storageState` mechanism. This bypasses Azure AD SSO entirely -- no browser-based OAuth flow needed.

**Why this works for this project:** The app uses NextAuth v4 with `strategy: "jwt"` (confirmed in `lib/auth.ts`). JWT sessions are self-contained encrypted tokens -- no database session table exists. The middleware (`withAuth`) and API routes (`getToken()`, `getServerSession()`) both validate the JWT from the cookie. By encoding a token with the same `NEXTAUTH_SECRET`, the generated cookie is indistinguishable from a real login.

**Why NOT use Next.js experimental testmode:** Next.js 16 ships `next/experimental/testmode/playwright` which can intercept server-side fetch calls. However, it is explicitly experimental, primarily designed for fetch mocking (not auth bypass), and does not help with the core problem of authenticated page access. The JWT cookie approach is simpler, stable, and well-documented.

**Why NOT use a Credentials Provider for test:** Adding a test-only CredentialsProvider introduces production-risk code paths. The JWT encode approach requires zero changes to production code.

**Trade-offs:** Requires `NEXTAUTH_SECRET` to be available in the test environment (acceptable since this is a private internal app). Token must include fields that `signIn` callback and `jwt` callback would normally set (email, name).

**Example:**

```typescript
// e2e/fixtures/auth.ts
import { encode } from "next-auth/jwt";
import { test as base, type BrowserContext } from "@playwright/test";
import path from "path";

const TEST_USER = {
  email: "test@vedalegal.bg",
  name: "Test User",
};

const STORAGE_STATE_PATH = path.join(__dirname, "../.auth/user.json");

export async function createSessionToken(user: { email: string; name: string }) {
  const token = await encode({
    token: {
      email: user.email,
      name: user.name,
      sub: user.email, // NextAuth uses sub as user identifier
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: 8 * 60 * 60, // Match app's 8-hour session
  });
  return token;
}

// Setup project writes storageState to disk
// e2e/setup/auth.setup.ts
import { test as setup } from "@playwright/test";
import { createSessionToken } from "../fixtures/auth";

setup("authenticate test user", async ({ browser }) => {
  const token = await createSessionToken({
    email: "test@vedalegal.bg",
    name: "Test User",
  });

  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "next-auth.session-token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false, // localhost is not HTTPS
      expires: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
    },
  ]);

  await context.storageState({ path: STORAGE_STATE_PATH });
  await context.close();
});
```

**Integration points with existing code:**
- `middleware.ts`: `withAuth` validates JWT via `next-auth/jwt` internally -- the injected cookie satisfies this check with no middleware changes needed.
- `lib/api-utils.ts`: `requireAuth()` calls `getServerSession()` then falls back to `getToken()`. Both will decode the injected JWT successfully.
- `lib/user.ts`: `getCurrentUser()` calls `getServerSession()` then looks up the user by email in the database. The test user MUST exist in the test database for this to work.
- `lib/auth.ts`: The `signIn` callback checks user existence in the database -- but this callback only runs during actual OAuth sign-in, not during JWT validation. No interaction during e2e tests.

**Confidence:** HIGH -- This pattern is well-documented across multiple sources and aligns exactly with NextAuth v4's JWT validation path. Verified that `next-auth/jwt` exports `encode` in the installed version (4.24.13).

### Pattern 2: Test Database Isolation

**What:** Use a separate PostgreSQL database (`veda_legal_test`) for e2e tests. Seed required data before tests, clean up after. The test database has the same schema as dev (applied via Drizzle migrations) but contains only test-specific data.

**Why a separate database (not the dev database):** E2e tests create, modify, and delete records. Using the dev database would corrupt development data and make tests non-deterministic (existing data interferes with assertions).

**Why NOT use transactions for isolation:** The app runs in a separate process (Next.js dev server). The test runner and the server are in different processes -- they cannot share a database transaction. Transaction-based isolation only works when test code and app code share the same process.

**Trade-offs:** Requires creating a test database and running migrations against it. Tests must run sequentially (single worker) since they share database state. This is acceptable for ~10-15 timesheet-focused tests.

**Example:**

```typescript
// e2e/helpers/db-utils.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../../src/lib/schema";

let pool: Pool | null = null;

export function getTestDb() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: 5,
    });
  }
  return drizzle(pool, { schema });
}

export async function runMigrations() {
  const db = getTestDb();
  await migrate(db, { migrationsFolder: "./drizzle" });
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
```

```typescript
// e2e/fixtures/db.ts
import { test as base } from "@playwright/test";
import { getTestDb } from "../helpers/db-utils";
import { seedTestUser, seedTestClients, seedTestTopics, cleanupTestData } from "../helpers/seed-data";

type DbFixtures = {
  seedDb: { userId: string; clientId: string };
};

export const test = base.extend<DbFixtures>({
  seedDb: async ({}, use) => {
    const db = getTestDb();

    // Seed required data
    const userId = await seedTestUser(db);
    const clientId = await seedTestClients(db);
    await seedTestTopics(db);

    // Provide IDs to test
    await use({ userId, clientId });

    // Cleanup after test
    await cleanupTestData(db);
  },
});
```

**Confidence:** HIGH -- Direct database access via Drizzle ORM for seeding/cleanup is the standard pattern for Playwright + PostgreSQL. The existing Drizzle schema and migrations make this straightforward.

### Pattern 3: Playwright Setup Project (Not globalSetup)

**What:** Use Playwright's project dependency feature to define a "setup" project that runs auth setup before test projects. This replaces the older `globalSetup` pattern.

**Why setup project over globalSetup:** Setup projects produce traces, appear in HTML reports, can use fixtures, and support the Playwright inspector. `globalSetup` runs outside Playwright's test infrastructure and lacks these features. Playwright's official documentation now recommends setup projects as the preferred approach.

**Trade-offs:** Slightly more config in `playwright.config.ts`, but better debugging experience.

**Example:**

```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load test-specific env vars
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

export default defineConfig({
  testDir: "./specs",
  fullyParallel: false, // Sequential -- shared test database
  workers: 1,           // Single worker -- database isolation
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Setup project: generate auth state
    {
      name: "setup",
      testDir: "./setup",
      testMatch: "**/*.setup.ts",
    },

    // Main test project: depends on setup
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "npm run dev -- --port 3001",
    port: 3001,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL!,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
      NEXTAUTH_URL: "http://localhost:3001",
    },
    timeout: 60_000,
  },
});
```

**Key detail -- webServer `env`:** The `env` option passes environment variables to the dev server process. This is how the Next.js server connects to the test database instead of the dev database. The `DATABASE_URL` points to `veda_legal_test`, not the dev database.

**Confidence:** HIGH -- Setup projects are the documented best practice since Playwright 1.31+. Installed version is 1.57.0.

### Pattern 4: Page Object Model for Timesheets

**What:** Encapsulate page interactions in a class that maps to the Timesheets page. Methods like `createEntry()`, `editEntry()`, `deleteEntry()`, `navigateToDate()`, and `submitDay()` abstract away locator details.

**Why:** The timesheet page has complex interactions (dropdowns, duration picker, cascading topic selects). Encoding these as reusable methods prevents test fragility and makes specs readable.

**Trade-offs:** Slight upfront effort to build the page object, but pays off immediately since all 3 spec files interact with the same page.

**Example:**

```typescript
// e2e/page-objects/timesheets.page.ts
import { type Page, type Locator } from "@playwright/test";

export class TimesheetsPage {
  readonly page: Page;
  readonly clientSelect: Locator;
  readonly topicSelect: Locator;
  readonly durationPicker: Locator;
  readonly descriptionInput: Locator;
  readonly saveButton: Locator;
  readonly entryCards: Locator;
  readonly submitButton: Locator;
  readonly weekStrip: Locator;

  constructor(page: Page) {
    this.page = page;
    this.clientSelect = page.getByTestId("client-select");
    this.topicSelect = page.getByTestId("topic-cascade-select");
    this.durationPicker = page.getByTestId("duration-picker");
    this.descriptionInput = page.getByPlaceholder(/description/i);
    this.saveButton = page.getByRole("button", { name: /save/i });
    this.entryCards = page.getByTestId("entry-card");
    this.submitButton = page.getByRole("button", { name: /submit/i });
    this.weekStrip = page.getByTestId("week-strip");
  }

  async goto() {
    await this.page.goto("/timesheets");
    await this.page.waitForLoadState("networkidle");
  }

  async createEntry(opts: {
    client: string;
    topic: string;
    subtopic?: string;
    hours: string;
    description: string;
  }) {
    // Select client from dropdown
    await this.clientSelect.click();
    await this.page.getByRole("option", { name: opts.client }).click();

    // Select topic (and subtopic if provided)
    await this.topicSelect.click();
    await this.page.getByRole("option", { name: opts.topic }).click();
    if (opts.subtopic) {
      await this.page.getByRole("option", { name: opts.subtopic }).click();
    }

    // Set duration
    await this.durationPicker.fill(opts.hours);

    // Enter description
    await this.descriptionInput.fill(opts.description);

    // Save
    await this.saveButton.click();

    // Wait for entry to appear
    await this.page.waitForResponse("**/api/timesheets");
  }
}
```

**Note on `data-testid` attributes:** The current components likely do NOT have `data-testid` attributes. Adding them to key interactive elements (client select, topic select, duration picker, entry cards, submit button, week strip days) is a minimal, non-breaking change to production code that dramatically improves test stability over CSS selectors or text matching. This is the single production code change needed for e2e test support.

**Confidence:** HIGH -- Page Object Model is the standard Playwright pattern for complex page interactions.

## Data Flow

### Authentication Flow (Test vs Production)

```
PRODUCTION:
  Browser → /login → Azure AD OAuth → Redirect → NextAuth signIn callback
    → JWT encoded → Set next-auth.session-token cookie → Authenticated

TEST:
  auth.setup.ts → encode() with NEXTAUTH_SECRET → Set cookie in storageState
    → storageState loaded by test browser context → Authenticated
    (No Azure AD interaction, no signIn callback, no OAuth redirect)
```

### Test Data Flow

```
Before Each Test:
  db fixture → connect to veda_legal_test → INSERT test user, clients,
    topics, subtopics → pass IDs to test

During Test:
  Playwright browser → Next.js (port 3001) → API routes → Drizzle ORM
    → veda_legal_test database (reads/writes)

After Each Test:
  db fixture → DELETE FROM time_entries, timesheet_submissions
    → (optionally) DELETE test users/clients/topics
```

### Key Data Flows

1. **Auth state reuse:** Setup project encodes JWT once, writes `storageState` to `.auth/user.json`. All test specs load this file via Playwright config `use.storageState`. No per-test auth overhead.

2. **Database seeding:** Each test spec (or test) uses the `seedDb` fixture to insert required reference data (user, client, topic, subtopic). Time entries and submissions are created by the tests themselves through the UI, then verified via assertions on the page AND optionally queried from the test database for validation.

3. **Cleanup ordering:** `cleanupTestData()` must delete in reverse FK order: `timesheet_submissions` -> `time_entries` -> (optionally reference data). Since `time_entries` has FK constraints to `users`, `clients`, `topics`, `subtopics`, and `service_description_line_items` has FK to `time_entries`, cleanup must respect this dependency chain.

## Integration Points with Existing Architecture

### NextAuth Middleware (No Changes Needed)

| Component | File | Integration | Changes Required |
|-----------|------|-------------|------------------|
| Middleware | `src/middleware.ts` | `withAuth` validates JWT from cookie | NONE -- injected JWT passes validation |
| Auth Options | `src/lib/auth.ts` | `signIn` callback not invoked during JWT validation | NONE |
| API Auth | `src/lib/api-utils.ts` | `requireAuth()` calls `getToken()` which decodes JWT | NONE |
| User Lookup | `src/lib/user.ts` | `getCurrentUser()` looks up user by email from session | NONE -- but test user MUST exist in test DB |
| Session Type | `src/types/next-auth.d.ts` | Extended session fields (accessToken, error) | NONE -- e2e tests don't use M365 features |

### Database (New Test Database Required)

| Component | File | Integration | Changes Required |
|-----------|------|-------------|------------------|
| Drizzle Client | `src/lib/drizzle.ts` | Reads `DATABASE_URL` env var | NONE -- webServer `env` overrides to test DB |
| Schema | `src/lib/schema.ts` | Same schema for test DB | NONE |
| Migrations | `drizzle/*.sql` | Applied to test DB during setup | NONE -- existing migrations work as-is |
| Drizzle Config | `drizzle.config.ts` | Reads `DATABASE_URL` env var | NONE -- test setup uses programmatic migration |

### UI Components (Minimal Changes)

| Component | File | Change | Purpose |
|-----------|------|--------|---------|
| ClientSelect | `src/components/ui/ClientSelect.tsx` | Add `data-testid="client-select"` | Stable locator for Playwright |
| TopicCascadeSelect | `src/components/ui/TopicCascadeSelect.tsx` | Add `data-testid="topic-cascade-select"` | Stable locator |
| DurationPicker | `src/components/ui/DurationPicker.tsx` | Add `data-testid="duration-picker"` | Stable locator |
| EntryCard | `src/components/timesheets/EntryCard.tsx` | Add `data-testid="entry-card"` | Stable locator |
| WeekStrip | `src/components/timesheets/WeekStrip.tsx` | Add `data-testid="week-strip"` | Stable locator |
| Submit button | `src/components/timesheets/TimesheetsContent.tsx` | Add `data-testid="submit-button"` | Stable locator |

### Build & CI

| Component | File | Integration | Changes Required |
|-----------|------|-------------|------------------|
| CI Workflow | `.github/workflows/ci.yml` | Add Playwright test step after unit tests | NEW step needed |
| Package Scripts | `app/package.json` | Add `test:e2e` script | NEW script |
| Git Ignore | `app/.gitignore` | Ignore Playwright artifacts | ADD entries |

## Scaling Considerations

| Concern | Current Scale (~15 tests) | Future Scale (~100 tests) |
|---------|---------------------------|---------------------------|
| Execution time | ~30-60 seconds with 1 worker | Consider parallel workers with per-worker DB schemas |
| Database isolation | Single DB, sequential tests | Worker-indexed schemas or testcontainers |
| Auth state | Single test user sufficient | Multiple storageState files per role |
| CI resources | Local PostgreSQL in CI | GitHub Actions service container for PostgreSQL |

### Scaling Priorities

1. **First bottleneck (unlikely for this milestone):** Test execution time. With ~15 tests and 1 worker, total run time should be under 2 minutes. Not a concern yet.
2. **Second bottleneck (future milestones):** If e2e coverage expands to billing, reports, client management -- consider worker-level database isolation to enable parallel execution.

## Anti-Patterns

### Anti-Pattern 1: Testing Against Dev Database

**What people do:** Run Playwright tests against the same PostgreSQL database used for development.
**Why it's wrong:** Tests create/delete data, corrupting dev state. Tests become non-deterministic because pre-existing data affects assertions. A developer running the app locally during a test run causes data conflicts.
**Do this instead:** Create a dedicated `veda_legal_test` database. Point the Next.js dev server at it via `webServer.env.DATABASE_URL` in Playwright config.

### Anti-Pattern 2: Adding a CredentialsProvider for Test Auth

**What people do:** Add a `CredentialsProvider` to `authOptions` that accepts test credentials, gated by `process.env.NODE_ENV === 'test'`.
**Why it's wrong:** Introduces a code path that ONLY exists for testing. Risk of accidentally enabling it in production. Adds complexity to `auth.ts`. Unnecessary when JWT encode achieves the same result without any production code changes.
**Do this instead:** Use `encode()` from `next-auth/jwt` to create a valid session token. Zero production code changes.

### Anti-Pattern 3: Intercepting /api/auth/session in Playwright

**What people do:** Use `page.route("**/api/auth/session", ...)` to return a mock session object.
**Why it's wrong:** Only intercepts client-side requests. Server components and server-side `getServerSession()` calls still need a real JWT cookie. The middleware validates the JWT before the route handler ever runs. Client-side interception alone does not provide authenticated access.
**Do this instead:** Inject the JWT cookie so ALL auth checks pass -- middleware, server components, and API routes.

### Anti-Pattern 4: Using `globalSetup` for Auth

**What people do:** Use Playwright's `globalSetup` function to set up auth and seed the database.
**Why it's wrong:** `globalSetup` runs outside Playwright's test infrastructure. No traces, no HTML report entries, no fixture support, no Playwright inspector access. Makes debugging setup failures much harder.
**Do this instead:** Use a setup project with `dependencies` in `playwright.config.ts`. This is Playwright's recommended approach since v1.31.

### Anti-Pattern 5: Seeding Data Through the UI

**What people do:** Create test data (users, clients, topics) by navigating through the admin pages in Playwright before running actual tests.
**Why it's wrong:** Extremely slow (multiple page navigations per setup). Fragile (UI changes break data setup, not just test assertions). Creates coupling between unrelated features.
**Do this instead:** Seed data directly via Drizzle ORM in fixtures. Reserve UI interactions for the features actually being tested.

## Build Order (Dependency-Aware)

The following build order respects dependencies -- each phase depends on the previous:

### Phase 1: Infrastructure (No tests yet)

1. Create test database (`veda_legal_test`) and document setup
2. Create `e2e/` directory structure
3. Write `e2e/playwright.config.ts` with webServer, setup project, and chromium project
4. Write `e2e/.env.test` with `TEST_DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
5. Write `e2e/helpers/db-utils.ts` (Drizzle client for test DB, migration runner)
6. Write `e2e/helpers/seed-data.ts` (test data factories)
7. Write `e2e/fixtures/auth.ts` (JWT encode helper)
8. Write `e2e/setup/auth.setup.ts` (generate storageState)
9. Write `e2e/fixtures/db.ts` (seed/cleanup fixture)
10. Write `e2e/fixtures/test.ts` (composed test export with auth + db)
11. Add `data-testid` attributes to key UI components
12. Add `test:e2e` script to `package.json`
13. Add Playwright artifacts to `.gitignore`
14. Verify: one smoke test (`page.goto("/timesheets")` renders without redirect to `/login`)

**Why this order:** Auth bypass must work before any test can run. Database seeding must work before tests can create entries (need client/topic reference data). The smoke test validates the entire infrastructure chain.

### Phase 2: Core Timesheet Tests

15. Write `e2e/page-objects/timesheets.page.ts`
16. Write `e2e/specs/timesheet-entry.spec.ts` (create, edit, delete entries)
17. Write `e2e/specs/weekstrip-nav.spec.ts` (date navigation)
18. Write `e2e/specs/submission.spec.ts` (submit/revoke daily timesheet)

**Why this order:** Page object first because all specs use it. Entry CRUD before submission because submission depends on having entries.

### Phase 3: CI Integration

19. Add Playwright step to `.github/workflows/ci.yml` (PostgreSQL service container, run migrations, run tests)
20. Verify CI pipeline passes

## Environment Configuration

### Required Environment Variables for Tests

```bash
# e2e/.env.test
TEST_DATABASE_URL=postgresql://localhost:5432/veda_legal_test
NEXTAUTH_SECRET=test-secret-at-least-32-chars-long-for-e2e
NEXTAUTH_URL=http://localhost:3001

# Note: AZURE_AD_* vars are NOT needed -- tests bypass OAuth entirely
```

### Test Database Setup (One-Time)

```bash
# Create the test database (run once)
createdb veda_legal_test

# Apply migrations (automated in test setup, but can be done manually)
DATABASE_URL=postgresql://localhost:5432/veda_legal_test npm run db:migrate
```

### CI Configuration (GitHub Actions)

```yaml
# In .github/workflows/ci.yml
services:
  postgres:
    image: postgres:17
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: veda_legal_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

## Sources

- [Playwright Authentication Docs](https://playwright.dev/docs/auth) -- storageState pattern, setup projects
- [Playwright Web Server Docs](https://playwright.dev/docs/test-webserver) -- webServer config, reuseExistingServer
- [Playwright Global Setup and Teardown](https://playwright.dev/docs/test-global-setup-teardown) -- why setup projects are preferred
- [NextAuth Issue #6796](https://github.com/nextauthjs/next-auth/issues/6796) -- community patterns for e2e testing with NextAuth
- [Authenticated tests with Playwright, Prisma, Postgres, and NextAuth](https://dev.to/amandamartindev/authenticated-tests-with-playwright-prisma-postgres-and-nextauth-12pc) -- JWT encode + cookie injection pattern
- [Playwright with Next-Auth and Prisma](https://echobind.com/post/playwright-with-next-auth) -- storageState approach with NextAuth
- [Auth.js Testing Guide](https://authjs.dev/guides/testing) -- official testing recommendations
- [Next.js Experimental Test Mode README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md) -- evaluated and rejected for this use case
- [A better global setup in Playwright](https://dev.to/playwright/a-better-global-setup-in-playwright-reusing-login-with-project-dependencies-14) -- setup project vs globalSetup comparison
- Verified: `next-auth/jwt` exports `encode`, `decode`, `getToken` in installed version 4.24.13
- Verified: Playwright installed version 1.57.0 supports setup projects
- Verified: Next.js 16.0.10 `withAuth` middleware validates JWT from cookie

---
*Architecture research for: Playwright e2e test integration with Next.js 16 + NextAuth + PostgreSQL*
*Researched: 2026-02-25*
