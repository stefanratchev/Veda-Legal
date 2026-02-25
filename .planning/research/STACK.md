# Stack Research

**Domain:** E2E testing infrastructure for Next.js legal timesheet app with Azure AD SSO
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

Playwright 1.57.0 and `@playwright/test` 1.57.0 are already installed as dependencies. The primary work is configuration and auth bypass infrastructure, not new package installation. The auth bypass strategy uses NextAuth's built-in `encode()` from `next-auth/jwt` to programmatically create valid JWE session tokens and inject them as cookies via Playwright's `storageState` -- no third-party auth testing libraries needed. Database seeding uses the existing Drizzle ORM connection directly (no `drizzle-seed` package needed -- test data is hand-crafted, not random). The Next.js experimental test mode (`testProxy`) is intentionally skipped: it is designed for mocking fetch requests, not for auth bypass, and remains experimental with no stability guarantees.

## Recommended Stack

### Core Technologies (Already Installed -- No New Packages)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| `@playwright/test` | 1.57.0 | Test runner, assertions, browser automation | Already installed. No changes. |
| `playwright` | 1.57.0 | Browser engine binaries (Chromium, Firefox, WebKit) | Already installed. Browsers downloaded. |
| `next-auth` | 4.24.13 | `encode()` from `next-auth/jwt` creates valid JWE tokens for auth bypass | Already installed. Use existing export. |
| Drizzle ORM | 0.45.1 | Direct DB seeding/cleanup in test fixtures via existing `db` instance | Already installed. No changes. |
| `@paralleldrive/cuid2` | 3.0.4 | Generate IDs for test data (matches production ID format) | Already installed. |
| `dotenv` | 17.2.3 | Load `.env.test` for test database URL | Already installed. |

**Confidence: HIGH** -- All versions verified from `package.json` and `node_modules`.

### Supporting Libraries (None Needed)

No new npm packages are required. Here is why each potential addition was rejected:

| Considered | Version | Purpose | Why NOT Needed |
|------------|---------|---------|----------------|
| `drizzle-seed` | 0.3.x | Automated schema-aware random seeding | Overkill. E2e tests need 1 user, 1 client, 1 topic, 1 subtopic -- hand-crafted Drizzle inserts are simpler, more readable, and deterministic. `drizzle-seed` generates random data; we need specific, predictable test data. |
| `playwright-test-coverage` | any | Code coverage for e2e tests | E2e tests measure user workflow correctness, not code coverage. Coverage is already handled by Vitest (965 unit tests). |
| `@faker-js/faker` | any | Generate realistic test data | Same reasoning as `drizzle-seed`. We need 5-10 specific records, not 1000 random ones. |
| `testcontainers` | any | Spin up PostgreSQL in Docker per test | Over-engineered for a 10-user app. Use the local PostgreSQL instance with a dedicated `veda_test` database and transaction rollback cleanup. CI can add a PostgreSQL service container. |
| `msw` (Mock Service Worker) | any | Mock external API calls | E2e tests should hit the real Next.js server and real database. Mocking defeats the purpose. The only "external" dependency is Azure AD, which is bypassed via JWT injection, not mocking. |
| `next/experimental/testmode/playwright` | N/A | Next.js test proxy for fetch mocking | Experimental, no stability guarantees. Designed for mocking server-side fetch, which we do not need. Auth bypass is handled at the cookie layer, not the fetch layer. |

**Confidence: HIGH** -- Each rejection based on specific project requirements and existing infrastructure.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npx playwright test` | Run e2e tests | Add `test:e2e` script to package.json |
| `npx playwright test --ui` | Interactive test runner with time-travel debugging | Best for local development. Shows browser, DOM, network. |
| `npx playwright codegen` | Record browser interactions to generate test code | Useful for initial test scaffolding, then refine manually. |
| `npx playwright show-report` | View HTML report after test run | Auto-opens on failure. Includes screenshots, traces, logs. |
| `npx playwright install --with-deps` | Install browser binaries + OS deps (for CI) | Required in CI. Locally, browsers are already downloaded. |

## Auth Bypass Strategy

### Why JWT Cookie Injection (Not CredentialsProvider)

Two approaches exist for bypassing Azure AD SSO in e2e tests:

**Option A: Add a test-only CredentialsProvider** -- Conditionally add `Credentials({...})` to the NextAuth providers array when `NODE_ENV !== "production"`. Tests log in via the `/login` page with a test password.

**Option B: Programmatic JWT cookie injection** -- Use `next-auth/jwt`'s `encode()` to create a valid JWE token containing the test user's email/name, then inject it as a `next-auth.session-token` cookie into the Playwright browser context before tests run.

**Recommendation: Option B (JWT cookie injection)** because:

1. **No production code changes.** Option A modifies `auth.ts`, adding a code path that must never reach production. Option B is entirely test-side code.
2. **Faster.** Option A still requires a page load + form submission + redirect per auth setup. Option B sets a cookie in < 1ms.
3. **Simpler.** No need to guard against the CredentialsProvider leaking to production. No extra UI on the login page.
4. **Already proven.** The `encode()` function is a public API of `next-auth/jwt` (verified: exports `encode`, `decode`, `getToken`). The resulting JWE is identical to what NextAuth produces during real login.

### JWT Encode Implementation

```typescript
// e2e/helpers/auth.ts
import { encode } from "next-auth/jwt";

