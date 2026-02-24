# Codebase Concerns

**Analysis Date:** 2026-02-24

## Tech Debt

**Dual Auth Utility Modules:**
- Issue: Two parallel auth/authorization modules exist with overlapping responsibilities
- Files: `app/src/lib/api-utils.ts`, `app/src/lib/auth-utils.ts`
- Impact: `api-utils.ts` is used by all API routes; `auth-utils.ts` is only imported by one server component (`app/src/app/(authenticated)/timesheets/page.tsx`). The newer `auth-utils.ts` has a cleaner interface (returns `{ session, user }` with typed `AuthUser`) while `api-utils.ts` returns only `{ session }` requiring a second DB lookup for the user. This creates maintenance divergence — changes to auth logic may need to be applied in both places.
- Fix approach: Migrate API routes to use `auth-utils.ts` (or consolidate into one module), then remove `api-utils.ts`.

**Hardcoded Role Checks Bypassing Utility Functions:**
- Issue: The `hasAdminAccess()` utility exists in `api-utils.ts` but many files use inline `["ADMIN", "PARTNER"].includes(user.position)` instead
- Files: `app/src/app/(authenticated)/team/page.tsx:36`, `app/src/app/(authenticated)/(admin)/layout.tsx:11`, `app/src/app/(authenticated)/(admin)/reports/page.tsx:253`, `app/src/app/api/reports/route.ts:62`, `app/src/components/layout/Sidebar.tsx:98`
- Impact: If the role set for "admin" changes (e.g., adding SENIOR_PARTNER), each hardcoded check must be updated individually. Risk of inconsistent behavior.
- Fix approach: Replace all inline `["ADMIN", "PARTNER"].includes(...)` with `hasAdminAccess(position)` from `api-utils.ts`.

**Position Type Redeclared in Multiple Files:**
- Issue: The `Position` type (`"ADMIN" | "PARTNER" | "SENIOR_ASSOCIATE" | "ASSOCIATE" | "CONSULTANT"`) is locally redeclared in several files instead of being imported from a shared types module
- Files: `app/src/lib/auth-utils.ts:14`, `app/src/lib/user.ts:11`, `app/src/components/employees/EmployeesContent.tsx:9`, `app/src/components/employees/EmployeeModal.tsx:5`
- Impact: Schema drift risk — if the enum changes in `schema.ts`, the local type aliases won't update automatically.
- Fix approach: Export `Position` type from `app/src/types/index.ts` and import from there.

**BILLING_START_DATE Is a Hardcoded String Constant:**
- Issue: `BILLING_START_DATE = "2026-02-01"` is a fixed string in `app/src/lib/billing-config.ts`. It controls which time entries are included in billing and the unbilled summary.
- Files: `app/src/lib/billing-config.ts`, `app/src/app/api/billing/route.ts:199`, `app/src/app/api/billing/unbilled-summary/route.ts:70`
- Impact: This value was chosen as the billing launch date. As months pass and if the system needs to bill retroactively or the cutoff policy changes, this hardcoded value will silently exclude entries.
- Fix approach: Convert to a configurable env variable or make it a per-SD setting rather than a global filter floor.

**`secondaryEmails` Stored as a Free-Text String:**
- Issue: Multiple email addresses for a client are stored as a single `text` field in the database, not as an array or a related table
- Files: `app/src/lib/schema.ts:124`, `app/src/app/api/clients/route.ts:170`
- Impact: No validation that the field contains valid email addresses (API accepts any string). Cannot query by secondary email. Fragile parsing if UI or future code needs to split the field.
- Fix approach: Migrate to a separate `client_emails` table or PostgreSQL `text[]` array with proper validation.

**`practiceArea` Field Not Editable via Client API:**
- Issue: The `clients` table has a `practiceArea` enum column in `schema.ts`, and it is fetched in the clients page, but it is not included in the `POST /api/clients` or `PATCH /api/clients` request body handling
- Files: `app/src/app/api/clients/route.ts` (lines 106, 218), `app/src/lib/schema.ts:119`
- Impact: `practiceArea` can never be set or changed through the application UI, leaving it permanently `null` for all clients.
- Fix approach: Add `practiceArea` to client create/update API handlers and the `ClientModal` form.

**`retainerOverageRate` Not Stored on Client Record:**
- Issue: `service_descriptions` snapshots `retainerOverageRate` from the client at creation time (set to `client.hourlyRate`). However, `retainerOverageRate` is not a field on the `clients` table — it is derived at SD creation from `clients.hourlyRate`. If a client's hourly rate changes after an SD is created, there is no way to see what the original overage rate was intended to be.
- Files: `app/src/app/api/billing/route.ts:226-232`, `app/src/lib/schema.ts:52`
- Impact: No per-client configurable overage rate — it is always the same as the base hourly rate. The snapshot mechanism works, but the intent is not surfaced anywhere in the UI.
- Fix approach: Add a `retainerOverageRate` field to the `clients` table so it can be set independently from `hourlyRate`.

