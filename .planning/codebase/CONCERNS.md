# Codebase Concerns

**Analysis Date:** 2026-02-24

## Tech Debt

**Optimistic UI Updates Without Rollback State**
- Issue: Multiple components use optimistic updates (immediately update UI, then fetch). If the API fails, the revert handler (`revertWithError`) reads from `dataRef.current` to restore state, but this only works if `dataRef` was updated before the handler was called.
- Files: `app/src/components/billing/ServiceDescriptionDetail.tsx` (line 227-229, 274-276)
- Impact: If the network request fails or takes too long, users see inconsistent state. The drag-and-drop reorder operations could leave the UI and database out of sync if the PATCH fails.
- Fix approach: Implement proper rollback by storing pre-operation state separately, or refetch the full state from the server on error.

**Line Item Deletion Missing Cleanup**
- Issue: When deleting a line item that references a waived time entry, the `DELETE` handler at `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts` (line 192) doesn't check if the time entry's `isWrittenOff` flag should be cleared. The `PATCH` handler includes this logic (lines 95-117), but `DELETE` omits it entirely.
- Files: `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts` (line 192)
- Impact: Time entries marked as written off may remain flagged even after all waived references are deleted, leaving orphaned `isWrittenOff = true` records.
- Fix approach: Add a transaction to the DELETE handler that checks if any remaining waived line items reference this time entry, and clear the flag if none exist.

**Floating Point Precision in Billing Calculations**
- Issue: Billing calculations use `Math.round(x * 100) / 100` for rounding, but JavaScript floating-point arithmetic can still introduce precision errors. For example, `0.1 + 0.2 !== 0.3` in JavaScript.
- Files: `app/src/lib/billing-pdf.tsx` (lines 250, 453, 456, 460-464)
- Impact: With large datasets or specific decimal combinations, cumulative rounding errors could result in invoice totals being off by a cent or more.
- Fix approach: Consider using a decimal library (e.g., `decimal.js`, `big.js`) or implement explicit integer-based calculations (e.g., store everything in cents).

**Complex Drag-and-Drop State Management**
- Issue: `ServiceDescriptionDetail.tsx` maintains multiple overlapping pieces of drag state: `activeDragType`, `activeTopicId`, `activeItemId`, plus collision detection filters and a `dataRef` to read latest state. The logic to distinguish between topic and line item drags is fragile (lines 73-88).
- Files: `app/src/components/billing/ServiceDescriptionDetail.tsx` (lines 57-88, 90-102)
- Impact: Edge cases in drag operations (e.g., rapid clicks, network delays) could trigger unintended reorders or corruption of the topic/item hierarchy.
- Fix approach: Extract drag logic to a custom hook with explicit state machine; add integration tests for cross-topic moves and rapid sequential operations.

## Known Bugs

**Line Item Deletion Loss of `isWrittenOff` State**
- Symptoms: After deleting a waived line item, the associated time entry remains marked as `isWrittenOff = true` in the database, even though no waived references exist.
- Files: `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts` (line 192)
- Trigger: Create a service description, add a line item linked to a time entry, set waive mode to EXCLUDED or ZERO, then delete the line item.
- Workaround: Manually update the database to set `isWrittenOff = false` for orphaned entries, or re-export/re-import the line item.

## Security Considerations

**Admin Impersonation Lacks Audit Trail**
- Risk: The impersonation system (`app/src/lib/api-utils.ts` lines 88-110) allows ADMIN users to impersonate any non-INACTIVE user without logging the action. An admin could silently log time entries, approve billing, or modify data as another user.
- Files: `app/src/lib/api-utils.ts` (lines 88-110), `app/src/app/api/admin/impersonate/route.ts`
- Current mitigation: ADMIN users must be trusted; impersonation cookie is httpOnly and session-based.
- Recommendations: Add audit logging for all impersonation actions (start/end impersonation, what actions taken while impersonating). Consider requiring explicit impersonation confirmation or time-limited sessions.