const TEST_SECRET = process.env.NEXTAUTH_SECRET!;

export async function createAuthCookie(user: { name: string; email: string }) {
  const token = await encode({
    token: {
      name: user.name,
      email: user.email,
      sub: user.email, // NextAuth uses email as sub for JWT strategy
    },
    secret: TEST_SECRET,
    // salt defaults to "next-auth.session-token" when not provided
    maxAge: 8 * 60 * 60, // Match authOptions session maxAge (8 hours)
  });

  return {
    name: "next-auth.session-token",
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    expires: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
  };
}
```

**Cookie name:** `next-auth.session-token` (not `__Secure-next-auth.session-token` because `NEXTAUTH_URL` is `http://localhost:3000` in test, triggering the non-secure prefix).

**Confidence: HIGH** -- `encode()` signature verified from `next-auth/jwt/types.d.ts` in node_modules. Cookie name behavior verified from NextAuth docs (secure prefix only for HTTPS URLs).

### Auth Setup in Playwright

```typescript
// e2e/auth.setup.ts
import { test as setup } from "@playwright/test";
import { createAuthCookie } from "./helpers/auth";

const STORAGE_STATE_PATH = "e2e/.auth/user.json";

setup("authenticate as test user", async ({ context }) => {
  const cookie = await createAuthCookie({
    name: "E2E Test User",
    email: "e2e-test@vedalegal.bg",
  });
  await context.addCookies([cookie]);
  await context.storageState({ path: STORAGE_STATE_PATH });
});
```

## Database Seeding Strategy

### Approach: Direct Drizzle Inserts with Transaction Cleanup

E2e tests hit the real database. The seeding strategy:

1. **Dedicated test database:** `veda_test` PostgreSQL database (separate from `veda_dev`).
2. **Global setup:** Insert a fixed set of test data (1 user, 2 clients, 2 topics, 3 subtopics) before all tests.
3. **Per-test cleanup:** Delete time entries and submissions created during each test. Keep reference data (users, clients, topics) stable across tests.
4. **Global teardown:** Truncate all tables after the full test suite completes.

### Why Not Per-Test Database Reset

Full database reset between tests is unnecessary because:
- Time entry CRUD tests create entries, then clean them up individually.
- Reference data (users, clients, topics) is read-only during tests.
- Worker count set to 1 (serial execution) avoids race conditions.

### Seeding Code Pattern

```typescript
// e2e/helpers/seed.ts
import { db } from "@/lib/db";
import { users, clients, topics, subtopics } from "@/lib/schema";
import { createId } from "@paralleldrive/cuid2";

export const TEST_USER = {
  id: createId(),
  email: "e2e-test@vedalegal.bg",
  name: "E2E Test User",
  position: "ASSOCIATE" as const,
  status: "ACTIVE" as const,
  updatedAt: new Date().toISOString(),
};

export const TEST_CLIENT = {
  id: createId(),
  name: "E2E Test Client Ltd",
  clientType: "REGULAR" as const,
  status: "ACTIVE" as const,
  hourlyRate: "150.00",
  updatedAt: new Date().toISOString(),
};

// ... topics, subtopics similarly

export async function seedTestData() {
  await db.insert(users).values(TEST_USER).onConflictDoNothing();
  await db.insert(clients).values(TEST_CLIENT).onConflictDoNothing();
  // ... topics, subtopics
}

export async function cleanupTestData() {
  // Delete in reverse FK order
  await db.delete(timeEntries).where(eq(timeEntries.userId, TEST_USER.id));
  await db.delete(timesheetSubmissions).where(eq(timesheetSubmissions.userId, TEST_USER.id));
  // Keep reference data for subsequent test runs
}
```

**Why direct Drizzle, not API calls for seeding:**
- API routes require authentication, creating a chicken-and-egg problem.
- Direct DB access is faster and more reliable than HTTP round-trips.
- Uses the same ORM and schema types as production code -- type-safe.

**Confidence: HIGH** -- Drizzle insert/delete API is well-documented and already used throughout the codebase.

## Playwright Configuration

### Key Configuration Decisions

