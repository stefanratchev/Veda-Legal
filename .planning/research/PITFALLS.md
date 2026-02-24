# Pitfalls Research

**Domain:** Legal practice reporting dashboard enhancements (revenue views, drill-downs, topic breakdowns)
**Researched:** 2026-02-24
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Estimated vs Actual Revenue Numbers Will Diverge and Confuse Users

**What goes wrong:**
The overview will show two revenue figures per client: estimated (hours x hourlyRate) and actual (from finalized service descriptions). These numbers will almost never match due to discounts, caps, waivers, retainer logic, and FIXED-fee topics. Partners will see a client with 50h at 200 EUR/h showing 10,000 EUR estimated but 7,200 EUR actual (after a cap + discount), and assume something is broken.

**Why it happens:**
The billing system has at least six mechanisms that cause actual billed amounts to differ from naive rate-times-hours: topic-level caps (`capHours`), topic-level discounts (`discountType`/`discountValue`), SD-level discounts, waived line items (`EXCLUDED`/`ZERO`), retainer allowances (`retainerFee`/`retainerHours` with overage billing), and FIXED-fee topics. Each of these legitimately changes the billed amount. Developers often add dual metrics without explaining the gap.

**How to avoid:**
- Label estimated revenue as "Estimated (Rate x Hours)" and actual as "Billed (Finalized)" with clear visual distinction (e.g., different colors or a dashed vs solid line).
- Only show actual revenue for periods where finalized SDs exist. Show a "No finalized bills" indicator when actual is unavailable rather than 0 EUR (which implies zero billing rather than no data).
- Consider a tooltip or info icon explaining why the numbers differ on the revenue chart.
- Do NOT attempt to reconcile them in a single combined figure.

**Warning signs:**
- User asks "why doesn't the revenue match?" within the first week.
- Actual revenue shows as 0 EUR for recent months (SDs not yet finalized).
- Clients with retainers show wildly different estimated vs actual.

**Phase to address:**
Revenue charts phase. The UI labeling and empty-state handling must be defined before implementation.

---

### Pitfall 2: Application-Side Aggregation Will Not Scale When Adding Topic Breakdowns and Full Entry Tables

**What goes wrong:**
The current reports API (`/api/reports`) fetches all raw time entries into Node.js memory and aggregates using JavaScript Maps (lines 117-189 in `route.ts`, duplicated in `page.tsx` lines 57-181). Adding topic breakdowns and removing the 10-entry limit means this pattern must now handle: (a) a new aggregation dimension (topic), (b) all entries for the period instead of slicing to 10, and (c) potentially SD data for actual revenue. The response payload grows significantly and the in-memory aggregation becomes a three-dimensional cross-product (employee x client x topic).

**Why it happens:**
The original implementation was reasonable for a simple hours-only report with ~10 employees and monthly periods (~500-2000 entries). But each new breakdown dimension multiplies the Maps and the response payload. The all-entries table removes the natural limit. Developers tend to bolt on new aggregations to the existing pattern rather than rethinking the data flow.

**How to avoid:**
- Move aggregation to SQL with `GROUP BY` for the new topic dimension. PostgreSQL handles multi-dimensional aggregation (SUM, GROUP BY client, employee, topic) far more efficiently than JavaScript Maps, especially with the existing indexes on `time_entries.topicId`, `clientId`, `userId`, and `date`.
- Keep raw entries as a separate concern from aggregated summaries. The drill-down entry table should be a filtered query, not a full dump embedded in the main response.
- Consider splitting the API: `/api/reports/summary` for aggregated stats, `/api/reports/entries?clientId=X` for drill-down entries. This avoids sending all entries on every tab switch.

**Warning signs:**
- Response payload exceeds 500KB for a monthly report.
- The API handler grows past 300 lines with nested Map operations.
- Client-side `transformedEntries` computed on every render even when the entries tab is not visible.
- Code duplication between server-side `page.tsx` and API `route.ts` aggregation logic (already exists, lines 14-249 in `page.tsx` mirror `route.ts`).

**Phase to address:**
API refactoring phase, before adding topic breakdowns. The SQL migration should happen first so topic breakdowns are built on the right foundation.

---

### Pitfall 3: Querying Finalized SD Totals for Revenue Charts Will Be Expensive Without Denormalization