**SQL Injection Risk in Dynamic Queries**
- Risk: While Drizzle ORM provides parameterization, raw `sql.join()` expressions (used in `app/src/app/api/timesheets/route.ts` lines 66-68) bypass some safety checks if user input is not carefully validated.
- Files: `app/src/app/api/timesheets/route.ts` (lines 66-68, 181-182), `app/src/app/api/billing/unbilled-summary/route.ts` (line 79)
- Current mitigation: The `entryIds` array is sourced from the database itself (not user input), so direct injection is not possible. However, the pattern is fragile.
- Recommendations: Add explicit type-checking and validation before using raw SQL expressions. Document why raw SQL is necessary instead of using Drizzle's `in()` operator.

**No CSRF Protection on State-Changing API Routes**
- Risk: API routes use `NextAuth` session validation but don't explicitly check CSRF tokens. If a cross-origin request is made, the browser's same-site cookie policy should block it, but this is not always reliable.
- Files: All POST/PATCH/DELETE routes in `app/src/app/api`
- Current mitigation: NextAuth middleware enforces same-origin checks; Next.js has built-in CORS protection.
- Recommendations: Explicitly verify the `origin` header or add explicit CSRF token validation to sensitive endpoints (billing, client management).

## Performance Bottlenecks

**Inefficient Time Entry Lock Lookup**
- Problem: Every GET request to `/api/timesheets?date=...` calls `getLockedEntryIds()`, which performs a multi-join query across `serviceDescriptionLineItems`, `serviceDescriptionTopics`, and `serviceDescriptions` for each date. For users with many entries, this becomes O(n) queries.
- Files: `app/src/app/api/timesheets/route.ts` (lines 50-75, 137-138)
- Cause: No caching or batching; the query re-executes for every request.
- Improvement path: Cache the locked set for 5-10 minutes per user, or add a database index on `(timeEntryId, status)` to speed up the join. Consider moving this to a separate query that's only run once per session.

**Missing Database Indexes on Foreign Key Traversals**
- Problem: The database schema has indexes on most foreign keys, but some traversals could be slow:
  - `timeEntries` has an index on `userId`, but queries joining with `clients` and `topics` simultaneously may still be slow.
  - `serviceDescriptionLineItems` join to `serviceDescriptionTopics` and then `serviceDescriptions` is not indexed directly.
- Files: `app/src/lib/schema.ts`
- Cause: Drizzle auto-generates basic indexes but not composite indexes for common join patterns.
- Improvement path: Add composite indexes: `CREATE INDEX idx_service_desc_line_items_topic_desc ON service_description_line_items(topic_id, service_description_id)`.

**PDF Generation with Large Datasets**
- Problem: `ServiceDescriptionPDF` renders all topics and line items in memory using React PDF. For invoices with 100+ line items, this causes memory spikes and slow rendering.
- Files: `app/src/lib/billing-pdf.tsx` (full file)
- Cause: `@react-pdf/renderer` is synchronous and renders the entire document tree before streaming.
- Improvement path: Implement server-side PDF streaming or paginate invoices if they exceed a threshold. Consider using a native PDF library like `pdfkit` for large documents.

**Large Test Files Slow Down Development Feedback**
- Problem: Test files like `clients/route.test.ts` (1521 lines), `employees/route.test.ts` (1249 lines), and `timesheets/route.test.ts` (1077 lines) take several seconds to run, slowing development iteration.
- Files: `app/src/app/api/clients/route.test.ts`, `app/src/app/api/employees/route.test.ts`, `app/src/app/api/timesheets/route.test.ts`
- Cause: Tests are monolithic; many test cases are bundled into a single file.
- Improvement path: Split large test files into focused suites (e.g., `route.create.test.ts`, `route.update.test.ts`, `route.delete.test.ts`). Run only affected tests during development with `vitest --watch --reporter=verbose`.

## Fragile Areas

