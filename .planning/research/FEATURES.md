# Feature Research

**Domain:** Playwright e2e test suite for CRUD-heavy timesheet workflows
**Researched:** 2026-02-25
**Confidence:** HIGH -- based on Playwright official documentation, Auth.js testing guide, community patterns for NextAuth+Playwright, and analysis of the existing codebase (965 unit/integration tests, NextAuth JWT strategy, CRUD timesheet workflows).

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any serious e2e test suite for a CRUD-heavy Next.js app must include. Missing these means the suite provides false confidence or is too painful to maintain.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Auth bypass via JWT cookie injection** | The app uses NextAuth v4 with JWT strategy and Azure AD SSO. Real OAuth flows are impossible to test in CI (no Azure AD credentials, IP blocks, MFA). Every e2e test needs authentication. Without a bypass, zero tests can run. | MEDIUM | Encode a valid JWT using `next-auth/jwt`'s `encode()` function with `NEXTAUTH_SECRET`, set as `next-auth.session-token` cookie. Must match the email of a user seeded in the test database. Alternative: Credentials provider enabled only in test env. JWT encoding is cleaner because it does not require changing auth config for tests. |
| **Playwright config with setup project** | Playwright's recommended architecture: a `setup` project that runs first (auth, seeding) and browser projects that depend on it. Without this, every test file repeats setup boilerplate. | LOW | Standard `playwright.config.ts` with `projects: [{ name: 'setup' }, { name: 'chromium', dependencies: ['setup'] }]`. Use `storageState` to persist auth across all tests. Single browser (Chromium) is sufficient for an internal app with 10 users. |
| **Test database with seed data** | E2e tests need real clients, topics, subtopics, and a user in the database to create time entries. Without seeded reference data, the entry form's ClientSelect and TopicCascadeSelect dropdowns are empty and no CRUD operations work. | MEDIUM | Seed script that inserts a test user (matching JWT email), 2-3 clients (REGULAR + INTERNAL types), topics with subtopics, and optionally existing time entries. Run in `globalSetup` or setup project. Reuse existing `seed-topics.ts` pattern. Must use real PostgreSQL (not mocked) since the dev server queries the actual DB. |
| **Page Object Model for timesheets page** | The timesheets page has complex interactive elements: ClientSelect dropdown, TopicCascadeSelect cascade, DurationPicker, description input, WeekStrip date navigation, entry table with inline edit/delete, submission button. Raw locator strings scattered across tests become unmaintainable when UI changes. | MEDIUM | One `TimesheetsPage` class encapsulating: `selectClient()`, `selectTopic()`, `setDuration()`, `setDescription()`, `submitEntry()`, `getEntryRows()`, `editEntry()`, `deleteEntry()`, `navigateToDate()`, `submitTimesheet()`. Locators centralized. The form reuses EntryForm for both create and inline edit, so the POM should reflect that. |
| **CRUD test coverage: Create entry** | Creating a time entry is the core user workflow. It exercises ClientSelect, TopicCascadeSelect (with subtopic prefix behavior), DurationPicker, description input, and the Log button. The entry must appear in the entries list after creation. | LOW | Select client -> select topic/subtopic -> set hours/minutes -> type description -> click Log -> verify entry appears in table with correct values. Test both REGULAR client (with subtopic) and INTERNAL client (topic-only). |
| **CRUD test coverage: Edit entry** | Inline editing exercises the same EntryForm in edit mode, which has different behavior (preserves description when changing topic, shows Save/Cancel buttons). Tests must verify the edit actually persists. | MEDIUM | Click edit icon on entry row -> verify form appears with pre-filled values -> change one field -> click Save -> verify entry row updates. Also test Cancel discards changes. Must handle the fact that locked entries (billed) disable the edit button. |
| **CRUD test coverage: Delete entry** | Deletion has a ConfirmModal confirmation step. Tests must verify the modal appears, confirm deletes, and cancel preserves the entry. | LOW | Click delete icon -> verify ConfirmModal appears with entry details -> click Delete -> verify entry disappears from list. Also test Cancel preserves entry. |
| **WeekStrip date navigation tests** | Date navigation is how users access entries for different days. The WeekStrip shows 7 days, has prev/next week arrows, a Today button, and a calendar popup. Changing dates triggers a fetch for new entries. | LOW | Click day in week strip -> verify entries reload. Click prev/next week arrows -> verify week shifts. Click Today -> verify today is selected. Test that creating an entry on one day, navigating away, and coming back shows the entry. |
| **Submission flow tests** | Daily submission (requiring minimum 8 hours) is a business-critical workflow. Tests must verify the Submit Timesheet button appears after 8 hours logged, confirm submission changes status, and that the submission indicator appears in the WeekStrip. | MEDIUM | Log entries totaling 8+ hours -> verify "Submit Timesheet" button appears -> click -> verify "Timesheet Submitted" status shows. Also test submission prompt modal that appears automatically after reaching 8h. Test that deleting entries below 8h revokes submission. |
| **Custom Playwright fixtures** | Fixtures wrap page objects and test data for injection into tests. Playwright's recommended approach for composable, maintainable test infrastructure. Without fixtures, each test file needs manual page object instantiation and data setup. | LOW | `test.extend()` with `timesheetsPage` fixture that creates a `TimesheetsPage` POM, and optionally an `authenticatedPage` fixture that navigates to `/timesheets` with auth. Combine with POM for clean test signatures: `test('can create entry', async ({ timesheetsPage }) => { ... })`. |
| **Test isolation and cleanup** | Tests that share state break in parallel or when one test fails mid-flow. Each test must start from a known state and not pollute the database for other tests. | MEDIUM | Options: (1) Reset DB between tests -- clean but slow. (2) Use unique data per test (unique descriptions, timestamps) -- faster but DB grows. (3) Delete only what you created -- per-test cleanup via API. Recommend option 2 (unique test data) for speed, with periodic DB reset via `globalSetup`. The app has only 10 real users so test isolation is straightforward. |
| **CI integration (GitHub Actions)** | The existing CI workflow runs unit tests on PR. E2e tests must also run in CI or they rot immediately. Requires PostgreSQL service container, Playwright browser install, and dev server startup. | MEDIUM | Add PostgreSQL service container to CI workflow. Run `npm run db:migrate` + seed script. Start dev server with `npx playwright test` using `webServer` config. Install browsers with `npx playwright install --with-deps chromium`. Store Playwright report as artifact on failure. |

