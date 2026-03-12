# Phase 5: Test Infrastructure - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up Playwright e2e test infrastructure: auth bypass via JWT cookie injection, test database with seed data and cleanup fixtures, data-testid attributes on key components, and a smoke test proving the full stack works. No actual workflow tests — those are Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Test User Identity
- Use an ADMIN-position test user — gives full access to all routes and features, avoiding auth-related test failures that aren't testing auth
- Test user email: `test@vedalegal.bg` (or matching format of real user emails in schema)
- User must exist in `veda_legal_test` database seed data

### Seed Data Composition
- Use obviously-fake but realistic-looking names (not "Test Client 1")
- 2 clients: 1 REGULAR (e.g., "Acme Corp"), 1 INTERNAL (e.g., the firm's internal client)
- 2 topics: 1 REGULAR-type (e.g., "Corporate Advisory"), 1 INTERNAL-type (e.g., "Firm Administration")
- 3 subtopics under the REGULAR topic: at least 1 with `isPrefix: true` (e.g., "Client correspondence:") and 1 with `isPrefix: false`
- Seed data is reference data — seeded once in global setup, treated as read-only

### Dev Workflow
- Use port 3001 for the test server to avoid conflicts with a running dev server on 3000
- `reuseExistingServer: true` in dev, full `webServer` start in CI
- Developers must create the `veda_legal_test` database manually once; document the one-time setup command

### data-testid Naming Convention
- Use kebab-case matching component names: `client-select`, `topic-cascade-select`, `duration-picker`, `entry-card`, `week-strip`, `submit-button`
- Prefix with context if needed for disambiguation (e.g., `entry-form-submit` vs generic `submit`)

### Claude's Discretion
- All implementation details: file structure, Playwright config specifics, fixture composition patterns
- Exact seed data values (names, descriptions, hours)
- Error handling in fixtures
- Auth setup project internals (JWT encode params, cookie naming)
- beforeEach vs afterEach cleanup ordering (research recommends beforeEach — follow that)
- .env.test structure and variable naming

</decisions>

<specifics>
## Specific Ideas

No specific requirements from discussion — user deferred all decisions to Claude. Follow research recommendations:
- JWT cookie injection per research SUMMARY.md architecture
- Port 3001 per research gap analysis
- beforeEach cleanup per research recommendation
- Chromium-only, serial execution per milestone-level decisions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-test-infrastructure*
*Context gathered: 2026-02-25*