| Setting | Value | Rationale |
|---------|-------|-----------|
| `workers` | 1 | Serial execution. Single test database, no parallel isolation needed for ~10 tests. Avoids race conditions. |
| `retries` | 0 (local), 1 (CI) | No retries locally for fast feedback. One retry in CI to handle rare flakiness. |
| `timeout` | 30000 (30s) | Generous for dev server cold starts. Individual actions have shorter timeouts. |
| `webServer.command` | `npm run dev` | Use dev server, not production build. Faster iteration. CI can override to `npm run build && npm run start`. |
| `webServer.reuseExistingServer` | `!process.env.CI` | Reuse running dev server locally (faster). Always start fresh in CI. |
| `projects` | Setup + Chromium only | Single browser sufficient for internal tool with ~10 users all on modern browsers. Add Firefox/WebKit later if needed. |
| `testDir` | `./e2e` | Separate from `src/` where Vitest unit tests live. Clear boundary. |
| `outputDir` | `./e2e/test-results` | Keep artifacts near test files. |
| `use.baseURL` | `http://localhost:3000` | Matches `NEXTAUTH_URL` and dev server. |
| `use.trace` | `on-first-retry` | Capture traces only when tests fail and retry. Saves disk space. |
| `use.screenshot` | `only-on-failure` | Automatic screenshots on failure for debugging. |

### Configuration File

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.test") });

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/test-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

**Why not use Next.js experimental test mode (`testProxy`):**
The `next/experimental/testmode/playwright` config wrapper adds fetch-level request interception for mocking server-side fetches. This project does not need fetch mocking -- the test server hits the real database. Using the standard `@playwright/test` config keeps things simple, stable, and documented.

**Confidence: HIGH** -- Configuration pattern follows Playwright official docs and Next.js Playwright guide.

## File Structure

```
app/
  playwright.config.ts          # Playwright configuration
  .env.test                     # Test environment variables (DATABASE_URL for veda_test)
  e2e/
    .auth/
      user.json                 # Persisted auth state (gitignored)
    helpers/
      auth.ts                   # createAuthCookie() using next-auth/jwt encode
      seed.ts                   # Database seeding and cleanup utilities
    auth.setup.ts               # Global auth setup (runs before all tests)
    global.setup.ts             # Database seeding (runs before all tests)
    global.teardown.ts          # Database cleanup (runs after all tests)
    timesheets/
      create-entry.spec.ts      # Create time entry tests
      edit-entry.spec.ts        # Edit time entry tests
      delete-entry.spec.ts      # Delete time entry tests
      week-strip.spec.ts        # Date navigation tests
      submission.spec.ts        # Submit/revoke daily timesheet tests
```

## Environment Configuration

### .env.test

```bash
# Separate test database (not dev, not prod)
DATABASE_URL=postgresql://stefan@localhost:5432/veda_test

# Same NextAuth config as dev (needed for JWT encode/decode)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<same-as-dev-or-separate-test-secret>

# Azure AD credentials not needed -- auth is bypassed via JWT injection
# AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID are NOT required
```

### package.json Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report",
    "test:e2e:codegen": "playwright codegen http://localhost:3000",
    "db:create-test": "createdb veda_test 2>/dev/null; DATABASE_URL=postgresql://stefan@localhost:5432/veda_test npx drizzle-kit migrate"
  }
}
```

## CI Integration

### GitHub Actions Addition

```yaml
# Add to .github/workflows/ci.yml
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: veda_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: app/package-lock.json
      - run: npm ci
        working-directory: ./app
      - run: npx playwright install --with-deps chromium
        working-directory: ./app
      - run: npx drizzle-kit migrate
        working-directory: ./app
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/veda_test
      - run: npx playwright test
        working-directory: ./app
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/veda_test
          NEXTAUTH_URL: http://localhost:3000
          NEXTAUTH_SECRET: e2e-test-secret-not-real
          CI: true