### Differentiators (Competitive Advantage)

Features that elevate the test suite beyond basic coverage. Not required for the milestone, but provide significant value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Playwright HTML report with trace on failure** | When tests fail in CI, the HTML report with screenshot and trace file lets you debug without reproducing locally. Playwright captures DOM snapshots, network requests, and console logs. A 30-second config change that saves hours of debugging. | LOW | Set `reporter: 'html'` and `trace: 'on-first-retry'` in `playwright.config.ts`. Upload `playwright-report/` as a GitHub Actions artifact on failure. Already built into Playwright, zero custom code. |
| **API-level test data factory** | Instead of creating entries through the UI (slow, flaky), seed test data via direct API calls (`POST /api/timesheets`) in fixtures. Tests that need pre-existing entries (for edit, delete, submission) start faster and are more reliable. | LOW | Add helper functions like `createEntryViaAPI(page, data)` that call `fetch('/api/timesheets', ...)` using `page.request`. The API already exists and handles auth via session cookie, which Playwright carries from storageState. This is much faster than clicking through the form for each entry. |
| **Accessibility assertions** | Running `axe-core` checks during e2e tests catches WCAG violations in the actual rendered UI. For a legal app used daily by attorneys, accessibility is both ethical and practical (keyboard-heavy users). | LOW | Install `@axe-core/playwright`. Add a single check per page: `await checkA11y(page)` in the page load fixture. Catches contrast issues, missing labels, role problems in the dark theme. Low effort, high value. |
| **Resilient locator strategy** | Use Playwright's recommended locator priority: `getByRole` > `getByLabel` > `getByText` > `getByTestId` > CSS selectors. Role-based locators survive UI refactors and enforce accessible markup. | LOW | No extra tooling needed. Discipline in POM implementation. The existing components use button text ("Log", "Save", "Cancel"), input placeholders ("Select client...", "What did you work on?"), and table column headers -- all suitable for accessible locators. Add `data-testid` only when semantic locators are ambiguous (e.g., multiple delete buttons). |
| **Test tagging and selective execution** | Tag tests as `@smoke`, `@crud`, `@navigation`, `@submission` so CI can run a fast smoke suite on every PR and the full suite nightly. Playwright supports `--grep @smoke` filtering natively. | LOW | Add tags to test titles: `test('can create entry @smoke @crud', ...)`. Configure CI with two modes: PR runs `--grep @smoke`, scheduled runs the full suite. Keeps PR feedback fast (<3 minutes) while maintaining full coverage. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like good testing practices but create more problems than they solve for this specific project.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Visual regression testing (screenshot comparison)** | "Catch UI regressions automatically." Sounds comprehensive. | For a dark-themed app with dynamic data (timestamps, hours totals, user names), screenshot comparison generates constant false positives. Font rendering differs between macOS and Linux CI. Anti-aliasing differences trigger failures. The maintenance cost of updating baselines after every intentional UI change exceeds the value of catching unintentional ones. The 965 existing unit tests already cover component rendering logic. | Use functional assertions (`toBeVisible()`, `toHaveText()`, `toHaveCount()`) that verify the right content renders. Reserve screenshot testing for truly static pages (login page, empty states) if ever needed. |
| **Multi-browser testing** | "Test in Chrome, Firefox, and Safari." Industry best practice. | This is an internal app for 10 employees at a Bulgarian law firm. They all use Chrome (confirmed by the enterprise environment with Azure AD SSO). Running 3x the tests triples CI time and cost for zero additional coverage of real user scenarios. Cross-browser bugs in a Tailwind CSS app are exceptionally rare. | Run Chromium only. If a specific browser bug is reported, add a targeted test for that browser. Do not speculatively test browsers nobody uses. |
| **Mobile viewport testing** | "Test responsive layouts." Mobile report layouts are explicitly out of scope (PROJECT.md). | The timesheet page has separate mobile (EntryCard) and desktop (EntryRow/table) renderings. Testing both viewports doubles the test count. Mobile-specific layouts were explicitly scoped out. The 10 users access the app from desktop workstations. | Test desktop viewport only (1280x720). If mobile testing becomes needed in a future milestone, add a separate mobile test suite then. |
| **Test coverage percentage targets** | "Aim for 80% e2e coverage." Sounds rigorous. | E2e coverage metrics are misleading. A test that navigates to `/timesheets` technically "covers" hundreds of lines of server component, middleware, and API code. The number is meaningless. Coverage targets incentivize low-value tests that touch code without verifying behavior. The 965 unit tests already provide line-level coverage; e2e tests provide workflow-level confidence. | Define coverage by user workflows, not code lines. Track: "which user journeys have e2e tests?" not "what % of code do e2e tests execute?" |
| **Parallel test execution across workers** | "Run tests in parallel for speed." Default Playwright behavior. | Tests share a single PostgreSQL database. Parallel writes from multiple workers create race conditions (two tests creating entries, one test deleting while another reads). With ~15-20 tests in the initial suite, serial execution completes in under 2 minutes. Parallelism adds database isolation complexity for negligible time savings. | Run tests serially (`workers: 1`) in the initial suite. Revisit only if the suite grows beyond 50 tests and execution exceeds 5 minutes. At that point, consider per-worker database schemas or transaction rollback isolation. |
| **Mocking API responses in e2e tests** | "Mock the API to test the UI in isolation." Common in component testing. | E2e tests exist specifically to test the full stack: UI -> API -> database -> UI. Mocking the API defeats the purpose and creates a false sense of security. The app already has 965 unit tests that mock dependencies; e2e tests fill a different gap. | Never mock the API in e2e tests. Use the real API with a real database. If an API is slow or flaky, fix the API, do not mock it. Exception: the M365 Graph API should be skipped (external service, not owned), but the test should not verify M365 behavior. |
| **End-to-end tests for admin/billing/reports** | "Test all pages." Scope creep. | The milestone scope is explicitly "core timesheet entry workflows." Admin billing involves complex drag-and-drop (dnd-kit), PDF generation, retainer calculations -- each of which would need significant test infrastructure. Reports involve Recharts charts that are difficult to assert on. Adding these triples the milestone scope. | Scope strictly to timesheets page: create, edit, delete, date navigation, submission. Other pages get their own e2e milestone if/when needed. The existing unit tests cover billing and reports logic. |

