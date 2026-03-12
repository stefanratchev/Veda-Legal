# Phase 7: CI Integration - Research

**Researched:** 2026-02-25
**Domain:** GitHub Actions CI workflow for Playwright e2e tests with PostgreSQL service container
**Confidence:** HIGH

## Summary

This phase adds a new `e2e` job to the existing `.github/workflows/ci.yml` workflow. The existing CI has a single `test` job that runs Vitest unit tests and checks migration sync. The new `e2e` job must run independently alongside it, provisioning a PostgreSQL 17 database, building the app, and executing Playwright tests against the production build.

The most critical finding is the **database schema provisioning problem**. The Drizzle migration chain is broken for fresh databases: migration `0000_pretty_thing.sql` is a no-op that assumes the schema already exists (from a legacy Prisma setup), and `0001_baseline.sql` runs `DROP TABLE "_prisma_migrations" CASCADE` which fails on a fresh database that has no such table. During Phase 5, local development worked around this via `pg_dump --schema-only` from the dev database. For CI, the solution is `drizzle-kit push --force`, which reads the TypeScript schema definition and applies it directly to the database without migration history. This bypasses the broken migration chain entirely.

The Playwright configuration already has CI-aware settings (`forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 1 : 0`, `reporter: process.env.CI ? "html" : "list"`). The webServer command currently uses `npm run dev` but should use `npm run build && npm run start` for CI to test against the production build. This can be handled by either modifying the Playwright config to conditionally use different commands or by running the build separately in CI and only using `npm run start` in the webServer.

**Primary recommendation:** Add a new `e2e` job to `ci.yml` that uses PostgreSQL 17 service container, `drizzle-kit push --force` for schema provisioning, Chromium browser caching via `actions/cache@v4`, and `actions/upload-artifact@v4` for failure report uploads. Modify `playwright.config.ts` to use a production build command in CI.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-25 | New `e2e` job in `.github/workflows/ci.yml` | GitHub Actions workflow syntax verified via official docs. New job runs alongside existing `test` job. See CI Workflow Architecture section. |
| REQ-26 | PostgreSQL 17 service container with `veda_legal_test` database and health check | Official GitHub docs provide service container pattern with `pg_isready` health check. Use `postgres:17` image with `POSTGRES_DB: veda_legal_test`. See PostgreSQL Service Container section. |
| REQ-27 | Chromium browser caching via `actions/cache@v4` | Cache `~/.cache/ms-playwright` with key based on Playwright version from package-lock.json. Conditional install based on cache-hit. See Browser Caching section. |
| REQ-28 | `npm run db:migrate` against test database before tests | **CRITICAL DEVIATION:** `drizzle-kit migrate` fails on fresh databases due to broken Prisma-to-Drizzle migration chain. Use `drizzle-kit push --force` instead to sync schema from TypeScript definition. See Database Schema Provisioning section. |
| REQ-29 | Upload `playwright-report/` as artifact on failure | `actions/upload-artifact@v4` with `if: failure()` condition. 30-day retention. See Artifact Upload section. |
| REQ-30 | Existing unit test job unaffected — both jobs run independently | Jobs are defined as siblings in the `jobs:` block with no `needs:` dependency. Existing `test` job YAML is untouched. See CI Workflow Architecture section. |
</phase_requirements>

## Standard Stack