```

**Key CI detail:** Only install Chromium (`--with-deps chromium`), not all three browsers. Saves ~2 minutes of download time. Internal tool does not need cross-browser e2e coverage.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| JWT cookie injection | CredentialsProvider for test env | Modifies production auth code. Risk of test-only provider leaking to prod. Cookie injection is test-side only. |
| JWT cookie injection | Full OAuth login flow in tests | Requires Azure AD test tenant, MFA handling, token refresh. Fragile, slow, and unnecessary for an internal tool. |
| Standard Playwright config | `next/experimental/testmode/playwright` | Experimental, no stability guarantees, designed for fetch mocking (not auth). Adds complexity with no benefit. |
| Single `veda_test` database | Per-test Docker containers | Over-engineered. 10-user app with serial test execution. PostgreSQL service in CI is sufficient. |
| Serial execution (workers: 1) | Parallel with database isolation | Not enough tests to justify parallelization. Serial is simpler, avoids race conditions. |
| Chromium only | Multi-browser (Chromium + Firefox + WebKit) | Internal tool used by ~10 people on managed devices. Cross-browser testing adds CI time with near-zero ROI. |
| Dev server for tests | Production build + start | Dev server is faster to start and supports HMR for test development. CI can override. |
| `storageState` file persistence | `context.addCookies()` per test | `storageState` is Playwright's recommended pattern. Shared across all tests in a project. More efficient. |
| Hand-crafted Drizzle inserts | `drizzle-seed` package | Need deterministic, specific test data (known IDs, names, positions). Random data makes assertions fragile. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Cypress | Playwright is already installed and configured. Adding Cypress creates tooling confusion, duplicate config, and two test runners to maintain. | Playwright 1.57.0 (already installed) |
| `next/experimental/testmode` | Still experimental. Designed for server-side fetch mocking, not auth bypass. Could break on any Next.js update. | Standard `@playwright/test` config with `webServer` |
| `msw` for e2e tests | E2e tests should exercise the full stack (browser -> API -> database). Mocking API responses in e2e tests defeats the purpose. | Real Next.js server hitting real test database |
| `testcontainers` | Docker-per-test overhead is not justified for ~10 tests on a small dataset. PostgreSQL service in CI covers isolation. | Local `veda_test` database + CI PostgreSQL service |
| `playwright-test-coverage` | E2e tests validate user workflows, not code coverage. Coverage is Vitest's job (965 existing tests). | Vitest `--coverage` for code coverage metrics |
| Multi-role auth storage states | Only one role (ASSOCIATE) needed for timesheet e2e tests. Admin tests can be added later with a second storage state. | Single `user.json` storage state |

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `@playwright/test@1.57.0` | 1.57.0 | Node.js 22, Next.js 16.0.10 | Latest stable. Chrome for Testing builds (not Chromium). |
| `playwright@1.57.0` | 1.57.0 | `@playwright/test@1.57.0` | Must match exactly. Already in sync. |
| `next-auth@4.24.13` | 4.24.13 | `next-auth/jwt` `encode()` function | Verified export: `{ decode, encode, getToken }`. JWE uses A256GCM encryption. |
| `drizzle-orm@0.45.1` | 0.45.1 | `pg@8.16.3` | Seeding uses existing `db` instance and schema. No version concerns. |
| `dotenv@17.2.3` | 17.2.3 | `.env.test` loading | Already installed. Used in playwright.config.ts. |

## Installation

```bash
# No new packages needed. Zero npm installs.

# One-time setup: create test database
createdb veda_test
DATABASE_URL=postgresql://stefan@localhost:5432/veda_test npx drizzle-kit migrate

# One-time setup: install Playwright browsers (already done, but for reference)
npx playwright install

# Verify everything works
npx playwright test --ui
```

## .gitignore Additions

```
# Playwright
e2e/.auth/
e2e/test-results/
playwright-report/
.env.test
```

## Sources

- [Playwright Authentication Docs](https://playwright.dev/docs/auth) -- storageState pattern, setup projects, cookie injection (HIGH confidence)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) -- test isolation, webServer config, web-first assertions (HIGH confidence)
- [Playwright Release Notes](https://playwright.dev/docs/release-notes) -- v1.57.0 features: Chrome for Testing, `--fail-on-flaky-tests`, webServer `wait` field (HIGH confidence)
- [Next.js Playwright Guide](https://nextjs.org/docs/app/guides/testing/playwright) -- webServer configuration, CI recommendations (HIGH confidence)
- [Auth.js Testing Guide](https://authjs.dev/guides/testing) -- CredentialsProvider approach for development, session validation patterns (HIGH confidence)
- [NextAuth.js JWT Options](https://next-auth.js.org/configuration/options) -- `encode()`/`decode()` function signatures, cookie naming conventions, `__Secure-` prefix behavior (HIGH confidence)
- [Auth.js JWT Reference](https://authjs.dev/reference/core/jwt) -- `encode()` params: `token`, `secret`, `salt`, `maxAge`. A256CBC-HS512 encryption (HIGH confidence)
- `next-auth/jwt/types.d.ts` in node_modules -- verified `JWTEncodeParams` interface: `token?: JWT`, `salt?: string`, `secret: string | Buffer`, `maxAge?: number` (HIGH confidence)
- `next-auth/jwt/index.d.ts` in node_modules -- verified exports: `encode`, `decode`, `getToken` (HIGH confidence)
- [Next.js Experimental Test Mode README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md) -- `testProxy: true` config, fetch interception API, explicitly experimental (MEDIUM confidence)
- [Database Rollback Strategies in Playwright](https://www.thegreenreport.blog/articles/database-rollback-strategies-in-playwright/database-rollback-strategies-in-playwright.html) -- cleanup patterns, beforeEach/afterEach hooks (MEDIUM confidence)

---
*Stack research for: E2E testing infrastructure (Playwright + auth bypass + database seeding)*
*Researched: 2026-02-25*
