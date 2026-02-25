# Pitfalls Research

**Domain:** Adding Playwright e2e tests to existing Next.js 16 app with Azure AD SSO and PostgreSQL
**Researched:** 2026-02-25
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Auth Bypass Leaking to Production

**What goes wrong:**
The most common approach for e2e testing with NextAuth is adding a `CredentialsProvider` gated by `NODE_ENV !== "production"`. This bypass allows Playwright to authenticate without Azure AD. The danger: `NODE_ENV` checks are fragile. Next.js sets `NODE_ENV=production` during `next build` even in development, meaning a conditional like `process.env.NODE_ENV !== "production"` evaluates differently at build time vs runtime. A misconfigured deployment could ship the CredentialsProvider to production, giving anyone with the test credentials full access to the app.

This project's auth flow is particularly sensitive: `signIn` callback in `lib/auth.ts` checks the user whitelist in the database and updates `lastLogin`. A test bypass that skips this callback means tests never exercise the real auth path, and worse, a leaked bypass skips the whitelist entirely.

**Why it happens:**
NextAuth v4 with JWT strategy requires either (a) a real OAuth flow, (b) a CredentialsProvider, or (c) manual JWT cookie injection. Developers choose (b) because it is simplest, but the environment gating is error-prone. The Auth.js official testing guide explicitly warns: "you must be extremely careful that you do not leave insecure authentication methods available in production."

**How to avoid:**
Use approach (c): manual JWT cookie injection. NextAuth v4 exports an `encode` function from `next-auth/jwt` that can produce a valid `next-auth.session-token` cookie. In a Playwright `globalSetup` file:

1. Ensure a test user exists in the database (seeded during setup).
2. Call `encode({ token: { email: "test@example.com", name: "Test User", sub: "test-user-id" }, secret: process.env.NEXTAUTH_SECRET })` to produce a signed JWT.
3. Inject the cookie into the Playwright browser context via `context.addCookies()`.

This requires zero changes to production auth code. No CredentialsProvider, no `NODE_ENV` checks, no risk of leaking.

**Warning signs:**
- Any `if (process.env.NODE_ENV` check inside `auth.ts` or `authOptions`
- A CredentialsProvider in the providers array
- Test-specific secrets or passwords in environment variables
- Auth bypass code outside the `e2e/` directory

**Phase to address:**
Phase 1: Infrastructure setup. The auth strategy must be decided and implemented before any test can run.

---

### Pitfall 2: Database State Leakage Between Tests

**What goes wrong:**
E2e tests create real data in PostgreSQL (time entries, submissions, users). Without cleanup, Test B sees data created by Test A. This causes intermittent failures: tests pass when run alone but fail in sequence. Worse, with Playwright's parallel workers, two tests writing to the same table produce race conditions -- a test asserting "user has 0 entries" fails because a parallel test just created one.

This project's schema has cascading foreign keys (`ON DELETE CASCADE` on `time_entries.userId`), unique constraints (`timesheet_submissions.userId + date`), and status-dependent logic (`ClientStatus`, `UserStatus`). Leaked state from one test can trigger constraint violations or status-dependent behavior in another.

**Why it happens:**
Unlike unit tests (which mock the database), e2e tests hit the real database through the real app. Transaction rollback -- the standard isolation technique for integration tests -- does not work for e2e tests because the test process and the app process are separate. The test cannot wrap the app's database operations in a transaction.

**How to avoid:**
Use a dedicated test database (`veda_legal_test`) with truncation-based cleanup. In `globalSetup`:

1. Set `DATABASE_URL` to the test database.
2. Run migrations to ensure schema is current.
3. Seed reference data (users, clients, topics, subtopics) that tests need.

Between test files (in `beforeEach` or a Playwright fixture):

4. Truncate only mutable tables (`time_entries`, `timesheet_submissions`, `service_descriptions`, `service_description_topics`, `service_description_line_items`) using `TRUNCATE ... CASCADE`.
5. Re-seed per-test data as needed.

Do NOT truncate reference tables (users, clients, topics) between tests -- seed them once and treat as read-only. This avoids the expensive re-seeding overhead.

For parallel workers: run tests with `fullyParallel: false` initially (serial execution within each spec file). Only enable full parallelism if test suite time justifies the complexity of per-worker database isolation.

**Warning signs:**
- Tests pass individually (`npx playwright test timesheets.spec.ts`) but fail in full suite
- Tests fail differently on repeated runs
- Constraint violation errors (`duplicate key value violates unique constraint`)
- Assertions on "empty state" fail because stale data exists