**Temporary Sign Out Button on Dashboard:**
- Issue: The Dashboard component has a "Sign Out" button labeled as temporary for testing
- Files: `app/src/components/dashboard/DashboardContent.tsx:222`
- Impact: Poor UX — sign-out appears on the dashboard but the proper place is in the sidebar/header. No functional bug but creates confusion.
- Fix approach: Remove the temporary button. Sign out is accessible via sidebar or header nav.

## Known Bugs

**Service Description Creation Fetches ALL Client Time Entries Without Date Filter:**
- Symptoms: When creating a new service description, the query fetches all time entries for the client without a date range filter, then filters in JavaScript
- Files: `app/src/app/api/billing/route.ts:163-209`
- Trigger: Creating a service description for a client with many historical time entries (hundreds+)
- Details: The `where` clause only has `eq(timeEntries.clientId, clientId)` — the commented-out date filter was never implemented. Date filtering happens in the `filteredEntries.filter()` call in memory. The comment `// date >= startDate AND date <= endDate / In Drizzle with date strings, we compare directly` indicates the intent but the implementation was left incomplete.
- Workaround: None — it works correctly but scales poorly

**N+1 Query Pattern in SD Delete and Topic Delete:**
- Symptoms: Deleting a service description or topic that has written-off line items issues one SELECT + one UPDATE per affected time entry in a loop
- Files: `app/src/app/api/billing/[id]/route.ts:239-252`, `app/src/app/api/billing/[id]/topics/[topicId]/route.ts:183-194`
- Trigger: Deleting a DRAFT SD or topic with multiple waived line items
- Impact: For an SD with 20 waived entries, this is 40 sequential DB queries inside a transaction. At current scale (small firm) this is acceptable, but will degrade with more data.

## Security Considerations

**CSP Allows `unsafe-inline` and `unsafe-eval`:**
- Risk: The Content Security Policy in `next.config.ts` includes `'unsafe-inline'` for scripts and `'unsafe-eval'`, which significantly weakens XSS protections
- Files: `app/next.config.ts:38`
- Current mitigation: This is required by Next.js's client-side hydration and is noted in CLAUDE.md as a known limitation
- Recommendations: Track Next.js releases — newer versions may support nonce-based CSP. Consider adding a `report-uri` endpoint to detect CSP violations in production.

**No Rate Limiting on API Routes:**
- Risk: All API endpoints (auth-protected but not rate-limited) could be hit with high-frequency requests. M365 activity endpoint makes 3 external Graph API calls per request.
- Files: All files under `app/src/app/api/`
- Current mitigation: Azure Web App can provide infrastructure-level rate limiting; NextAuth limits auth routes
- Recommendations: Add route-level rate limiting (e.g., Upstash Redis or Azure API Management) especially on `POST /api/timesheets`, `GET /api/m365/activity`.

**Impersonation Cookie Not HTTPOnly-Only:**
- Risk: The `impersonate_user_id` cookie is set with `httpOnly: true` and `secure: process.env.NODE_ENV === "production"` but is `sameSite: "strict"`. In development (`NODE_ENV !== "production"`), the cookie is not sent over HTTPS only.
- Files: `app/src/app/api/admin/impersonate/route.ts:127`
- Current mitigation: Impersonation is only available to ADMIN position users; cookie is verified server-side on every request
- Recommendations: Acceptable in development; verify `NODE_ENV=production` is always set in Azure deployment.

**`db:push` Script Remains Available:**
- Risk: `npm run db:push` runs `drizzle-kit push` which applies schema changes directly without generating a migration file, bypassing the migration audit trail
- Files: `app/package.json:14`
- Current mitigation: CLAUDE.md explicitly warns against using it; CI checks migration sync
- Recommendations: Remove the `db:push` script from `package.json` to prevent accidental use.

## Performance Bottlenecks

**Reports Page Loads All Time Entries for Period in Memory:**
- Problem: Both the server-side page (`reports/page.tsx`) and the API route (`/api/reports`) fetch all time entries for the date range into memory and aggregate in JavaScript using Maps
- Files: `app/src/app/(authenticated)/(admin)/reports/page.tsx:37-54`, `app/src/app/api/reports/route.ts:100-115`
- Cause: Client/employee aggregation is performed in application code rather than in SQL GROUP BY queries
- Current impact: Acceptable for a small firm (~10 employees, ~200 clients, a few years of data). Monthly reports might pull a few thousand rows.
- Improvement path: Move aggregation to SQL (SUM/GROUP BY) to reduce memory usage and improve response time as data grows.

