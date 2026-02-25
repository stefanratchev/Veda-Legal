# Project Research Summary

**Project:** v1.1 — E2E Timesheets (Playwright Test Infrastructure)
**Domain:** Browser-level regression testing for a Next.js legal timesheet app with Azure AD SSO
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

This milestone adds Playwright e2e test infrastructure to an existing Next.js 16 app that uses NextAuth v4 with Azure AD SSO. The core challenge is not Playwright itself — the package is already installed — but rather the auth bypass: real Azure AD OAuth cannot run in CI (no credentials, IP blocks, MFA). The recommended approach is JWT cookie injection using `next-auth/jwt`'s `encode()` function. This generates a valid `next-auth.session-token` cookie that passes all of NextAuth's validation checks (middleware, server components, API routes) without any changes to production auth code. This is the critical architectural decision that everything else depends on.

The recommended test architecture follows three principles: a separate test database (`veda_legal_test`) to protect development data, serial execution (`workers: 1`) to avoid race conditions on the shared database, and a Page Object Model for the timesheets page to survive UI changes. These decisions are not about sophistication — they are about reliability for a ~15-test suite that must not become a maintenance burden. The 965 existing Vitest unit tests already cover component logic and API validation; e2e tests should cover only full-stack user workflows (create entry, edit entry, delete entry, date navigation, daily submission).

The main risk is infrastructure drift: tests that pass locally against `next dev` but fail in CI against the production build, or tests that pass on first run but fail on second run due to leaked database state. Both are preventable with correct initial configuration. A small number of `data-testid` attributes must be added to key UI components (ClientSelect, TopicCascadeSelect, DurationPicker, EntryCard, WeekStrip, submit button) — this is the only change required to production code.

## Key Findings

### Recommended Stack

All required packages are already installed. Zero new npm dependencies are needed. Playwright 1.57.0 and `@playwright/test` 1.57.0 are in `node_modules`. The `next-auth/jwt` `encode()` function (verified in `next-auth@4.24.13`) produces JWE tokens identical to real login sessions. Drizzle ORM 0.45.1 handles test database seeding directly. The work is entirely configuration, infrastructure code, and test writing.

**Core technologies:**
- `@playwright/test@1.57.0`: Test runner and browser automation — already installed, needs config and test files
- `next-auth/jwt` (`encode()`): Produces valid JWE session cookies for auth bypass — already installed, zero production changes required
- Drizzle ORM + `veda_legal_test` database: Direct DB seeding/cleanup in test fixtures — same ORM as production, separate database
- `dotenv@17.2.3`: Loads `.env.test` with test database URL — already installed
- `@paralleldrive/cuid2@3.0.4`: Generates IDs for test data matching production format — already installed

**Intentionally excluded:**
- Cypress: Playwright is already installed; two test runners creates duplicate config and maintenance overhead
- `drizzle-seed`, `@faker-js/faker`: e2e tests need deterministic specific data, not random data
- `testcontainers`, `msw`: over-engineered for ~15 tests; mocking the API defeats full-stack test purpose
- `next/experimental/testmode`: experimental, designed for fetch mocking not auth bypass, no stability guarantees

### Expected Features

**Must have (table stakes for this milestone):**
- Auth bypass via JWT cookie injection — blocks everything; zero tests can run without it
- Playwright config with setup project — standard architecture, Chromium-only, serial execution, HTML reporter
- Test database (`veda_legal_test`) with seed data — required for ClientSelect/TopicCascadeSelect dropdowns to work
- `TimesheetsPage` Page Object Model — complex interactions (dropdowns, cascade selects, DurationPicker, WeekStrip) need stable abstraction
- Custom fixtures composing auth + db — ergonomic test signatures, Playwright's idiomatic pattern
- API-level data factory (`page.request.post('/api/timesheets', ...)`) — faster and more reliable than creating entries through UI for edit/delete/submission tests
- Create entry test: REGULAR client with subtopic + INTERNAL client topic-only
- Edit entry test: change field, cancel edit
- Delete entry test: confirm, cancel
- WeekStrip navigation test: select day, prev/next week, Today button
- Submission flow test: log 8+ hours, submit, verify status
- CI integration: GitHub Actions with PostgreSQL service container, separate job from unit tests