**Phase to address:**
Phase 1: Infrastructure setup. Database isolation strategy must be in place before writing any tests.

---

### Pitfall 3: Testing Against Dev Server Instead of Production Build

**What goes wrong:**
Playwright's `webServer` config makes it easy to start `next dev` and run tests against it. This is misleading: the dev server includes hot-reload, unoptimized bundles, verbose error overlays, and different caching behavior. Tests pass locally against `next dev` but fail in CI against `next build && next start` because:

- Server Components behave differently (no re-render on every request in production)
- Static pages may be pre-rendered at build time (not fetched live)
- Error boundaries render differently (no error overlay)
- API routes have different response timing (no compilation delay)

This project uses `output: "standalone"` in `next.config.ts`, which means the production server runs from `.next/standalone/`, not the source tree. Testing against dev gives no confidence that the standalone build works.

**Why it happens:**
`next dev` starts in ~2 seconds. `next build` takes 30-60 seconds. Developers optimize for fast feedback loops during development and forget to switch the CI config. Playwright's docs show `next dev` in examples for simplicity, reinforcing the bad habit.

**How to avoid:**
Configure `playwright.config.ts` with:
```typescript
webServer: {
  command: 'npm run build && npm run start',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
  timeout: 120000, // build can take time
}
```

In local development, `reuseExistingServer: true` lets you run `npm run dev` manually and point Playwright at it for fast iteration. In CI, the full build runs every time.

**Warning signs:**
- `webServer.command` contains `next dev` or `npm run dev`
- Tests pass locally but fail in CI with hydration or rendering errors
- No `next build` step in the CI workflow

**Phase to address:**
Phase 1: Infrastructure setup. The Playwright config must be correct from the start.

---

### Pitfall 4: Over-Testing What Unit Tests Already Cover

**What goes wrong:**
The project has 965 unit/integration tests across 46 files. The timesheet components already have unit tests: `EntryForm.test.tsx`, `WeekStrip.test.tsx`, `EntriesList.test.tsx`. A common mistake is writing e2e tests that duplicate this coverage -- testing input validation rules, date formatting, hour parsing, description length checks. These are cheaper and faster to test at the unit level. An e2e test that verifies "description under 10 characters shows error" adds maintenance burden without meaningful confidence gain over the existing `isValidDescription` unit test.

E2e test suites that grow past 50-100 tests typically become the slowest part of CI, and teams start skipping or ignoring them. The project's CI already runs 965 unit tests; adding a bloated e2e suite could double the pipeline time.

**Why it happens:**
E2e tests are satisfying to write -- you see the browser doing things. Developers treat each form field as a test case rather than focusing on the workflow that connects them. The testing pyramid inverts: e2e tests cover what unit tests should, and unit tests cover what the e2e tests already exercise.

**How to avoid:**
E2e tests should cover **workflows that cross boundaries**, not individual component behaviors:

**DO test with e2e:**
- "User creates a time entry, sees it in the list, edits it, deletes it" (full CRUD workflow)
- "User navigates to a different day via WeekStrip, creates an entry, navigates back, entry is gone from view" (navigation + data persistence)
- "User submits a day, sees submission indicator, revokes, can edit again" (multi-step state machine)

**DO NOT test with e2e:**
- Input validation edge cases (unit test on `isValidDescription`, `isValidHours`)
- Date formatting display (unit test on `formatHours`, `parseHoursToComponents`)
- Component rendering variants (unit test with React Testing Library)
- API error responses (unit test on route handlers)

Target 10-20 e2e tests for the timesheets feature, not 50+.

**Warning signs:**
- E2e test file has >15 `test()` blocks for a single page
- Test names reference specific validation rules ("rejects hours > 12")
- Tests assert text formatting or CSS classes rather than user outcomes
- E2e suite takes >5 minutes to run

**Phase to address:**
Phase 2: Test writing. Define a test plan before writing tests. Each e2e test should map to a user workflow, not a component behavior.

---

### Pitfall 5: Fragile Selectors That Break on UI Changes

**What goes wrong:**
Tests use CSS class selectors (`page.locator('.bg-elevated .text-accent-pink')`), DOM structure (`page.locator('div > div > button')`), or auto-generated attributes that change between builds. When the design system evolves (this project uses Tailwind v4 with CSS variables), every class rename breaks e2e tests. The Tailwind v4 migration alone could invalidate dozens of selectors.