## Feature Dependencies

```
[Auth bypass (JWT cookie injection)]
    └──requires──> [Test user seeded in database]

[Playwright config with setup project]
    └──requires──> [Auth bypass]
    └──requires──> [Test database seed]

[Page Object Model (TimesheetsPage)]
    └──requires──> [Playwright config] (needs base test/fixture setup)

[Custom fixtures]
    └──requires──> [Page Object Model]
    └──requires──> [Auth bypass] (authenticatedPage fixture)

[Create entry tests]
    └──requires──> [Page Object Model]
    └──requires──> [Seeded clients + topics in DB]

[Edit entry tests]
    └──requires──> [Create entry tests] (or API-level data factory)
    └──requires──> [Page Object Model]

[Delete entry tests]
    └──requires──> [Create entry tests] (or API-level data factory)
    └──requires──> [Page Object Model]

[WeekStrip navigation tests]
    └──requires──> [Page Object Model]
    └──requires──> [Seeded entries or ability to create them]

[Submission flow tests]
    └──requires──> [Create entry tests] (need 8+ hours of entries)
    └──requires──> [Page Object Model]

[CI integration]
    └──requires──> [Playwright config]
    └──requires──> [Test database seed]
    └──requires──> [All tests passing locally]

[API-level data factory]
    └──requires──> [Auth bypass] (API calls need session cookie)
    └──enhances──> [Edit entry tests] (pre-create entries faster)
    └──enhances──> [Delete entry tests]
    └──enhances──> [Submission flow tests] (seed 8+ hours quickly)

[Test tagging]
    └──enhances──> [CI integration] (fast smoke suite on PR)
```