**Should have (add once core suite is stable):**
- HTML report + trace on failure artifact uploaded in CI
- Test tagging (`@smoke`, `@crud`) with selective CI execution — fast PR checks
- Submission revocation test (delete entry below 8h threshold)
- Calendar popup date selection test
- `@axe-core/playwright` accessibility checks

**Defer to v2+:**
- Admin/billing e2e tests — separate milestone; dnd-kit drag-and-drop and PDF generation require significant additional infrastructure
- Reports e2e tests — Recharts charts are difficult to assert on; unit tests cover the logic
- Multi-browser testing — internal app, all users on Chrome; Chromium-only has near-zero ROI tradeoff
- Visual regression testing — dynamic data + Tailwind classes produce constant false positives
- Parallel test execution — only warranted if suite exceeds 50 tests with >5 minute runtime

### Architecture Approach

The test infrastructure sits entirely outside `src/` in an `e2e/` directory at the app root. This keeps Playwright completely separate from the existing Vitest infrastructure (no test runner conflicts). Three patterns govern the architecture: (1) JWT cookie injection for auth bypass, written once in the setup project and reused via `storageState`; (2) direct Drizzle ORM access for seeding/cleanup, bypassing the API to avoid authentication chicken-and-egg problems; (3) Page Object Model for the timesheets page, centralizing all locators so UI changes break in one place rather than across all spec files. The dev server runs against the test database via `webServer.env.DATABASE_URL` in the Playwright config — no environment variable contamination between dev and test.

**Major components:**
1. **Auth setup project** (`e2e/setup/auth.setup.ts`) — encodes JWT once, writes `storageState` to `e2e/.auth/user.json`; all test projects depend on this and inherit the auth cookie
2. **DB fixtures** (`e2e/fixtures/db.ts`) — Drizzle client pointing at `veda_legal_test`; seeds reference data before tests, truncates mutable tables after (`TRUNCATE ... CASCADE`)
3. **TimesheetsPage POM** (`e2e/page-objects/timesheets.page.ts`) — wraps all locators and interactions using role/label/testid locators; no CSS class selectors
4. **Composed test export** (`e2e/fixtures/test.ts`) — `test.extend()` combining auth + db fixtures; all spec files import from here
5. **Spec files** (`e2e/specs/`) — three files: `timesheet-entry.spec.ts`, `weekstrip-nav.spec.ts`, `submission.spec.ts`
6. **CI job** (addition to `.github/workflows/ci.yml`) — PostgreSQL service container, Chromium install with caching, production build (`npm run build && npm run start`)

### Critical Pitfalls

1. **Auth bypass leaking to production** — Never add a `CredentialsProvider` or `NODE_ENV` check to `lib/auth.ts`. Auth bypass must live entirely in `e2e/` directory. The `signIn` callback's user whitelist would be bypassed. Prevention: `git grep CredentialsProvider` in `src/` returns zero results.

2. **Database state leakage between tests** — Tests sharing state cause order-dependent failures and constraint violations (unique index on `timesheet_submissions.userId + date`). Prevention: `TRUNCATE ... CASCADE` on mutable tables in the db fixture teardown. Run the full suite twice in sequence to verify.

3. **CI tests against dev server (not production build)** — `next dev` and `next build && next start` behave differently (hydration, caching, standalone build). Tests pass locally but fail in CI. Prevention: CI `webServer.command` must be `npm run build && npm run start`; use `reuseExistingServer: true` locally only.

4. **Fragile CSS class selectors** — Tailwind v4 utility classes are implementation details that break on any design change. Prevention: add `data-testid` to 6 components during infrastructure setup; use `getByRole`, `getByLabel`, `getByTestId` in all tests.