This project's components use Tailwind utility classes extensively (e.g., `bg-[var(--bg-elevated)]`, `text-[var(--accent-pink)]`). These are implementation details that should never appear in tests.

**Why it happens:**
Developers inspect the DOM in DevTools, copy a selector that works, and paste it into the test. It works today but is coupled to the current markup. Role-based and text-based selectors require knowing what the component does, not how it looks.

**How to avoid:**
Use Playwright's recommended locator hierarchy:
1. `page.getByRole('button', { name: 'Save Entry' })` -- accessible role + visible text
2. `page.getByLabel('Hours')` -- form field labels
3. `page.getByText('No entries for this day')` -- visible text content
4. `page.getByTestId('entry-card-123')` -- explicit test IDs for dynamic content

Add `data-testid` attributes to components that have no accessible role or unique text:
- `EntryCard` -> `data-testid="entry-card-{id}"`
- `WeekStrip` day buttons -> already have accessible day names
- Submission button -> already has button text

Avoid: `page.locator('.entry-card')`, `page.locator('[class*="elevated"]')`, `page.locator('div:nth-child(3)')`.

**Warning signs:**
- Tests import Tailwind class names or CSS variable names
- Selectors contain `>`, `:nth-child`, or class names
- A design change (color, spacing, layout) breaks e2e tests
- Multiple tests break from a single component refactor

**Phase to address:**
Phase 1-2: Add `data-testid` attributes during infrastructure setup; enforce locator patterns during test writing via code review.

---

### Pitfall 6: Flaky Tests from Timing and Animation Assumptions

**What goes wrong:**
The project uses `animate-fade-up` for modals and dropdowns (per `CLAUDE.md` animation rule). Tests that click a button and immediately assert on the modal content fail intermittently because the animation has not completed. Similarly, API calls for creating/editing time entries have variable latency -- a test that clicks "Save" and immediately checks the entries list may see stale data.

The `TopicCascadeSelect` component involves a multi-step dropdown interaction (select topic, then subtopic). Each step involves a dropdown animation and potentially a network request. Race conditions between clicks and UI updates are the primary source of flaky e2e tests.

**Why it happens:**
Tests work locally (fast machine, instant API) but fail in CI (slower runner, network variability). Developers add `page.waitForTimeout(500)` as a band-aid, which makes tests slow AND still flaky (500ms is not always enough, and it wastes time when the UI is ready in 50ms).

**How to avoid:**
Never use `page.waitForTimeout()` except for debugging. Instead:
- Use auto-waiting assertions: `await expect(page.getByRole('dialog')).toBeVisible()` waits for the modal to appear, regardless of animation duration.
- Wait for network idle after mutations: `await page.waitForResponse(resp => resp.url().includes('/api/timesheets') && resp.status() === 201)` after creating an entry.
- For the cascade select: wait for each dropdown to be visible before clicking the next option.
- For entry list updates after CRUD: wait for the entry card to appear/disappear rather than waiting for a fixed time.

**Warning signs:**
- Any `page.waitForTimeout()` call in test code
- Tests that pass 9/10 times (flaky rate >1%)
- CI logs showing "element not found" or "element not visible" errors
- Tests with `{ timeout: 30000 }` overrides