**M365 Activity Sync Timezone Handling**
- Files: `app/src/app/api/m365/activity/route.ts` (lines 98-109)
- Why fragile: The timezone offset calculation uses `getTimezoneOffsetHours()` which relies on `Intl.DateTimeFormat` parsing. If the formatter output format changes or the timezone name is not recognized, it falls back to UTC+2, which is incorrect during summer (EEST = UTC+3).
- Safe modification: Always test with both winter and summer dates (e.g., 2026-01-15 and 2026-06-15). Add unit tests that mock `Intl.DateTimeFormat` to ensure the fallback is tested.
- Test coverage: `app/src/app/api/m365/activity/route.test.ts` has good coverage, but doesn't explicitly test DST transition dates.

**Retainer Billing Mode Detection**
- Files: `app/src/lib/billing-pdf.tsx` (line 501), `app/src/components/billing/ServiceDescriptionDetail.tsx` (line 295)
- Why fragile: Mode is determined by checking `retainerFee != null && retainerHours != null`. If either field is 0, the check still passes, which could lead to unexpected behavior (e.g., zero retainer with overage rate).
- Safe modification: Add explicit validation in the schema or API to prevent zero retainer fees. Document the retainer mode requirements clearly.
- Test coverage: `app/src/lib/billing-pdf.test.ts` has retainer tests, but doesn't cover the zero-fee edge case.

**Topic Type Validation Across Hierarchy**
- Files: `app/src/app/api/timesheets/route.ts` (POST handler), `app/src/app/api/billing/[id]/topics/route.ts` (topic creation)
- Why fragile: Topic type (REGULAR, INTERNAL, MANAGEMENT) must match the client type, but this validation is scattered across multiple API routes and not enforced by the schema.
- Safe modification: Add a database constraint or centralize validation in `lib/api-utils.ts`. Add tests for each topic type + client type combination.
- Test coverage: Tests cover common cases but not all cross-type mismatches.

**Waive Mode State Consistency**
- Files: `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts`, `app/src/lib/schema.ts`
- Why fragile: `waiveMode` can be EXCLUDED, ZERO, or null, and the `isWrittenOff` flag on `timeEntries` is supposed to mirror this. However, there's no database constraint ensuring the relationship is maintained.
- Safe modification: When updating or deleting line items with waive modes, always verify the cleanup logic (similar to lines 95-117 in the PATCH handler). Add a migration to repair any orphaned `isWrittenOff` flags.
- Test coverage: The cleanup logic has tests, but bulk operations (e.g., deleting a service description) should be tested more thoroughly.

## Scaling Limits

**Time Entry Queries Become Slow at Scale**
- Current capacity: Fine for ~10,000 time entries per user; performance degrades with 50,000+.
- Limit: GET `/api/timesheets?date=...` and `/api/timesheets/team/[userId]` perform full scans without pagination.
- Scaling path: Add cursor-based pagination, partition time entries by user + date, and implement caching. For the team view, consider aggregating data at night and storing summaries.

**Service Description List View Inefficient**
- Current capacity: Listing 100 service descriptions is fast; 1000+ becomes slow due to JOIN operations and total calculations.
- Limit: `/api/billing` fetches all topics, line items, and clients for every service description to compute `totalAmount`.
- Scaling path: Cache totals in a `totalAmount` denormalized column on `serviceDescriptions`, update on finalization. Use database views to aggregate instead of client-side calculations.

**Reports Page Aggregation Unoptimized**
- Current capacity: Monthly reports for one user are instant; firm-wide reports across 200+ clients and 6+ months become slow.
- Limit: `/api/reports` does client-side aggregation in JavaScript after fetching all matching time entries.
- Scaling path: Move aggregation to the database using `GROUP BY` and `SUM()`. Add a nightly job to pre-compute monthly summaries.

## Dependencies at Risk