**M365 Activity Makes 3 Sequential External API Calls Per Request:**
- Problem: `GET /api/m365/activity` makes three parallel `fetch()` calls (calendar, inbox, sent mail) to Microsoft Graph API; any failure causes a partial-failure scenario
- Files: `app/src/app/api/m365/activity/route.ts`
- Cause: Graph API doesn't support batching these into a single call without `$batch`
- Improvement path: Consider `POST https://graph.microsoft.com/v1.0/$batch` to combine into a single HTTP request and reduce latency.

**Billing List Page Calculates Totals for Every SD on Every Load:**
- Problem: `GET /api/billing` fetches all service descriptions with all topics and line items, then iterates through each to compute `totalAmount` using `calculateGrandTotal()` or `calculateRetainerGrandTotal()`
- Files: `app/src/app/api/billing/route.ts:66-102`
- Cause: Total is not stored — it is computed on-the-fly from raw line item data
- Improvement path: Cache computed total on the `service_descriptions` table as a denormalized `cachedTotal` column updated on write, or use a DB view.

## Fragile Areas

**`isWrittenOff` Flag Must Stay in Sync with `waiveMode` on Line Items:**
- Files: `app/src/lib/schema.ts` (`timeEntries.isWrittenOff`, `serviceDescriptionLineItems.waiveMode`), `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts:94-117`, `app/src/app/api/billing/[id]/route.ts:238-252`, `app/src/app/api/billing/[id]/topics/[topicId]/route.ts:183-194`
- Why fragile: `isWrittenOff` on `time_entries` is a denormalized summary of `waiveMode` across line items. Three separate code paths must correctly clear `isWrittenOff` when all waived references are removed (SD delete, topic delete, line item restore). If any one of these paths fails or a new deletion path is added without this cleanup, the flag becomes stale. A time entry would appear as written off to billers even though it has no active waive.
- Safe modification: Any new code path that deletes a service description, topic, or line item must include the `isWrittenOff` cleanup transaction.
- Test coverage: Partially covered in `app/src/app/api/billing/[id]/route.test.ts` and `app/src/app/api/billing/[id]/topics/[topicId]/route.test.ts`

**`displayOrder` Integer Can Drift Out of Sync:**
- Files: `app/src/app/api/billing/[id]/topics/reorder/route.ts`, `app/src/app/api/billing/[id]/line-items/reorder/route.ts`, `app/src/app/api/subtopics/reorder/route.ts`, `app/src/app/api/topics/reorder/route.ts`
- Why fragile: Reorder endpoints accept `{ id, displayOrder }` pairs from the client and update them. If the client sends a partial list or stale data due to a network race, order values can become inconsistent. Items are sorted by `displayOrder ASC` throughout the app.
- Safe modification: Reorder endpoints should validate the full set of IDs against the DB before updating to detect races.
- Test coverage: Tested via route tests but not for concurrent-update scenarios.

**DnD in ServiceDescriptionDetail Uses Prefixed String IDs for Entity Disambiguation:**
- Files: `app/src/components/billing/ServiceDescriptionDetail.tsx`
- Why fragile: Topics use `topic:`, `topic-drop:`, `topic-empty:` prefixes; items use `item:` — all within a single DndContext. Adding new droppable zone types requires updating the collision detection logic (`collisionDetection` callback) and all drag event handlers. Missing a prefix check causes items/topics to be dropped in the wrong context.
- Safe modification: Document all prefix types at the top of the file. Any new draggable/droppable type requires updates to `collisionDetection`, `handleDragStart`, `handleTopicReorder`, and `handleLineItemDragEnd`.
- Test coverage: Basic render-only tests in `ServiceDescriptionDetail.test.tsx` — drag behavior is not tested.

## Scaling Limits

**No Pagination on Any Data List:**
- Current capacity: Works fine at current scale (~10 users, ~200 clients, years of entries)
- Limit: The clients list (`GET /api/clients`), billing list (`GET /api/billing`), employees list, and topics list all return complete result sets with no pagination or cursor support
- Scaling path: Implement cursor-based pagination for the billing and clients lists first as these will grow fastest with usage.