**Phase to address:**
Phase 2: Test writing. Establish wait patterns in shared test utilities/fixtures.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| CredentialsProvider for auth bypass | Fast to implement, no JWT encoding needed | Security risk if leaked to production; tests skip real middleware path | Never -- JWT cookie injection is equally simple and carries zero production risk |
| `page.waitForTimeout()` instead of proper waits | Fixes flaky test immediately | Slows suite, still flaky under load, masks real timing bugs | Never -- always wait for a specific condition |
| Testing against `next dev` | Fast startup, quick iteration | Misses production-only bugs (hydration, caching, standalone build) | Local development only, with `reuseExistingServer: true`; CI must use production build |
| Sharing database state across tests (no cleanup) | No setup/teardown code to write | Cascading failures, order-dependent tests, impossible to parallelize | Never -- truncation between test files is cheap and essential |
| Duplicating unit test coverage in e2e | "More coverage feels safer" | 3x slower CI, 3x more tests to maintain, no additional confidence | Never -- e2e tests should cover workflows, not individual behaviors |
| Hardcoded test data (dates, IDs) in specs | Quick to write | Breaks when run on different dates; collides with other tests | Only for truly static reference data (e.g., user positions); use factories for mutable data |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| NextAuth JWT + Playwright | Setting cookie on wrong domain (`localhost` vs `127.0.0.1`) or missing `httpOnly`/`secure` flags | Use exact domain from `baseURL`; set `httpOnly: true`, `sameSite: 'Lax'`, `secure: false` for localhost; cookie name is `next-auth.session-token` (no `__Secure-` prefix on HTTP) |
| NextAuth middleware + Playwright | Middleware blocks API requests during test setup (seed endpoints) | Either seed data via direct DB connection (bypassing the app) or add seed endpoints gated by `E2E_TEST=true` env var (never exposed in production) |
| PostgreSQL TRUNCATE + foreign keys | `TRUNCATE time_entries` fails due to FK from `service_description_line_items` | Use `TRUNCATE ... CASCADE` or truncate tables in dependency order (line_items, topics, SDs, submissions, entries) |
| Next.js Server Components + Playwright | `page.goto()` returns before Server Components finish rendering; assertions on server-fetched data fail | Wait for a specific element that only renders after data loads (e.g., `await expect(page.getByText('Client Name')).toBeVisible()`) rather than trusting `page.goto()` completion |
| Drizzle ORM in test setup | Importing `db` from `lib/db.ts` in Playwright setup uses the app's connection pool, which may conflict with the running server | Create a separate Drizzle client in test utilities pointing to the test database, independent of the app's pool |
| Impersonation cookie + e2e tests | Setting both `next-auth.session-token` and `impersonate_user_id` cookies but the test user is not ADMIN, so impersonation is silently ignored | Ensure the JWT token's email matches an ADMIN user in the test database if testing impersonation flows |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Running `next build` on every test run locally | 30-60 second startup before first test runs | Use `reuseExistingServer: true` locally; only build in CI | Always in development; use `npm run dev` locally with reuse |
| Not caching Playwright browser binaries in CI | 2-3 minute download of Chromium on every CI run | Cache `~/.cache/ms-playwright` with `actions/cache@v4` keyed on Playwright version | Every CI run without cache |
| Running all browsers (chromium, firefox, webkit) | 3x test execution time | Run chromium-only in CI; cross-browser testing is unnecessary for an internal app with known user browsers | >20 tests with all 3 browsers |
| Full database re-seed between every test | Each test spends 2-3 seconds on setup | Seed reference data once in `globalSetup`; truncate only mutable tables between specs | >10 tests with per-test full seed |
| Not parallelizing test files | Suite runs serially, wasting CI time | Use `fullyParallel: true` at file level once database isolation is solid | >15 spec files running serially |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| CredentialsProvider gated by `NODE_ENV` | Production build sets `NODE_ENV=production` during build but bypass could leak via misconfigured runtime env | Do not add any auth bypass to production code; use JWT cookie injection in Playwright setup only |
| Test secrets committed to repository | `NEXTAUTH_SECRET` for test environment in source code could be used to forge sessions | Use a separate, disposable `NEXTAUTH_SECRET` for tests (e.g., `"test-secret-do-not-use-in-production"`); set via CI env vars, not committed files |
| Test database accessible from production network | If test DB is on the same server as production, a connection string leak could expose test data or allow test operations on production | Use a completely separate database instance or at minimum a different database name with no cross-access |
| Seed API endpoints without authentication | Adding `/api/test/seed` for e2e setup creates an unauthenticated endpoint that could reset production data | Gate seed endpoints with a specific env var (`E2E_TEST_MODE=true`) that is NEVER set in production; better yet, seed via direct DB connection in Playwright setup |

## "Looks Done But Isn't" Checklist