**What goes wrong:**
To show "actual billed revenue by client" in the overview, the API needs to: (1) find all FINALIZED service descriptions overlapping the date range, (2) load all their topics and line items, (3) run `calculateGrandTotal()` or `calculateRetainerGrandTotal()` for each SD. This mirrors the existing N+1 problem already documented in CONCERNS.md for the billing list page (`GET /api/billing` lines 66-102). For a quarterly report covering 50+ clients with finalized SDs, this could mean loading hundreds of topics and thousands of line items just to compute a set of totals.

**Why it happens:**
The billing system deliberately computes totals on-the-fly from raw line item data (no `cachedTotal` column on `service_descriptions`). This design ensures totals are always correct after edits, but it means every consumer of total data must load the full nested structure. The CONCERNS.md already identifies this as a performance bottleneck for the billing list.

**How to avoid:**
- Add a `cachedTotal` column to `service_descriptions` (or a separate `sd_totals` materialized view). Update it when a SD is finalized. Since finalized SDs are immutable (status cannot revert to DRAFT without admin unlock), the cached value will not drift.
- For the reports API, query only `SELECT client_id, SUM(cached_total) FROM service_descriptions WHERE status = 'FINALIZED' AND period_start >= ? AND period_end <= ? GROUP BY client_id`. This is a single indexed query instead of loading nested structures.
- If denormalization is deferred, at minimum use the billing list API's existing pattern (load only `{ hours, waiveMode }` from line items, not full descriptions) to minimize data transfer.

**Warning signs:**
- Reports API response time exceeds 2 seconds when date range spans 3+ months.
- The reports API imports billing calculation functions from `billing-pdf.tsx`.
- Memory spikes on the server during report generation.

**Phase to address:**
Schema/migration phase before revenue chart implementation. Adding the `cachedTotal` column and backfilling for existing finalized SDs should be a prerequisite.

---

### Pitfall 4: SD Period Overlap Creates Ambiguous Revenue Attribution

**What goes wrong:**
Service descriptions have `periodStart` and `periodEnd` fields that define the billing period. When the user selects "February 2026" in the reports date picker, the query must decide: include SDs where `periodStart` falls in February? Where `periodEnd` falls in February? Where the period overlaps February at all? A SD covering Jan 15 - Feb 15 could be counted in January, February, or both. This ambiguity does not exist for estimated revenue (each time entry has a single date).

**Why it happens:**
Billing periods are client-specific and do not always align with calendar months. The current schema has no constraint preventing overlapping periods for the same client. The reports date picker was designed for time entries (single-date entities), not for range-based billing documents.

**How to avoid:**
- Use `periodEnd` as the attribution date (the bill "lands" at the end of the period). This is the accounting convention and avoids double-counting: a SD with period Jan 15 - Feb 15 is attributed to February.
- Document this rule clearly in the API response and consider adding it as a tooltip in the UI.
- Add a DB constraint or application-level validation preventing overlapping SD periods for the same client (if not already present).
- For SDs spanning multiple months (e.g., quarterly), attribute the full amount to the `periodEnd` month rather than splitting proportionally, which adds unjustified complexity.

**Warning signs:**
- Revenue for a client appears in two adjacent months.
- Users report "missing" revenue that was actually attributed to a different month.
- Quarterly reports show different revenue totals than summing three monthly reports.

**Phase to address:**
Revenue query design phase. The attribution rule must be decided before writing the SQL query.

---

### Pitfall 5: Removing the 10-Entry Limit Without Virtualization Will Degrade Drill-Down Performance

**What goes wrong:**
The current drill-down tables slice to `recentEntries.slice(0, 10)` (ByEmployeeTab line 129, ByClientTab line 139). The requirement says "ALL entries for selected date range." A busy employee with 20 entries/day over a full month means ~400+ table rows. A year-long date range could mean 5000+ rows per employee. Rendering thousands of `<tr>` elements in a plain HTML table causes visible lag, especially with the current per-cell styling (4 Tailwind classes per `<td>`).

**Why it happens:**
At 10 entries, DOM performance is irrelevant. Developers remove the `.slice(0, 10)` and assume it scales. It does not. React re-renders the entire table on any state change in the parent `ReportsContent` component (tab switch, date change, comparison change).

**How to avoid:**
- For the expected data volume (~10 employees, ~200 clients, months of data), pagination with 50-100 entries per page is sufficient and simpler than virtualization. Add a page size selector and page navigation.
- Virtualization (react-window, TanStack Virtual) is overkill at this scale but becomes necessary if the table ever shows year-long data for all employees. Defer virtualization unless year-range reports are explicitly required.
- Regardless of approach, the entry table should be a separate component with `React.memo()` to prevent re-renders when the parent state changes.