### Core
| Library/Action | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| `actions/checkout` | v4 | Checkout repository code | Already used in existing CI; consistent version |
| `actions/setup-node` | v4 | Setup Node.js 22 with npm cache | Already used in existing CI; consistent version |
| `actions/cache` | v4 | Cache Playwright Chromium binary between runs | Official GitHub caching action; REQ-27 specifies v4 |
| `actions/upload-artifact` | v4 | Upload HTML test report on failure | Standard pattern from Playwright CI docs |
| `postgres:17` | Docker image | PostgreSQL 17 service container | Matches project's PostgreSQL version |
| `drizzle-kit` | 0.31.8 | Schema provisioning via `push --force` | Already a project dependency; avoids broken migration chain |
| `@playwright/test` | 1.58.2 | E2E test runner | Already installed and configured in project |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `npx playwright install --with-deps chromium` | Install Chromium binary + OS-level dependencies | CI only, when cache miss |
| `npx playwright install-deps chromium` | Install only OS-level dependencies | CI only, when cache hit (browser binary cached but OS deps not) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `drizzle-kit push --force` | Fix migration chain with a new baseline migration | Cleaner long-term but requires restructuring all 10 migration files; push is the pragmatic CI solution |
| `actions/cache@v4` for Chromium | No caching, just `npx playwright install --with-deps` every run | Simpler but adds 30-60s to every CI run; caching saves meaningful time |
| `if: failure()` for artifact upload | `if: ${{ !cancelled() }}` (Playwright's recommendation) | `!cancelled()` uploads on success too (useful for debugging); `failure()` only on failure per REQ-29 |
| Separate workflow file for e2e | Same `ci.yml` file | Same file is simpler to maintain and ensures both jobs trigger on the same events |

### No Installation Required
All dependencies are already in `package.json`. No new packages need to be installed. The CI changes are purely workflow configuration.

## Architecture Patterns

### CI Workflow Structure
```yaml
# .github/workflows/ci.yml — TWO independent jobs
jobs:
  test:          # EXISTING — unit tests + migration check (UNCHANGED)
    runs-on: ubuntu-latest
    steps: [...]

  e2e:           # NEW — Playwright e2e tests
    runs-on: ubuntu-latest
    services:
      postgres:  # PostgreSQL 17 service container
    steps:
      1. Checkout
      2. Setup Node.js 22
      3. Install dependencies (npm ci)
      4. Push schema to test database (drizzle-kit push --force)
      5. Cache/restore Chromium binary
      6. Install Playwright browsers (conditional)
      7. Build Next.js production app
      8. Run Playwright tests
      9. Upload report artifact (on failure)
```

### Pattern 1: PostgreSQL Service Container
**What:** GitHub Actions runs a PostgreSQL 17 Docker container alongside the job, accessible via `localhost:5432`.
**When to use:** Any CI job that needs a real database.
**Example:**
```yaml
# Source: https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers
services:
  postgres:
    image: postgres:17
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: veda_legal_test
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432
```

### Pattern 2: Chromium Browser Caching
**What:** Cache `~/.cache/ms-playwright` between CI runs to avoid downloading Chromium every time.
**When to use:** Every e2e CI run.
**Example:**
```yaml
# Source: https://playwrightsolutions.com/playwright-github-action-to-cache-the-browser-binaries/
- name: Get Playwright version
  id: playwright-version
  run: echo "PLAYWRIGHT_VERSION=$(node -e "console.log(require('./package-lock.json').packages['node_modules/@playwright/test'].version)")" >> $GITHUB_ENV
  working-directory: ./app

- name: Cache Playwright browsers
  uses: actions/cache@v4
  id: playwright-cache
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ env.PLAYWRIGHT_VERSION }}

- name: Install Playwright browsers
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install --with-deps chromium
  working-directory: ./app

- name: Install Playwright OS dependencies
  if: steps.playwright-cache.outputs.cache-hit == 'true'
  run: npx playwright install-deps chromium
  working-directory: ./app
```

**Key detail:** When cache hits, the browser binary is restored but OS-level dependencies (libnss3, libgbm1, etc.) are NOT cached. Must run `npx playwright install-deps chromium` even on cache hit.

### Pattern 3: Production Build for E2E
**What:** Build the Next.js app before running Playwright, then use `npm run start` in Playwright's webServer.
**When to use:** CI environment — tests should run against production build, not dev server.
**Example approach — modify `playwright.config.ts`:**
```typescript
webServer: {
  command: process.env.CI
    ? "npm run start -- --port 3001"
    : "npm run dev -- --port 3001",
  url: "http://localhost:3001",
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  env: {
    DATABASE_URL: process.env.TEST_DATABASE_URL!,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
    NEXTAUTH_URL: "http://localhost:3001",
  },
},
```

Then add a separate build step in CI before running tests:
```yaml
- name: Build Next.js app
  run: npm run build
  working-directory: ./app
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/veda_legal_test
```

### Pattern 4: Schema Provisioning via Push
**What:** Use `drizzle-kit push --force` to sync TypeScript schema to empty CI database.
**When to use:** CI only. Bypasses broken migration history.
**Example:**
```yaml
- name: Provision test database schema
  run: npx drizzle-kit push --force
  working-directory: ./app
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/veda_legal_test
```

### Anti-Patterns to Avoid
- **Running `drizzle-kit migrate` on fresh CI database:** Will fail because migration 0000 is a no-op (assumes Prisma schema exists) and 0001 drops `_prisma_migrations` table that doesn't exist on a fresh database.
- **Using `npm run dev` in CI:** Dev server is slower, includes hot reloading overhead, and doesn't match production behavior. Always test against production build in CI.
- **Omitting `install-deps` on cache hit:** Browser binary cached, but OS-level dependencies are not. Chromium will crash without its system library dependencies.
- **Sharing database between test and e2e jobs:** Each job gets its own service container. Never try to share a database across jobs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PostgreSQL provisioning | Custom Docker Compose or script | GitHub Actions service container | Built-in, health-checked, cleaned up automatically |
| Browser binary download | Manual wget/curl of Chromium | `npx playwright install --with-deps chromium` | Version-matched to Playwright, handles all OS deps |
| CI caching | Custom tarball upload/download | `actions/cache@v4` | Automatic key invalidation, compressed storage, integrated |
| Artifact upload | Custom S3 upload or commit to repo | `actions/upload-artifact@v4` | Integrated with GitHub UI, auto-expiring, no credentials needed |
| Schema sync on fresh DB | Write a custom SQL dump script | `drizzle-kit push --force` | Reads TypeScript schema directly, handles enums/indexes/FKs |

**Key insight:** This phase is pure CI configuration — no application code changes except potentially the Playwright config webServer command. Every building block is a well-established GitHub Actions pattern or existing project tool.

## Common Pitfalls

### Pitfall 1: Broken Migration Chain on Fresh Database
**What goes wrong:** `drizzle-kit migrate` fails because migration 0000 is a no-op (expects schema from Prisma era) and 0001 runs `DROP TABLE "_prisma_migrations" CASCADE` on a table that doesn't exist.
**Why it happens:** The project migrated from Prisma to Drizzle. The first two migrations assume an existing Prisma-managed database, which CI doesn't have.
**How to avoid:** Use `drizzle-kit push --force` instead of `drizzle-kit migrate`. This reads the TypeScript schema and applies it directly without migration history.
**Warning signs:** Error `relation "_prisma_migrations" does not exist` or empty tables after migration appears to succeed.

### Pitfall 2: Chromium OS Dependencies Missing After Cache Hit
**What goes wrong:** Playwright cache restores the binary but Chromium crashes with missing shared library errors.
**Why it happens:** `actions/cache` only caches `~/.cache/ms-playwright` (the binary). OS-level packages (libnss3, libgbm1, etc.) installed via `apt-get` are not cached.
**How to avoid:** Always run `npx playwright install-deps chromium` even when cache hits. Only skip `npx playwright install --with-deps chromium` (the full install including binary download) on cache hit.
**Warning signs:** `Error: browserType.launch: Executable requires...` or `Protocol error` in Playwright output.

### Pitfall 3: Next.js Build Requires DATABASE_URL
**What goes wrong:** `npm run build` fails because Next.js tries to import database modules at build time and the env var is missing.
**Why it happens:** The existing CI unit test job uses a placeholder `DATABASE_URL` for this reason. The e2e job needs a real one pointing at the service container.
**How to avoid:** Provide `DATABASE_URL: postgresql://postgres:postgres@localhost:5432/veda_legal_test` as an env variable for both the build step and the test step.
**Warning signs:** Build errors mentioning "Cannot connect to database" or "Environment variable DATABASE_URL is required."

### Pitfall 4: WebServer Port Conflict Between Dev and CI
**What goes wrong:** Tests fail with "Could not start server" because port 3001 is already in use.
**Why it happens:** If `reuseExistingServer` is true in CI, Playwright may try to reuse a non-existent server. If false, it starts fresh.
**How to avoid:** The existing config already has `reuseExistingServer: !process.env.CI`, which is correct. In CI, `process.env.CI` is `true`, so `reuseExistingServer` is `false`, forcing a fresh server start.
**Warning signs:** Timeout waiting for server, or "address already in use" errors.

### Pitfall 5: Environment Variables Not Reaching Playwright Config
**What goes wrong:** Playwright config reads `process.env.TEST_DATABASE_URL` but it's undefined in CI.
**Why it happens:** The `.env.test` file sets `TEST_DATABASE_URL` locally, but CI doesn't use `.env.test` by default — Playwright config loads it via `dotenv.config()`.
**How to avoid:** The Playwright config already loads `.env.test` via `dotenv.config()`. For CI, also set the environment variables explicitly in the workflow YAML as fallbacks. The `.env.test` file IS committed to the repo (excluded from `.gitignore` via `!.env.test`), so dotenv will find it. However, the `TEST_DATABASE_URL` value in `.env.test` uses `localhost:5432/veda_legal_test` without credentials — CI needs `postgres:postgres@localhost:5432/veda_legal_test`. Override via workflow env vars.
**Warning signs:** "Connection refused" or "authentication failed" errors from pg Pool.

### Pitfall 6: Global Setup Fails Silently
**What goes wrong:** Seed data is not inserted but tests proceed and fail with confusing "element not found" errors.
**Why it happens:** Global setup uses raw SQL inserts. If the schema isn't provisioned yet (see Pitfall 1), inserts fail but Playwright may not surface the error clearly.
**How to avoid:** Ensure schema is provisioned before Playwright runs. The `drizzle-kit push --force` step must come before `npx playwright test`. Verify by checking the step output for "Changes applied" or similar.
**Warning signs:** All tests fail with locator/element not found errors even though the app loads.

## Code Examples

### Complete E2E Job YAML
```yaml
# Source: Synthesized from GitHub Actions docs, Playwright CI docs, project analysis
e2e:
  runs-on: ubuntu-latest
  timeout-minutes: 15

  services:
    postgres:
      image: postgres:17
      env:
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: veda_legal_test
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
      ports:
        - 5432:5432

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'
        cache-dependency-path: app/package-lock.json

    - name: Install dependencies
      working-directory: ./app
      run: npm ci
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/veda_legal_test

    - name: Provision test database schema
      working-directory: ./app
      run: npx drizzle-kit push --force
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/veda_legal_test

    - name: Get Playwright version
      id: playwright-version
      working-directory: ./app
      run: echo "PLAYWRIGHT_VERSION=$(node -e "console.log(require('./package-lock.json').packages['node_modules/@playwright/test'].version)")" >> $GITHUB_ENV

    - name: Cache Playwright browsers
      uses: actions/cache@v4
      id: playwright-cache
      with:
        path: ~/.cache/ms-playwright
        key: ${{ runner.os }}-playwright-${{ env.PLAYWRIGHT_VERSION }}

    - name: Install Playwright browsers
      if: steps.playwright-cache.outputs.cache-hit != 'true'
      working-directory: ./app
      run: npx playwright install --with-deps chromium

    - name: Install Playwright OS dependencies
      if: steps.playwright-cache.outputs.cache-hit == 'true'
      working-directory: ./app
      run: npx playwright install-deps chromium

    - name: Build Next.js app
      working-directory: ./app
      run: npm run build
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/veda_legal_test

    - name: Run Playwright tests
      working-directory: ./app
      run: npx playwright test
      env:
        CI: 'true'
        TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/veda_legal_test
        NEXTAUTH_SECRET: test-secret-for-e2e-minimum-32-characters!!
        NEXTAUTH_URL: http://localhost:3001
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/veda_legal_test

    - name: Upload Playwright report
      uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: app/playwright-report/
        retention-days: 30
```

### Modified Playwright Config WebServer (CI-aware)
```typescript
// Source: Playwright CI docs + project analysis
webServer: {
  command: process.env.CI
    ? "npm run start -- --port 3001"
    : "npm run dev -- --port 3001",
  url: "http://localhost:3001",
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  env: {
    DATABASE_URL: process.env.TEST_DATABASE_URL!,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
    NEXTAUTH_URL: "http://localhost:3001",
  },
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `actions/upload-artifact@v3` | `actions/upload-artifact@v4` | 2024 | Node 20 runner, improved performance |
| `actions/cache@v3` | `actions/cache@v4` | 2024 | Improved restore performance |
| `npx playwright install` | `npx playwright install --with-deps` | Always recommended | Ensures OS dependencies are installed |
| Migration-based DB provisioning | `drizzle-kit push --force` for CI | Project-specific decision | Bypasses broken Prisma-to-Drizzle migration chain |

**Deprecated/outdated:**
- `actions/upload-artifact@v3` — deprecated, use v4
- `microsoft/playwright-github-action` — deprecated; direct `npx playwright install` is now recommended by Playwright docs

## Open Questions

1. **REQ-28 wording says `npm run db:migrate` but this won't work on fresh CI database**
   - What we know: Migration 0000 is a no-op, 0001 drops Prisma table that doesn't exist. `pg_dump` was used locally as a workaround (documented in Phase 5 Plan 2 summary).
   - What's unclear: Whether the requirement text should be taken literally or interpreted as "provision the database schema."
   - Recommendation: Use `drizzle-kit push --force` as the CI equivalent of "migrate." Document the deviation clearly. The spirit of the requirement (schema must exist before tests) is met, just via a different mechanism.

2. **Timeout for production build + tests**
   - What we know: Playwright tests currently take ~8-12s locally with dev server. Production build adds ~30-60s. Total CI time estimated at 3-5 minutes.
   - What's unclear: Exact CI build time (depends on GitHub runner performance).
   - Recommendation: Set `timeout-minutes: 15` on the e2e job (generous buffer). Adjust after first successful run.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | GitHub Actions workflow YAML validation + Playwright e2e |
| Config file | `.github/workflows/ci.yml` |
| Quick run command | Manual: push branch, open PR to main, check Actions tab |
| Full suite command | `npm run test:e2e` (local) or GitHub Actions run (CI) |
| Estimated runtime | ~3-5 min (CI), ~15s (local) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-25 | New e2e job in ci.yml | manual/CI | Open PR to main, verify e2e job appears | N/A (workflow config) |
| REQ-26 | PostgreSQL 17 service container with health check | manual/CI | Open PR to main, verify postgres service starts | N/A (workflow config) |
| REQ-27 | Chromium browser caching | manual/CI | Open PR to main, check cache step output | N/A (workflow config) |
| REQ-28 | DB schema provisioned before tests | manual/CI | Open PR to main, verify drizzle-kit push step passes | N/A (workflow config) |
| REQ-29 | Artifact uploaded on failure | manual/CI | Temporarily break a test, open PR, verify artifact | N/A (workflow config) |
| REQ-30 | Existing test job unaffected | unit + manual | `npm run test -- --run` locally; verify test job in PR | Existing CI job |

### Nyquist Sampling Rate
- **Minimum sample interval:** After each committed change to ci.yml -> push to branch, open/update PR, verify both jobs appear and run
- **Full suite trigger:** Push final change, verify both `test` and `e2e` jobs pass on the PR
- **Phase-complete gate:** Both CI jobs green on a PR to main
- **Estimated feedback latency per task:** ~3-5 minutes (CI execution time)

### Wave 0 Gaps
None -- this phase modifies an existing CI workflow file and the existing Playwright config. No new test files or test infrastructure needed. The e2e tests from Phase 6 will serve as the validation that the CI e2e job works correctly.

## Sources

### Primary (HIGH confidence)
- [GitHub Actions PostgreSQL service containers docs](https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers) - Service container pattern, health checks, port mapping
- [Playwright CI docs](https://playwright.dev/docs/ci) - GitHub Actions workflow, artifact upload, browser installation
- [Playwright CI intro](https://playwright.dev/docs/ci-intro) - Recommended workflow YAML, upload-artifact pattern
- [Drizzle-kit push docs](https://orm.drizzle.team/docs/drizzle-kit-push) - Push --force flag for non-interactive schema sync
- Project files: `.github/workflows/ci.yml`, `app/playwright.config.ts`, `app/.env.test`, `app/drizzle/` migration files

### Secondary (MEDIUM confidence)
- [Playwright Solutions - Browser caching](https://playwrightsolutions.com/playwright-github-action-to-cache-the-browser-binaries/) - Cache key strategy, conditional install pattern
- Phase 5 Summary (05-02-SUMMARY.md) - Documents pg_dump workaround for broken migration chain, confirming `drizzle-kit migrate` fails on fresh databases

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already in use (GitHub Actions, Playwright, Drizzle); only CI workflow plumbing needed
- Architecture: HIGH - Well-documented patterns from official GitHub and Playwright docs; verified against existing project config
- Pitfalls: HIGH - Database provisioning pitfall directly observed in Phase 5 (05-02-SUMMARY.md documents the pg_dump workaround); browser caching pitfall documented in Playwright community

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable CI patterns, unlikely to change)