### Dependency Notes

- **Auth bypass is the foundation:** Nothing works without it. The NextAuth middleware rejects unauthenticated requests to all routes except `/login` and `/api/auth`. The JWT encode approach is preferred over a Credentials provider because it requires zero changes to production auth configuration -- it is purely a test-side concern.
- **Test database seed is tightly coupled to auth:** The JWT encodes an email address. The seeded user must have that same email address. The `signIn` callback in `auth.ts` looks up the user by email and checks status is ACTIVE.
- **API-level data factory eliminates UI-through setup:** Edit, delete, and submission tests need pre-existing entries. Creating them through the UI is slow (5-10 seconds per entry) and couples setup failures to unrelated tests. Direct API calls via `page.request.post('/api/timesheets', ...)` are faster and more reliable.
- **CI integration depends on everything else working locally first:** Do not attempt CI setup until the full test suite passes on the development machine.

## MVP Definition

### Launch With (v1.1 -- This Milestone)

Minimum viable e2e test suite that provides browser-level regression protection for the revenue-critical timesheet workflow.

- [ ] Auth bypass infrastructure (JWT cookie injection + setup project) -- foundation
- [ ] Test database seed script (user, clients, topics/subtopics) -- foundation
- [ ] Playwright config (Chromium-only, serial execution, HTML reporter) -- foundation
- [ ] TimesheetsPage POM (locators for all interactive elements) -- maintainability
- [ ] Custom fixtures (timesheetsPage, authenticatedPage) -- ergonomics
- [ ] Create entry test (REGULAR client with subtopic + INTERNAL client topic-only) -- core CRUD
- [ ] Edit entry test (change description, change hours, cancel edit) -- core CRUD
- [ ] Delete entry test (confirm delete, cancel delete) -- core CRUD
- [ ] WeekStrip navigation test (select day, prev/next week, Today button) -- navigation
- [ ] Submission flow test (reach 8h, submit, verify status) -- business logic
- [ ] CI integration (GitHub Actions with PostgreSQL service) -- prevents test rot
- [ ] API-level data factory for test setup -- test speed and reliability