**@react-pdf/renderer Maintenance Risk**
- Risk: The package is stable but has limited active maintenance. Recent versions (4.x) have had issues with font loading and large documents.
- Impact: PDF generation could fail silently or produce corrupted files in edge cases.
- Migration plan: Monitor the package. If issues arise, consider switching to `pdfkit` or server-side PDF generation (e.g., `puppeteer` + headless Chrome).

**Drizzle ORM Type Safety Gap**
- Risk: Drizzle is newer than TypeORM/Sequelize and has fewer community resources. Type inference can be complex, and migration safety depends on developer care.
- Impact: Incorrect schema changes or type mismatches could go unnoticed until runtime.
- Migration plan: Enforce strict TypeScript settings (`strict: true` in `tsconfig.json`). Use the Drizzle CLI to validate migrations before applying. Consider adding pre-migration tests.

**Next.js 16 Early Adoption**
- Risk: Next.js 16 (released 2026) is relatively new. App Router (used here) is stable but features are still evolving.
- Impact: Upgrades to 16.x minor versions could introduce breaking changes in APIs or performance characteristics.
- Migration plan: Pin the Next.js version in `package.json` to a specific minor (e.g., `16.0.10`). Before upgrading, test thoroughly in a staging environment.

## Missing Critical Features

**No Audit Logging for Sensitive Changes**
- Problem: There is no audit trail for who changed what and when. Admins can modify billing, delete clients, or change topics without recording the action.
- Blocks: Compliance requirements, dispute resolution, forensic analysis.
- Recommendation: Add an `auditLog` table with user, action, timestamp, and diff. Log all state changes to sensitive entities (billing, clients, employees).

**No Soft Deletes for Data Retention**
- Problem: Deleting records uses hard deletes, which can violate data retention policies and break referential integrity if soft-deleted data is still referenced.
- Blocks: GDPR compliance, legal hold requests, audit trails.
- Recommendation: Add `deletedAt` timestamps to key tables and soft-delete by setting this field instead of removing records.

**No Notification System**
- Problem: Users are not notified when timesheets are overdue, billing is finalized, or other events occur.
- Blocks: Proactive user engagement, deadline reminders.
- Recommendation: Add an email/Slack notification service triggered by key events (timesheet overdue, SD finalized, client added).

## Test Coverage Gaps

**Missing Concurrent Operation Tests**
- What's not tested: Multiple users trying to edit the same service description simultaneously, or multiple reorder operations happening in quick succession.
- Files: `app/src/app/api/billing/[id]/line-items/reorder/route.test.ts`, `app/src/components/billing/ServiceDescriptionDetail.tsx`
- Risk: Race conditions could corrupt the `displayOrder` field or cause items to be lost.
- Priority: High

**Incomplete Waive Mode Coverage**
- What's not tested: Deleting a line item with `waiveMode = EXCLUDED` or `ZERO` and verifying that `isWrittenOff` is properly cleared.
- Files: `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.test.ts`
- Risk: Orphaned `isWrittenOff` flags as described in the Known Bugs section.
- Priority: High

**Missing Timezone Edge Case Tests**
- What's not tested: Daylight saving time transitions (e.g., submission deadline on DST changeover date), leap years, December 31 → January 1 boundary.
- Files: `app/src/lib/submission-utils.test.ts`
- Risk: Incorrect overdue calculations on transition dates.
- Priority: Medium

**No Integration Tests for M365 Sync + Timesheet Creation**
- What's not tested: End-to-end flow of fetching M365 events and automatically creating time entries.
- Files: `app/src/app/api/m365/activity/route.test.ts`, `app/src/app/api/timesheets/route.test.ts`
- Risk: UI and API may be out of sync with actual M365 data.
- Priority: Medium

**Missing Error Recovery Tests**
- What's not tested: Partial failures during bulk operations (e.g., reordering 10 items, half succeed, half fail). What happens to the UI state?
- Files: `app/src/components/billing/ServiceDescriptionDetail.tsx` (drag-and-drop tests)
- Risk: Inconsistent UI/database state.
- Priority: Medium

---

*Concerns audit: 2026-02-24*