5. **Flaky timing from animation assumptions** — The app uses `animate-fade-up` for modals/dropdowns; `TopicCascadeSelect` involves multi-step interactions with variable latency. Prevention: zero `page.waitForTimeout()` calls; use auto-waiting assertions and `waitForResponse()` after mutations.

6. **Over-testing unit-covered behavior** — 965 Vitest tests already cover input validation, date formatting, hour parsing, component rendering. Duplicating this in e2e doubles CI time with no additional confidence. Prevention: target 10-20 e2e tests; each must map to a cross-boundary user workflow.

## Implications for Roadmap

A three-phase structure is optimal. Dependencies enforce this ordering strictly: auth must work before any test can navigate a page, database seeding must work before any test can interact with a form, and the POM must exist before spec files can be written clearly.

### Phase 1: Infrastructure Foundation

**Rationale:** Nothing runs without auth bypass and a seeded test database. This phase has no user-visible tests but produces the working scaffold all subsequent test writing depends on. Getting this right prevents the three most severe pitfalls (auth leaking to production, database state leakage, CI build mismatch). The smoke test at the end of this phase validates the entire infrastructure chain.

**Delivers:**
- `playwright.config.ts` with setup project, Chromium project, `webServer` (build+start in CI, reuse in dev), serial execution
- `e2e/` directory structure
- `.env.test` with `TEST_DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `e2e/helpers/db-utils.ts` — Drizzle client for test DB, migration runner
- `e2e/helpers/seed-data.ts` — test data factories: 1 test user, 2 clients (REGULAR + INTERNAL), 2 topics, 3 subtopics
- `e2e/fixtures/auth.ts` — `createSessionToken()` using `next-auth/jwt` `encode()`
- `e2e/setup/auth.setup.ts` — generates `storageState` to `e2e/.auth/user.json`
- `e2e/fixtures/db.ts` — seed/cleanup fixture with `TRUNCATE ... CASCADE` teardown
- `e2e/fixtures/test.ts` — composed `test` export combining auth + db fixtures
- `data-testid` attributes added to: ClientSelect, TopicCascadeSelect, DurationPicker, EntryCard, WeekStrip, submit button
- `test:e2e` and `test:e2e:ui` scripts in `package.json`
- Playwright artifacts added to `.gitignore` (`e2e/.auth/`, `e2e/test-results/`, `playwright-report/`)
- Smoke test: `page.goto('/timesheets')` renders the timesheets page without redirect to `/login`

**Avoids:** Pitfall 1 (auth bypass in production code), Pitfall 2 (database state leakage), Pitfall 3 (dev server in CI), Pitfall 4 (fragile selectors — data-testid established here)

**Research flag:** No additional research needed. All patterns verified against installed packages and official documentation.

### Phase 2: Core Timesheet Workflow Tests

**Rationale:** With infrastructure solid, write the tests that constitute the milestone's regression protection. POM comes first because all three spec files depend on it. Entry CRUD before submission because submission tests need entries to reach the 8-hour threshold. API data factory eliminates slow UI-through setup for edit/delete/submission tests.

**Delivers:**
- `e2e/page-objects/timesheets.page.ts` — `TimesheetsPage` class: `createEntry()`, `editEntry()`, `deleteEntry()`, `navigateToDate()`, `submitDay()`, `getEntryRows()`
- `e2e/helpers/api-factory.ts` — `createEntryViaAPI()` using `page.request.post('/api/timesheets')` for fast test setup
- `e2e/specs/timesheet-entry.spec.ts`:
  - Create REGULAR client entry with subtopic (prefix behavior)
  - Create INTERNAL client entry (topic-only, no subtopic)
  - Edit entry: change description, change hours
  - Edit entry: cancel discards changes
  - Delete entry: confirm removes it
  - Delete entry: cancel preserves it
- `e2e/specs/weekstrip-nav.spec.ts`:
  - Select specific day, verify entries reload
  - Prev/next week arrows shift the week
  - Today button returns to current day
  - Entry created on day A persists when navigating away and back
- `e2e/specs/submission.spec.ts`:
  - Log 8+ hours via API factory, submit, verify status indicator
  - Submission auto-prompt modal appears at 8h threshold

**Avoids:** Pitfall 4 (over-testing unit behavior — each test maps to a workflow), Pitfall 5 (flaky timing — auto-waiting assertions and `waitForResponse()` throughout)

**Research flag:** No additional research needed. Page Object Model and Playwright assertion patterns are well-documented standard practice.

### Phase 3: CI Integration

**Rationale:** Tests that do not run in CI rot immediately. This phase is short but critical — it transforms the test suite from a local tool into a regression gate on every PR. Deferred until all tests pass locally to avoid debugging CI configuration and test logic simultaneously.

**Delivers:**
- New `e2e` job in `.github/workflows/ci.yml`:
  - PostgreSQL 17 service container with `veda_legal_test` database and `pg_isready` health check
  - `actions/cache@v4` for `~/.cache/ms-playwright` keyed on Playwright version (saves ~2 minutes per run)
  - `npx playwright install --with-deps chromium` — Chromium only
  - `npm run db:migrate` against test database
  - `npx playwright test` with `CI=true`
  - Upload `playwright-report/` as artifact on failure
- Verified: existing unit test job (`vitest`) and new e2e job run independently; both pass

**Avoids:** Pitfall 3 (production build in CI), CI performance trap (browser binary caching)

**Research flag:** No additional research needed. GitHub Actions PostgreSQL service containers and Playwright CI setup are standard well-documented patterns.

### Phase Ordering Rationale

- Infrastructure before tests: strict dependency. JWT auth bypass, test database, and seed fixtures are hard prerequisites for every test file. Cannot write tests without them.
- POM before spec files: all three spec files import `TimesheetsPage`. Writing the POM last means rewriting three files to use it.
- API data factory in Phase 2 (not Phase 1): it enhances edit/delete/submission tests but is not needed for the smoke test or create-entry tests. Avoids scope creep in the foundation phase.
- CI last: tests must pass locally before adding CI complexity. Debugging CI failures while also debugging test logic is significantly slower.
- `TRUNCATE CASCADE` (not full re-seed) between tests: reference data (users, clients, topics) is seeded once in global setup and treated as read-only. Only `time_entries` and `timesheet_submissions` are truncated. Full re-seed per test would add 2-3 seconds per test with no additional isolation benefit.
- Cleanup must run in `beforeEach` (not just `afterEach`): handles the case where a test fails mid-way and leaves stale records, which would cause the next test to see unexpected state or hit the unique constraint on `timesheetSubmissions.userId + date`.

### Research Flags

**Phases with standard patterns (no additional research needed):**
- Phase 1: JWT encode + Playwright setup project + Drizzle seeding are all thoroughly documented with API signatures verified in `node_modules`
- Phase 2: Page Object Model pattern is standard; timesheet CRUD workflows are fully understood from direct codebase analysis
- Phase 3: GitHub Actions PostgreSQL service containers and Playwright CI integration are standard patterns

**Validate during Phase 1 implementation (not blockers, but check early):**
- `encode()` salt parameter: defaults to `"next-auth.session-token"` when omitted — verify the injected cookie name matches what NextAuth expects in the installed version. If the smoke test redirects to `/login`, check this first.
- `webServer.env` propagation: verify the Next.js dev server picks up `DATABASE_URL` from Playwright's `webServer.env` config (not the shell environment). If the server connects to the dev database instead of `veda_legal_test`, entries created in tests will appear in the dev database.
- `getCurrentUser()` lookup field: `lib/user.ts` calls `getServerSession()` and looks up the user by email — confirm the injected JWT's `email` field (not `sub`) is what gets passed to the DB query. The test user must exist in `veda_legal_test` with a matching email.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified in `node_modules`; `next-auth/jwt` export signatures verified in `node_modules/next-auth/jwt/index.d.ts`; zero new packages needed |
| Features | HIGH | Scope is well-defined; existing codebase fully analyzed (965 tests, middleware, auth.ts, schema, CI workflow); feature dependencies are explicit |
| Architecture | HIGH | JWT cookie injection pattern verified against NextAuth v4 source; Playwright setup project is official best practice since v1.31; all auth validation paths traced through the codebase |
| Pitfalls | HIGH | Based on direct codebase analysis (FK constraints, unique indexes, Tailwind v4, animate-fade-up animations) plus official documentation; not speculative |

**Overall confidence:** HIGH

### Gaps to Address

- **`encode()` salt behavior:** Research confirms the default salt is `"next-auth.session-token"` when omitted, but the exact behavior should be validated with the Phase 1 smoke test. This is the most likely failure point if auth does not work on first attempt.
- **Port 3000 vs 3001 for test server:** ARCHITECTURE.md recommends port 3001 to avoid conflict with a running dev server. STACK.md uses port 3000. Decide at the start of Phase 1: if developers typically run the dev server while also running e2e tests, use 3001. If not, 3000 is simpler.
- **`beforeEach` vs `afterEach` for TRUNCATE:** Research recommends running cleanup in `beforeEach` (not just `afterEach`) to handle mid-test failures leaving stale data. Implement this in Phase 1 db fixture — it matters for the `timesheetSubmissions` unique constraint.

## Sources

### Primary (HIGH confidence)
- [Playwright Authentication Docs](https://playwright.dev/docs/auth) — storageState pattern, setup projects, cookie injection
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) — locator hierarchy, test isolation, anti-patterns
- [Playwright Release Notes 1.57.0](https://playwright.dev/docs/release-notes) — verified features and Chrome for Testing builds
- [Next.js Playwright Guide](https://nextjs.org/docs/app/guides/testing/playwright) — webServer configuration, CI recommendations
- [Auth.js Testing Guide](https://authjs.dev/guides/testing) — official recommendations, CredentialsProvider security warnings
- [NextAuth.js JWT Options](https://next-auth.js.org/configuration/options) — `encode()`/`decode()` signatures, cookie naming, `__Secure-` prefix behavior
- `next-auth/jwt/types.d.ts` in `node_modules` — verified `JWTEncodeParams` interface: `token`, `secret`, `salt`, `maxAge`
- `next-auth/jwt/index.d.ts` in `node_modules` — verified exports: `encode`, `decode`, `getToken`
- Direct codebase analysis: `lib/auth.ts`, `middleware.ts`, `lib/api-utils.ts`, `lib/user.ts`, `lib/schema.ts`, `vitest.config.ts`, `.github/workflows/ci.yml`, `lib/submission-utils.ts`

### Secondary (MEDIUM confidence)
- [NextAuth Issue #6796](https://github.com/nextauthjs/next-auth/issues/6796) — community patterns for e2e testing with NextAuth, maintainer input
- [Authenticated tests with Playwright, Prisma, Postgres, and NextAuth](https://dev.to/amandamartindev/authenticated-tests-with-playwright-prisma-postgres-and-nextauth-12pc) — JWT encode + cookie injection pattern in practice
- [A better global setup in Playwright](https://dev.to/playwright/a-better-global-setup-in-playwright-reusing-login-with-project-dependencies-14) — setup project vs globalSetup comparison
- [Database Rollback Strategies in Playwright](https://www.thegreenreport.blog/articles/database-rollback-strategies-in-playwright/) — cleanup patterns, beforeEach/afterEach hooks
- [Playwright with Next-Auth and Prisma](https://echobind.com/post/playwright-with-next-auth) — storageState approach with NextAuth

### Tertiary (LOW confidence)
- [Next.js Experimental Test Mode README](https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md) — evaluated and rejected; explicit experimental warning noted

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