### Add After Validation (v1.x)

Features to add once the core suite is stable and running in CI.

- [ ] Accessibility checks with @axe-core/playwright -- when POM and fixture patterns are established
- [ ] Test tagging (@smoke, @crud) with selective CI execution -- when suite grows beyond 10 tests
- [ ] Trace-on-failure for CI debugging -- when failures in CI need remote diagnosis
- [ ] Submission revocation test (delete entry below 8h threshold) -- extends submission coverage
- [ ] Calendar popup date selection test -- extends navigation coverage
- [ ] Entry form validation tests (missing client, missing topic, zero hours, short description) -- edge cases

### Future Consideration (v2+)

Features to defer until there is a clear need.

- [ ] Admin/billing e2e tests -- separate milestone, different page, different complexity
- [ ] Reports e2e tests -- charts are hard to assert on, unit tests cover logic
- [ ] Multi-browser testing -- only if a browser-specific bug is reported
- [ ] Visual regression testing -- only if functional assertions prove insufficient
- [ ] Parallel test execution -- only if suite exceeds 50 tests and >5 minute runtime

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth bypass (JWT injection) | HIGH (blocks everything) | MEDIUM | P1 |
| Test database seed | HIGH (blocks everything) | MEDIUM | P1 |
| Playwright config | HIGH (blocks everything) | LOW | P1 |
| TimesheetsPage POM | HIGH (maintainability) | MEDIUM | P1 |
| Custom fixtures | MEDIUM (ergonomics) | LOW | P1 |
| Create entry test | HIGH (core workflow) | LOW | P1 |
| Edit entry test | HIGH (core workflow) | MEDIUM | P1 |
| Delete entry test | HIGH (core workflow) | LOW | P1 |
| WeekStrip navigation test | MEDIUM (core navigation) | LOW | P1 |
| Submission flow test | HIGH (business logic) | MEDIUM | P1 |
| API-level data factory | HIGH (speed + reliability) | LOW | P1 |
| CI integration | HIGH (prevents rot) | MEDIUM | P1 |
| HTML report + trace | MEDIUM (debugging) | LOW | P2 |
| Accessibility checks | MEDIUM (quality) | LOW | P2 |
| Test tagging | LOW (optimization) | LOW | P2 |
| Submission revocation test | MEDIUM (edge case) | LOW | P2 |
| Calendar popup test | LOW (secondary UI) | LOW | P3 |
| Form validation tests | LOW (unit tests cover) | LOW | P3 |

**Priority key:**
- P1: Must have for this milestone (matches PROJECT.md Active requirements + essential infrastructure)
- P2: Should have, add when time permits within milestone
- P3: Nice to have, future consideration

## Existing Infrastructure to Leverage

The project already has significant test infrastructure that the e2e suite should build upon (not duplicate):