**Warning signs:**
- Drill-down tab takes >500ms to render after selecting an employee/client.
- Browser DevTools shows >1000 DOM nodes in the entry table.
- Scrolling the entry table is janky (frame drops below 30fps).

**Phase to address:**
Entry table implementation phase. The pagination approach should be decided before implementing "show all entries."

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping JS-side aggregation for topic breakdowns | No SQL query changes needed | Response payload grows with each dimension; duplicated logic between `page.tsx` and `route.ts` | Never for new dimensions -- use SQL GROUP BY from the start |
| Computing SD totals on-the-fly for revenue charts | No schema migration needed | O(topics x lineItems) per SD per request; already flagged as a bottleneck in CONCERNS.md | Acceptable as MVP if <10 SDs per report period; must add `cachedTotal` before quarterly reports |
| Embedding all entries in the main reports response | Single API call, simple state management | Payload bloat; entries loaded even when user stays on Overview tab | Acceptable for monthly reports with <500 entries; switch to lazy-loaded drill-down API for larger ranges |
| Duplicating `formatCurrency` in ByClientTab vs billing-pdf.tsx | Avoids import dependency | Inconsistent formatting if one is updated without the other (already diverged: ByClientTab uses `maximumFractionDigits: 0`, billing-pdf uses 2 decimal places) | Never -- extract to shared utility in `lib/date-utils.ts` or a new `lib/format-utils.ts` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full entry dump in reports API response | Response > 500KB, slow network on mobile | Split entries into lazy-loaded drill-down endpoint | >2000 entries per report period (quarterly for busy firm) |
| On-the-fly SD total calculation in reports | API response > 2s for multi-month ranges | Add `cachedTotal` column on `service_descriptions` | >20 finalized SDs in a single report period |
| Recharts re-render on parent state change | Charts flicker on tab switch or comparison change | Wrap chart components in `React.memo()`, stabilize data references with `useMemo` | Noticeable with >20 data points in bar charts (all employees across clients) |
| Sending topic breakdown data to non-drill-down views | Wasted bandwidth; topic Maps built but unused on Overview tab | Compute topic breakdown only when drill-down is active (conditional aggregation or separate endpoint) | Always -- topic data is per-client/employee, not overview-level |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing actual billed revenue to non-admin users | Revenue data from finalized SDs contains sensitive pricing, discounts, and retainer terms | Gate actual revenue behind the same `isAdmin` check used for estimated revenue (already in `route.ts:62`); ensure the new SD-based revenue query also respects this check |
| Returning SD details in the reports API response | SD IDs or line item data in the response could be used to probe the billing API | Return only aggregated `actualRevenue: number` per client, never raw SD data, in the reports endpoint |
| Missing rate limiting on expanded reports API | Quarterly reports with all entries create heavier server load; repeated requests could cause memory pressure | Apply same rate limiting strategy as other endpoints; consider caching report results for identical date ranges |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing actual revenue as 0 EUR when no SDs are finalized | Partners assume no billing happened, when in reality SDs are still in DRAFT | Show "No finalized bills" or "--" instead of 0 EUR; only show actual revenue when at least one finalized SD exists for the period |
| Topic breakdown with 20+ topics creates unreadable charts | Legal firms may have 15-25 active topics; a bar chart with 25 bars is noise | Group topics below a threshold into "Other" (like DonutChart already does with `maxSlices`); show top 8-10 topics |
| Hours over time chart with daily granularity for multi-month ranges | 90+ data points on a bar chart is unreadable | Switch to weekly or monthly granularity when date range exceeds 45 days; label the axis appropriately |
| All-entries table with no sorting or filtering | Users cannot find specific entries in a 200-row table | Add client-side sort on date, hours, employee, topic; add a search/filter input for descriptions |

## "Looks Done But Isn't" Checklist

