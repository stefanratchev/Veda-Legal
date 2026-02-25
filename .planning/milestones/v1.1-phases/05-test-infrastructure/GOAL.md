# Phase 5: Test Infrastructure

**Milestone:** v1.1 E2E Timesheets
**Goal:** A developer can run `npm run test:e2e` and a single smoke test passes — proving auth bypass, test database, seed data, and Playwright config all work end-to-end

## Requirements

| ID | Requirement |
|----|-------------|
| REQ-01 | Auth bypass via JWT cookie injection using `next-auth/jwt` `encode()` |
| REQ-02 | Playwright config with setup project, Chromium-only, serial execution, HTML reporter |
| REQ-03 | Separate test database (`veda_legal_test`) with seed data |
| REQ-04 | DB fixtures with `TRUNCATE ... CASCADE` cleanup in `beforeEach` |
| REQ-05 | Composed test export (`test.extend()`) combining auth + db fixtures |
| REQ-06 | `data-testid` attributes on 6 key components |
| REQ-07 | `.env.test` with TEST_DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL |
| REQ-08 | `test:e2e` and `test:e2e:ui` npm scripts |
| REQ-09 | Playwright artifacts in `.gitignore` |
| REQ-10 | Smoke test: `/timesheets` renders without redirect to `/login` |

## Success Criteria

1. Running `npm run test:e2e` from `app/` launches Playwright, starts the dev server against `veda_legal_test`, and executes at least one test
2. The smoke test navigates to `/timesheets` and sees the timesheets page (not a redirect to `/login`) — proving JWT cookie auth bypass works
3. The timesheets page renders ClientSelect, TopicCascadeSelect, and DurationPicker with seed data (2 clients, 2 topics, 3 subtopics visible in dropdowns) — proving test database seeding works
4. Running the smoke test twice in sequence produces the same result — proving `TRUNCATE CASCADE` cleanup prevents state leakage
5. Key UI components have `data-testid` attributes (ClientSelect, TopicCascadeSelect, DurationPicker, EntryCard, WeekStrip, submit button) usable as Playwright locators

## Depends On

Nothing (first phase of v1.1; v1.0 phases 1-4 are shipped)

## Key Risks

- `encode()` salt parameter: defaults to `"next-auth.session-token"` when omitted — verify the injected cookie name matches what NextAuth expects. If the smoke test redirects to `/login`, check this first.
- `webServer.env` propagation: verify the Next.js dev server picks up `DATABASE_URL` from Playwright's `webServer.env` config (not the shell environment).
- `getCurrentUser()` lookup field: `lib/user.ts` looks up user by email — confirm the injected JWT's `email` field is what gets passed to the DB query.

## Delivers

- `playwright.config.ts`
- `e2e/` directory structure (setup, fixtures, helpers, page-objects, specs)
- `.env.test`
- Auth setup project (`e2e/setup/auth.setup.ts`)
- DB fixtures (`e2e/fixtures/db.ts`) with seed + cleanup
- Composed test export (`e2e/fixtures/test.ts`)
- `data-testid` attributes on 6 production components
- npm scripts (`test:e2e`, `test:e2e:ui`)
- `.gitignore` updates
- Smoke test (`e2e/specs/smoke.spec.ts`)