| Existing Asset | How E2E Suite Uses It | Notes |
|----------------|----------------------|-------|
| 965 unit/integration tests (Vitest) | Do NOT re-test what these cover (component rendering, API validation logic, date formatting). E2e tests focus on full-stack workflows. | Vitest and Playwright coexist independently. Different test runners, different purposes. |
| Mock factories (`createMockUser`, `createMockClient`, etc.) | Inspiration for e2e seed data structure but NOT directly reusable. Vitest factories create in-memory mocks; e2e needs real database rows. | Write a separate `e2e/seed.ts` that uses Drizzle ORM to insert real rows, following the same data shapes. |
| `createMockRequest()` helper | Not usable in e2e context. This creates `NextRequest` objects for unit testing API routes. | E2e tests hit real API endpoints via browser fetch or `page.request`. |
| `lib/schema.ts` (Drizzle schema) | The e2e seed script imports schema definitions to insert test data correctly. | Direct dependency -- seed script uses `db.insert(users)`, `db.insert(clients)`, etc. |
| `lib/submission-utils.ts` (`MIN_SUBMISSION_HOURS`) | Import this constant in e2e tests to compute how many hours to seed for submission tests. | Avoids hardcoding `8` in tests -- if the threshold changes, tests adapt. |
| Playwright 1.57.0 (already in node_modules) | Use directly. Already installed but no config or tests exist yet. | Needs `playwright.config.ts` and `e2e/` directory. No `@playwright/test` in package.json devDependencies -- need to add it. |
| `app/.env` (DATABASE_URL, NEXTAUTH_SECRET) | E2e tests need the same `NEXTAUTH_SECRET` for JWT encoding and `DATABASE_URL` for seed script. | In CI, these come from GitHub Actions environment. Locally, reuse the dev `.env` file. |
| CI workflow (`.github/workflows/ci.yml`) | Extend with a new job for e2e tests, or add steps to existing job. Currently runs unit tests + migration check. | Separate job recommended: e2e needs PostgreSQL service container, browser install, and dev server, which unit tests do not. |

## Sources

- [Playwright Authentication Documentation](https://playwright.dev/docs/auth) -- HIGH confidence, official docs
- [Playwright Fixtures Documentation](https://playwright.dev/docs/test-fixtures) -- HIGH confidence, official docs
- [Playwright Page Object Models](https://playwright.dev/docs/pom) -- HIGH confidence, official docs
- [Playwright CI Setup](https://playwright.dev/docs/ci-intro) -- HIGH confidence, official docs
- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots) -- HIGH confidence, official docs (referenced for anti-feature analysis)
- [Auth.js Testing Guide](https://authjs.dev/guides/testing) -- HIGH confidence, official NextAuth docs
- [NextAuth E2E Testing Issue #6796](https://github.com/nextauthjs/next-auth/issues/6796) -- MEDIUM confidence, community discussion with maintainer input
- [Playwright Fixtures vs POM](https://dzone.com/articles/playwright-fixtures-vs-pom) -- MEDIUM confidence, community analysis
- [Checkly: POMs and Fixtures with Playwright](https://www.checklyhq.com/blog/page-object-models-and-fixtures-with-playwright/) -- MEDIUM confidence, respected testing company
- [Test Data Strategies for E2E Tests](https://www.playwright-user-event.org/playwright-tips/test-data-strategies-for-e2e-tests) -- MEDIUM confidence, community guide
- [NextAuth + Playwright + MSW Integration](https://dev.to/kuroski/writing-integration-tests-for-nextjs-next-auth-prisma-using-playwright-and-msw-388m) -- MEDIUM confidence, detailed community tutorial
- Existing codebase analysis (middleware, auth.ts, TimesheetsContent, EntryForm, EntryRow, WeekStrip, EntriesList, test helpers, CI workflow) -- HIGH confidence, direct code review

---
*Feature research for: Playwright e2e test suite for CRUD-heavy timesheet workflows*
*Researched: 2026-02-25*