**Reports Data Loaded at Page Level Without Caching:**
- Current capacity: A single month's report for 10 employees may be 500-2000 rows, processed in memory
- Limit: Yearly reports or large date ranges could return tens of thousands of rows causing memory pressure on the Node.js process
- Scaling path: Add database-side aggregation via SQL GROUP BY and consider a `?granularity=month|week|day` parameter to limit detail level.

## Dependencies at Risk

**`next-auth` v4 Is in Maintenance Mode:**
- Risk: `next-auth@^4.24.13` is the legacy v4 release; the project has been renamed Auth.js (v5) with a rewrite that has breaking API changes
- Impact: v4 will receive security patches only. Next.js 15+ (currently on 16.0.10) has shifting RSC patterns that create friction with v4's session handling (evidenced by the dual `getServerSession` + `getToken` fallback in `api-utils.ts`).
- Migration plan: Migrate to Auth.js v5 (`next-auth@5`) when stable — requires rewriting `authOptions`, callbacks, and session type augmentation in `src/types/next-auth.d.ts`.

**`@azure/msal-node` Dependency Listed but Not Used in Source:**
- Risk: `@azure/msal-node@^3.8.4` is in `package.json` dependencies but no import of it was found in any source file
- Files: `app/package.json:20`
- Impact: Unused dependency adds attack surface and bundle size (though Node-only packages don't affect the client bundle)
- Migration plan: Remove if truly unused. Verify it wasn't added in anticipation of a feature that uses `next-auth`'s AzureAD provider internally.

## Missing Critical Features

**No Error Monitoring in Production:**
- Problem: Production errors are only logged via `console.error()` which routes to Azure Web App's log stream. There is no structured error tracking, alerting, or aggregation.
- Blocks: Visibility into production failures, especially transient DB connection errors, token refresh failures, and PDF generation errors
- Recommendation: Integrate Sentry or Azure Application Insights for error capture and alerting.

**No Audit Log for Billing Actions:**
- Problem: Finalizing, unlocking, and deleting service descriptions are irreversible (or high-impact) actions with no audit trail beyond `finalizedById`/`finalizedAt` on the SD record itself. There is no log of who changed a line item, waived an entry, or deleted a topic.
- Blocks: Dispute resolution with clients, internal accountability for billing changes
- Recommendation: Add an `audit_log` table tracking `(userId, action, entityType, entityId, changedAt, previousValue, newValue)` for finalization, deletion, and waive events.

## Test Coverage Gaps

**Large Billing UI Components Not Tested:**
- What's not tested: `TopicSection`, `LineItemRow`, `AddTopicModal`, `AddLineItemModal`, `CreateServiceDescriptionModal`, `BillingContent`
- Files: `app/src/components/billing/TopicSection.tsx`, `app/src/components/billing/LineItemRow.tsx`, `app/src/components/billing/AddTopicModal.tsx`, `app/src/components/billing/AddLineItemModal.tsx`, `app/src/components/billing/BillingContent.tsx`, `app/src/components/billing/CreateServiceDescriptionModal.tsx`
- Risk: Waive mode toggle behavior, discount calculation display, and DnD UI interactions have no automated test coverage. Changes to these components are verified manually only.
- Priority: High — billing is the most financially sensitive part of the system.

**Client Management UI Untested:**
- What's not tested: `ClientsContent`, `ClientModal`
- Files: `app/src/components/clients/ClientsContent.tsx`, `app/src/components/clients/ClientModal.tsx`
- Risk: Client create/edit/delete UI flows, retainer field validation, and CSV export have no automated tests
- Priority: Medium

**Employee Management UI Untested:**
- What's not tested: `EmployeesContent`, `EmployeeModal`
- Files: `app/src/components/employees/EmployeesContent.tsx`, `app/src/components/employees/EmployeeModal.tsx`
- Risk: Employee deactivation, reactivation, and impersonation trigger flows (which use `alert()` for errors) have no test coverage
- Priority: Medium

**Reports Components Untested:**
- What's not tested: `ReportsContent`, `ByEmployeeTab`, `ByClientTab`, `OverviewTab`, `BarChart`, `DonutChart`, `DateRangePicker`, `ComparisonPicker`
- Files: `app/src/components/reports/`
- Risk: Chart rendering and date range selection logic are not tested
- Priority: Low (display-only components with low mutation risk)

**Topic Management UI Untested:**
- What's not tested: `TopicsContent`, `TopicModal`, `SubtopicModal`
- Files: `app/src/components/topics/TopicsContent.tsx`, `app/src/components/topics/TopicModal.tsx`, `app/src/components/topics/SubtopicModal.tsx`
- Risk: DnD reordering of topics and subtopics, status toggling, and modal form submissions are not tested
- Priority: Medium

---

*Concerns audit: 2026-02-24*
