# Phase 7: CI Integration

**Milestone:** v1.1 E2E Timesheets
**Goal:** Every PR to `main` automatically runs the e2e test suite against a production build, so regressions are caught before merge

## Requirements

| ID | Requirement |
|----|-------------|
| REQ-25 | New `e2e` job in `.github/workflows/ci.yml` |
| REQ-26 | PostgreSQL 17 service container with `veda_legal_test` database and health check |
| REQ-27 | Chromium browser caching via `actions/cache@v4` |
| REQ-28 | `npm run db:migrate` against test database before tests |
| REQ-29 | Upload `playwright-report/` as artifact on failure |
| REQ-30 | Existing unit test job unaffected — both jobs run independently |

## Success Criteria

1. A new `e2e` job appears in the CI workflow and runs on every PR to `main`
2. The e2e job provisions its own PostgreSQL 17 database, runs migrations, and executes Playwright tests against a production build (`next build && next start`)
3. When e2e tests fail, the HTML report is uploaded as a downloadable artifact for debugging
4. The existing unit test job continues to run independently and is unaffected by the new e2e job

## Depends On

Phase 6 (Core Timesheet Workflow Tests) — all tests must pass locally before adding CI complexity

## Delivers

- Updated `.github/workflows/ci.yml` with new `e2e` job
- PostgreSQL 17 service container configuration with health check
- Chromium binary caching via `actions/cache@v4`
- Test database migration step
- Failure artifact upload for `playwright-report/`