- [ ] **Auth bypass:** Verify no `CredentialsProvider` or `NODE_ENV` check was added to `lib/auth.ts` -- auth bypass must live entirely in Playwright test setup code
- [ ] **Cookie domain:** Confirm `next-auth.session-token` cookie domain matches the `baseURL` in `playwright.config.ts` -- mismatch causes silent auth failure (no error, just redirected to login)
- [ ] **Test database:** Verify tests run against `veda_legal_test`, not the development database -- check `DATABASE_URL` in the test environment config
- [ ] **CI pipeline:** Confirm CI workflow includes PostgreSQL service container, `next build`, Playwright browser install, and runs e2e tests as a separate job from unit tests
- [ ] **Cleanup between tests:** Verify `TRUNCATE CASCADE` runs on mutable tables between test files -- run the full suite twice in sequence and check for failures on second run
- [ ] **Production build tested:** Verify `playwright.config.ts` `webServer.command` uses `build && start`, not `dev`
- [ ] **Data-testid attributes:** Confirm `EntryCard`, `EntryForm`, and submission button have `data-testid` attributes -- inspect rendered HTML in a test trace
- [ ] **No waitForTimeout:** Search test files for `waitForTimeout` -- should return zero results
- [ ] **Trace on failure:** Verify `playwright.config.ts` has `trace: 'on-first-retry'` so CI failures produce actionable traces
- [ ] **Existing unit tests still pass:** Run `npm run test -- --run` after adding e2e infrastructure to confirm vitest and Playwright configs do not conflict

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| CredentialsProvider shipped to production | HIGH | Immediately remove the provider and redeploy; audit access logs for unauthorized logins; rotate NEXTAUTH_SECRET; rewrite to JWT cookie injection approach |
| Database state leakage causing cascading failures | MEDIUM | Add `TRUNCATE CASCADE` in `beforeEach`; re-run full suite to verify; may need to adjust test data factories to use unique identifiers |
| Tests built against dev server fail on production build | MEDIUM | Switch `webServer.command` to build+start; fix hydration/rendering differences one by one; most fixes are in the app code, not the tests |
| Over-tested suite (50+ e2e tests, 10+ minute CI) | HIGH | Audit each test against unit test coverage; delete tests that duplicate unit coverage; consolidate multi-step tests that test the same workflow separately; may lose weeks of test-writing effort |
| Fragile selectors break on design change | MEDIUM | Add `data-testid` attributes to components; rewrite selectors to use role/label/testid; one-time effort that prevents recurring breakage |
| Flaky tests from timing issues | LOW-MEDIUM | Replace `waitForTimeout` with auto-waiting assertions; add `waitForResponse` after mutations; enable `trace: 'on-first-retry'` to diagnose remaining flakes |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Auth bypass leaking to production | Phase 1: Infrastructure | `git grep CredentialsProvider` returns zero results in `src/`; auth bypass code exists only in `e2e/` directory |
| Database state leakage | Phase 1: Infrastructure | Full suite passes when run twice in sequence (`npx playwright test && npx playwright test`) |
| Testing against dev server | Phase 1: Infrastructure | CI workflow shows `next build && next start` in webServer command; no `next dev` in Playwright config |
| Over-testing unit-covered behavior | Phase 2: Test writing | E2e test count is 10-20; each test maps to a user workflow documented in test plan; no test duplicates an existing unit test assertion |
| Fragile selectors | Phase 1-2: Infrastructure + test writing | Zero CSS class selectors in test files; all interactive elements use role, label, or testid locators |
| Flaky timing issues | Phase 2: Test writing | Zero `waitForTimeout` calls; CI flake rate <2% over 10 consecutive runs |

## Sources

- [Auth.js Testing Guide](https://authjs.dev/guides/testing) -- official recommendation for CredentialsProvider approach with security warnings
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) -- test isolation, locator strategy, anti-patterns
- [Playwright Authentication](https://playwright.dev/docs/auth) -- storageState, global setup, cookie injection
- [Next.js Playwright Testing Guide](https://nextjs.org/docs/pages/guides/testing/playwright) -- webServer config, production build recommendation
- [NextAuth GitHub Issue #6796](https://github.com/nextauthjs/next-auth/issues/6796) -- community discussion on e2e testing approaches
- [NextAuth GitHub Issue #12179](https://github.com/nextauthjs/next-auth/issues/12179) -- Playwright integration patterns
- [Playwright GitHub Issue #33699](https://github.com/microsoft/playwright/issues/33699) -- database isolation strategies for e2e tests
- [Playwright GitHub Issue #21207](https://github.com/microsoft/playwright/issues/21207) -- cookie injection with NextAuth
- [Next.js GitHub Discussion #62254](https://github.com/vercel/next.js/discussions/62254) -- testing user sessions with cookies
- Codebase analysis: `app/src/lib/auth.ts` (JWT strategy, Azure AD provider, signIn callback with whitelist)
- Codebase analysis: `app/src/middleware.ts` (NextAuth middleware with route matching)
- Codebase analysis: `app/src/lib/api-utils.ts` (requireAuth with JWT fallback, impersonation support)
- Codebase analysis: `app/src/lib/schema.ts` (FK constraints, unique indexes, cascade deletes)
- Codebase analysis: `app/src/lib/user.ts` (getCurrentUser with impersonation cookie)
- Codebase analysis: `app/vitest.config.ts` (existing test infrastructure to avoid conflicts)

---
*Pitfalls research for: adding Playwright e2e tests to existing Next.js/NextAuth/PostgreSQL app*
*Researched: 2026-02-25*