- [ ] **Revenue charts:** Verify actual revenue handles retainer clients separately -- `calculateRetainerGrandTotal` uses different logic than `calculateGrandTotal` and must be called when `retainerFee != null && retainerHours != null`
- [ ] **Revenue comparison:** Confirm comparison period (Previous Period / Previous Year) queries SDs with matching `periodEnd` attribution -- comparison revenue must use the same attribution rule as the primary period
- [ ] **Topic breakdown:** Verify entries with `topicId = null` (possible for old entries or if topic was deleted) appear as "Uncategorized" rather than crashing the aggregation
- [ ] **Topic breakdown:** Confirm `topicName` from `time_entries` is used (denormalized, immutable) rather than joining to `topics.name` -- the topics table name could have been renamed since the entry was logged
- [ ] **Entry tables:** Verify topic column shows `topicName` from time entries, not from the topics table -- these can diverge
- [ ] **Entry tables:** Confirm entries include INTERNAL and MANAGEMENT client entries, not just REGULAR -- admins track all client types
- [ ] **INTERNAL/MANAGEMENT clients:** Verify these clients have `hourlyRate = null` and are excluded from estimated revenue (not counted as 0 EUR revenue)
- [ ] **Access control:** Non-admin users must not see revenue data in any of the new views -- verify the `isAdmin` gate covers revenue-by-client, revenue-by-employee, and comparison revenue
- [ ] **Date range:** Quarterly and yearly presets (if added) must work with both estimated and actual revenue without timeout

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| JS-side aggregation scaled beyond capacity | MEDIUM | Migrate to SQL GROUP BY queries; requires rewriting the reports API handler but no schema changes; test with production data volumes |
| SD totals computed on-the-fly causing timeouts | MEDIUM | Add `cachedTotal` column via migration; backfill from existing data; add trigger or application hook on finalization |
| Revenue attribution rule not documented, users confused | LOW | Add tooltip/info icon to revenue charts; update the date range label to show attribution rule; no code change to calculation |
| Entry table renders 5000+ rows without pagination | LOW | Add `.slice(offset, offset + pageSize)` with pagination controls; 30-minute fix; no API changes needed if all entries are already returned |
| Topic breakdown crashes on null topicId | LOW | Add null coalescing in aggregation: `entry.topicName || "Uncategorized"`; single-line fix per aggregation point |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Estimated vs actual revenue confusion | Revenue chart UI design | User testing: ask a partner what each number means before shipping |
| JS-side aggregation scaling | API refactoring (before new features) | Response payload size stays under 100KB for monthly reports; API response time under 500ms |
| SD total query expense | Schema migration (before revenue charts) | `cachedTotal` column exists and is populated on finalization; reports API does not import `billing-pdf.tsx` |
| SD period attribution ambiguity | Revenue query design | Quarterly revenue equals sum of three monthly revenues for same clients |
| Entry table without pagination | Entry table implementation | Drill-down with 500+ entries renders in under 200ms; pagination controls visible |
| `formatCurrency` duplication | Shared utility extraction (prep phase) | Single `formatCurrency` import used by all components; grep finds no local definitions |

## Sources

- Codebase analysis: `/Users/stefan/projects/veda-legal-timesheets/app/src/app/api/reports/route.ts` (current aggregation pattern)
- Codebase analysis: `/Users/stefan/projects/veda-legal-timesheets/app/src/app/(authenticated)/(admin)/reports/page.tsx` (duplicated server-side aggregation)
- Codebase analysis: `/Users/stefan/projects/veda-legal-timesheets/app/src/lib/billing-pdf.tsx` (billing calculation functions)
- Codebase analysis: `/Users/stefan/projects/veda-legal-timesheets/app/src/components/reports/ByClientTab.tsx` (10-entry limit, `formatCurrency` duplication)
- Codebase analysis: `/Users/stefan/projects/veda-legal-timesheets/.planning/codebase/CONCERNS.md` (existing performance bottlenecks)
- [Recharts Performance Guide](https://recharts.github.io/en-US/guide/performance/) -- optimization strategies for large datasets
- [PostgreSQL GROUP BY Performance](https://www.cybertec-postgresql.com/en/speeding-up-group-by-in-postgresql/) -- hash vs sort aggregation
- [PostgreSQL Aggregation Best Practices](https://www.tigerdata.com/learn/postgresql-aggregation-best-practices/) -- indexing and GROUP BY optimization
- [Optimizing React Table Rendering](https://dev.to/navneet7716/optimizing-react-table-rendering-by-160x--5g3c) -- virtualization and pagination strategies
- [Crunchy Data: Revenue Aggregation in PostgreSQL](https://www.crunchydata.com/blog/fun-with-sql-in-postgres-finding-revenue-accrued-per-day) -- SQL patterns for revenue reporting

---
*Pitfalls research for: legal practice reporting dashboard enhancements*
*Researched: 2026-02-24*
