# Architecture Research

**Domain:** Legal practice reporting dashboards (Next.js + Drizzle + Recharts)
**Researched:** 2026-02-24
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UI Layer (Client)                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │OverviewTab │  │ByEmployee  │  │ByClientTab │  │ DateRange/  │  │
│  │ +Revenue   │  │   Tab      │  │ +Topic     │  │ Comparison  │  │
│  │  Charts    │  │ +Topic/    │  │  Breakdown │  │  Pickers    │  │
│  │            │  │  Trend     │  │ +Trend     │  │             │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └──────┬──────┘  │
│        │               │               │                │         │
│  ┌─────┴───────────────┴───────────────┴────────────────┴──────┐  │
│  │                   ReportsContent.tsx                         │  │
│  │        (state: tab, dateRange, drilldown, data)             │  │
│  └──────────────────────────┬──────────────────────────────────┘  │
├─────────────────────────────┼─────────────────────────────────────┤
│                   Fetch / Data Layer                               │
│  ┌──────────────────────────┴──────────────────────────────────┐  │
│  │               API Routes (Server)                            │  │
│  │  ┌─────────────────┐   ┌──────────────────────────────┐     │  │
│  │  │ GET /api/reports │   │ GET /api/reports/revenue      │     │  │
│  │  │ (hours, entries  │   │ (SD-based actual revenue per  │     │  │
│  │  │  byEmployee,     │   │  client for date range)       │     │  │
│  │  │  byClient)       │   │                               │     │  │
│  │  └────────┬─────────┘   └──────────────┬────────────────┘     │  │
│  └───────────┼────────────────────────────┼────────────────────┘  │
├──────────────┼────────────────────────────┼────────────────────────┤
│              │        Database Layer       │                        │
│  ┌───────────┴──────────┐  ┌──────────────┴──────────────────┐    │
│  │     time_entries      │  │    service_descriptions          │    │
│  │  + user + client      │  │  + topics + line_items           │    │
│  │  + topicName          │  │  (status = FINALIZED only)       │    │
│  └───────────────────────┘  └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `ReportsContent` | Owns all report state (date range, tab, drill-down selection, loaded data). Fetches data on date/comparison changes. Passes sliced data to tabs. | API routes via `fetch()`, all tab components via props |
| `OverviewTab` | Summary cards (hours, revenue, clients) + overview charts. Receives pre-aggregated data, renders charts and comparisons. | `ReportsContent` (receives data as props), chart components |
| `ByEmployeeTab` | Employee list view + drill-down (hours by client, hours by day, topic breakdown, full entry table). | `ReportsContent` (receives data as props), chart components |
| `ByClientTab` | Client list view + drill-down (hours by employee, topic breakdown, time trend, full entry table). | `ReportsContent` (receives data as props), chart components |
| `BarChart` / `DonutChart` | Generic Recharts wrappers. Accept `{name, value, id}[]` data. Support click handlers for drill-down navigation. | Parent tab components (data + click handlers via props) |
| `SummaryCard` | Single metric display with optional comparison indicator (% change or absolute delta). | `OverviewTab` (data via props) |
| `GET /api/reports` | Fetches time entries for date range, aggregates by employee and client, includes topic data on entries. Returns hours-based metrics. | Drizzle ORM -> PostgreSQL (`time_entries`, `users`, `clients`) |
| `GET /api/reports/revenue` (NEW) | Fetches finalized service descriptions overlapping date range, computes actual billed totals per client using canonical billing functions. | Drizzle ORM -> PostgreSQL (`service_descriptions`, `service_description_topics`, `service_description_line_items`) |
| `reports/page.tsx` | Server Component entry point. Fetches initial data for current + comparison periods, passes to `ReportsContent`. | Drizzle ORM directly (server-side), `ReportsContent` (props) |

## Recommended Architecture Changes

### 1. Split the API: Keep `/api/reports`, Add `/api/reports/revenue`

**Current state:** One endpoint (`GET /api/reports`) returns everything. It queries `time_entries` with `user` and `client` relations, then aggregates in JavaScript.

**Recommendation:** Add a separate `GET /api/reports/revenue` endpoint for actual billed revenue from finalized service descriptions. Do NOT merge it into the existing endpoint.

**Rationale:**
- The existing endpoint queries `time_entries`. Revenue from finalized SDs requires querying an entirely different table hierarchy (`service_descriptions` -> `topics` -> `line_items`) with different joins.
- Estimated revenue (rate x hours) can stay in the existing endpoint since it derives from the same time entries data already fetched.
- Actual revenue is admin-only; keeping it separate avoids adding conditional complexity to the core reports query.
- The two queries have different caching characteristics: time entries change frequently, finalized SDs are immutable once finalized.
- Both endpoints are small enough that two parallel fetches from the client add negligible overhead.

**Endpoint signatures:**

```
GET /api/reports?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  -> { summary, byEmployee, byClient, entries }  (unchanged shape, but entries gain topicName)

GET /api/reports/revenue?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  -> { byClient: [{ clientId, clientName, actualRevenue }], totalActualRevenue }
```

### 2. Add Topic Data to the Existing Reports Endpoint

**Current state:** The `time_entries` table already has `topicName` (denormalized text field) and `topicId` (FK). Neither is included in the reports query or response.

**What to change:**
- Add `topicName` and `topicId` to the time entries query columns.
- Add `topicName` to each entry in the response.
- Add topic aggregation maps alongside the existing employee/client maps during the single-pass aggregation loop.
- Return `byTopic` arrays nested within `byEmployee[].topics` and `byClient[].topics`.

**Why this is cheap:** The data is already on the `time_entries` row as a denormalized `topicName` text column. No additional joins or queries needed. The aggregation is a Map accumulation inside the existing loop that already iterates all entries.

### 3. Expand Entry Tables to Show All Entries

**Current state:** Drill-downs show `slice(0, 10)` of entries. The full entries array is already loaded client-side (passed from `ReportsContent`).

**What to change:** Remove the `.slice(0, 10)` in `ByEmployeeTab` and `ByClientTab`. The full `entries` array for the period is already available. Add a `topicName` column to the entry tables.

**Performance note:** For ~10 employees and ~200 clients over a monthly period, the total entry count is roughly 10 employees x 22 workdays x 3-5 entries/day = 660-1100 entries. This is well within browser rendering limits for a simple table. No virtualization needed.

### 4. Add Time Trend Charts to Drill-Downs

**Current state:** Employee drill-down has "Hours by Day" (already a time trend). Client drill-down has no time trend.

**What to change:**
- Client drill-down: Add "Hours Over Time" bar chart using the same pattern as the employee "Hours by Day" chart. Aggregate `clientEntries` by `entry.date`.
- Employee drill-down: "Hours by Day" already exists and serves as the time trend. No change needed unless rename desired.

**Chart reuse:** The existing `BarChart` component with `layout="horizontal"` already handles time series data. No new chart component needed.

## Data Flow

### Current Flow (Hours-Based Reports)

```
[Date Range Change in ReportsContent]
    |
    v
[fetch('/api/reports?startDate=...&endDate=...')]  x2 (main + comparison)
    |
    v
[API Route: query time_entries with user + client relations]
    |
    v
[Single-pass aggregation: employeeMap + clientMap + totals]
    |
    v
[JSON response: { summary, byEmployee, byClient, entries }]
    |
    v
[ReportsContent: setData(response)]
    |
    v
[Active tab component renders with data slice]
```

### New Flow (With Revenue + Topics)

```
[Date Range Change in ReportsContent]
    |
    +---> [fetch('/api/reports?...')]  x2         (main + comparison)
    |         |
    |         v
    |     [time_entries query + topic aggregation]
    |         |
    |         v
    |     [{ summary, byEmployee, byClient, entries }]
    |         |  (entries now include topicName)
    |         |  (byEmployee[].topics, byClient[].topics added)
    |
    +---> [fetch('/api/reports/revenue?...')]  x2  (main + comparison, admin only)
              |
              v
          [finalized SDs query for period -> calculateGrandTotal/calculateRetainerGrandTotal]
              |
              v
          [{ byClient: [{clientId, actualRevenue}], totalActualRevenue }]

[ReportsContent merges both responses into unified state]
    |
    v
[OverviewTab: estimated revenue from main data, actual revenue from revenue data]
[ByEmployeeTab: topics from main data, all entries with topicName]
[ByClientTab: topics from main data, all entries with topicName, time trend]
```

### Revenue Data Aggregation Strategy

The actual revenue query for `GET /api/reports/revenue` should:

1. Query `service_descriptions` WHERE `status = 'FINALIZED'` AND period overlaps with requested date range.
2. Include full `topics` -> `lineItems` relations (same pattern as billing list API).
3. For each finalized SD, compute total using the existing canonical functions:
   - If retainer (`retainerFee != null && retainerHours != null`): `calculateRetainerGrandTotal()`
   - Otherwise: `calculateGrandTotal()`
4. Aggregate by `clientId` and return per-client actual revenue + total.

**Performance consideration:** For ~200 clients over a monthly period, there will be at most ~200 finalized SDs (one per client per month). Each SD typically has 3-10 topics with 5-20 line items each. The billing list API (`GET /api/billing`) already does this exact calculation for ALL SDs without performance issues. Filtering to a single month makes it faster.

**Reuse:** Import `calculateGrandTotal` and `calculateRetainerGrandTotal` from `lib/billing-pdf.tsx` -- these are already exported and used in `GET /api/billing`. The serialization pattern (numeric strings -> numbers via `serializeDecimal`) is identical.

## Patterns to Follow

### Pattern 1: Single-Pass Map Aggregation

**What:** Iterate entries once, accumulating into multiple Maps simultaneously (employeeMap, clientMap, topicMap).
**When:** Adding new aggregation dimensions (topics) to existing report data.
**Trade-offs:** Fast (O(n) single pass), but the aggregation function grows. Acceptable given firm size (~1000 entries/month max).

**Example (adding topic aggregation to existing loop):**
```typescript
// Inside the existing for-of loop in getReportData / GET /api/reports:
for (const entry of entries) {
  const hours = Number(entry.hours);
  const topicName = entry.topicName || "Uncategorized";

  // ... existing employee/client aggregation ...

  // NEW: Aggregate topics for this employee
  const empTopicMap = employeeTopicMaps.get(entry.userId) || new Map();
  const existingTopic = empTopicMap.get(topicName) || 0;
  empTopicMap.set(topicName, existingTopic + hours);
  employeeTopicMaps.set(entry.userId, empTopicMap);

  // NEW: Aggregate topics for this client
  const clientTopicMap = clientTopicMaps.get(entry.clientId) || new Map();
  const existingClientTopic = clientTopicMap.get(topicName) || 0;
  clientTopicMap.set(topicName, existingClientTopic + hours);
  clientTopicMaps.set(entry.clientId, clientTopicMap);
}
```

### Pattern 2: Parallel Fetch with Conditional Revenue

**What:** Client fetches hours data and revenue data in parallel. Revenue fetch only fires for admin users.
**When:** Loading report data on date range or comparison changes.
**Trade-offs:** Two network requests instead of one, but they run in parallel and the revenue endpoint is admin-only. Simpler than a monolithic endpoint with conditional joins.

**Example:**
```typescript
const fetchData = async (start: Date, end: Date) => {
  const params = new URLSearchParams({ startDate: formatDateISO(start), endDate: formatDateISO(end) });

  const promises: Promise<Response>[] = [fetch(`/api/reports?${params}`)];
  if (isAdmin) {
    promises.push(fetch(`/api/reports/revenue?${params}`));
  }

  const [mainRes, revenueRes] = await Promise.all(promises);
  const mainData = await mainRes.json();
  const revenueData = revenueRes ? await revenueRes.json() : null;

  return { main: mainData, revenue: revenueData };
};
```

### Pattern 3: Reuse Canonical Billing Functions for Revenue

**What:** Import `calculateGrandTotal` / `calculateRetainerGrandTotal` from `lib/billing-pdf.tsx` in the new revenue API route. Do NOT reimplement billing math.
**When:** Computing actual billed revenue from finalized SDs.
**Trade-offs:** Creates a dependency from reports API -> billing-pdf. But the alternative (duplicating billing logic) is far worse. These functions are already used in `GET /api/billing` list endpoint with the same pattern.

### Pattern 4: Server Component Initial Load + Client Fetch on Change

**What:** The existing `reports/page.tsx` Server Component fetches initial data via Drizzle (no API call). Client-side `ReportsContent` fetches via API only when the user changes date range or comparison period.
**When:** Initial page load vs. subsequent interactions.
**Trade-offs:** Fast initial render (no waterfall), but requires keeping two data-fetching paths (Server Component direct query + API route) in sync. The app already does this.

**For revenue data:** The server component should also fetch initial revenue data and pass it as a new prop (`initialRevenueData`). This keeps the pattern consistent with the existing `initialData` / `initialComparisonData` flow.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Report Endpoint

**What people do:** Add revenue queries, topic aggregations, trend calculations, and entry expansion all into the single `/api/reports` route.
**Why it's wrong:** The route already has 250 lines of aggregation logic. Adding SD queries with billing calculations doubles its complexity. Different data sources (time entries vs. finalized SDs) have different query shapes and access patterns.
**Do this instead:** Keep the existing endpoint focused on time entries. Add `/api/reports/revenue` for SD-based revenue. Compose the full picture in `ReportsContent` on the client.

### Anti-Pattern 2: Computing Revenue in the Client

**What people do:** Fetch raw service description data to the client and run `calculateGrandTotal()` in the browser.
**Why it's wrong:** `calculateGrandTotal` and `calculateRetainerGrandTotal` are in `lib/billing-pdf.tsx` which imports `@react-pdf/renderer` and `path` -- server-only modules. The functions themselves are pure, but the module has server-only imports that prevent client-side usage without extraction.
**Do this instead:** Compute actual revenue server-side in the new API route. Return pre-computed `actualRevenue` per client.

### Anti-Pattern 3: Adding Virtual Scroll / Pagination for Entry Tables

**What people do:** Add complex pagination or virtualization for the drill-down entry tables.
**Why it's wrong:** Maximum ~1100 entries per month for the entire firm. A single client's entries for a month is typically 50-200 rows. This is trivially renderable without virtualization.
**Do this instead:** Remove the `.slice(0, 10)` limit and render all entries. If the full entry set is already in client memory (it is), a simple `<table>` is the right choice.

### Anti-Pattern 4: Duplicate Date Display / Format Helpers

**What people do:** Create new `formatDateDisplay()` functions in new components.
**Why it's wrong:** Both `ByEmployeeTab` and `ByClientTab` already have identical `formatDateDisplay()` helper functions defined locally. Adding more duplicates increases maintenance burden.
**Do this instead:** Extract `formatDateDisplay()` into `lib/date-utils.ts` alongside existing helpers. Use it everywhere.

## Build Order (Dependencies Between Components)

The features have clear dependency chains that dictate build order:

### Phase 1: Data Layer Foundations

**1a. Add topic fields to existing reports query** (both server page + API route)
- Modify `getReportData()` in `reports/page.tsx` to include `topicName` in time entry columns
- Modify `GET /api/reports` to include `topicName` in entry columns and response
- Add topic aggregation maps to the single-pass loop in both locations
- Return `topics: [{name, hours}]` on each `byEmployee[]` and `byClient[]` item
- Return `topicName` on each `entries[]` item

**Why first:** Every downstream feature (topic breakdowns, entry table topic column) depends on topic data being available.

**1b. Create `GET /api/reports/revenue` endpoint**
- New file: `app/src/app/api/reports/revenue/route.ts`
- Query finalized SDs for date range, compute totals using `calculateGrandTotal` / `calculateRetainerGrandTotal`
- Return `{ byClient: [{clientId, clientName, actualRevenue}], totalActualRevenue }`
- Use `requireAdmin()` guard (admin-only endpoint)

**Why here:** Independent of 1a. Can be built in parallel. No frontend dependency yet.

### Phase 2: Client Data Integration

**2a. Update `ReportsContent` to fetch and merge revenue data**
- Add `initialRevenueData` prop from server component
- Add revenue fetch to `fetchData()` callback (admin-only, parallel with main fetch)
- Store revenue data in new state: `const [revenueData, setRevenueData] = useState<RevenueData | null>(null)`

**Why second:** Depends on 1b (revenue endpoint exists) and 1a (main data shape updated). Must be done before overview charts can show revenue.

**2b. Update server component to pass initial revenue + topic data**
- Add revenue data fetch to `reports/page.tsx` (parallel with existing `getReportData` calls)
- Pass as new props to `ReportsContent`

### Phase 3: UI Features

These can be built independently of each other, all depend on Phase 1-2:

**3a. Revenue charts in OverviewTab**
- Add "Revenue by Client" bar chart (estimated from main data, actual from revenue data)
- Add "Revenue by Employee" bar chart (estimated only -- actual revenue is per-client, not per-employee)
- Add summary card for actual billed revenue alongside existing estimated

**3b. Topic breakdown in client drill-down**
- Add topic summary section at top of client drill-down (horizontal bar chart or simple table)
- Data comes from `byClient[].topics` (added in Phase 1a)

**3c. Topic breakdown in employee drill-down**
- Add topic breakdown across clients in employee drill-down
- Data comes from `byEmployee[].topics` (added in Phase 1a)

**3d. Time trend chart in client drill-down**
- Add "Hours Over Time" bar chart using `BarChart` component with `layout="horizontal"`
- Aggregate `clientEntries` by date (same pattern as employee "Hours by Day")

**3e. Full entry tables with topic column**
- Remove `.slice(0, 10)` in `ByEmployeeTab` and `ByClientTab`
- Add `topicName` column to entry table headers and rows
- Entries already carry `topicName` from Phase 1a

```
Build Dependency Graph:

1a (topic data in reports) ─────────────────> 3b (client topic breakdown)
         │                                    3c (employee topic breakdown)
         │                                    3e (full entry tables + topic column)
         │
         └──> 2a (client data integration) ──> 3a (revenue charts)
                       │
1b (revenue endpoint) ─┘
         │
         └──> 2b (server initial revenue) ──> 2a
```

**Parallelizable work:**
- 1a and 1b are independent (different data sources)
- 3b, 3c, 3d, 3e are independent of each other (different UI components)
- 3a depends on both 2a and revenue data being available

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (~10 users, ~200 clients) | No concerns. ~1000 entries/month. All queries return in <100ms. In-memory aggregation is fine. |
| 50 users, 500 clients | ~5000 entries/month. Still fine with current approach. Consider adding composite index on `(date, clientId)` if queries slow down. |
| 200+ users, 2000+ clients | Move aggregation to SQL (`GROUP BY` with `SUM`) instead of fetching all rows and aggregating in JS. Add server-side pagination for entry tables. |

### First Bottleneck

The existing approach fetches ALL time entries for a period and aggregates in JavaScript. For 10 employees over a month, this is ~1000 rows -- negligible. The first optimization needed (if the firm grows significantly) would be to push aggregation into SQL using Drizzle's `select()` with `groupBy()` and `sum()`, returning only the aggregated results rather than raw entries. The entry table would then need a separate, paginated query.

For the current firm size, this optimization is premature and would add unnecessary complexity.

## Sources

- Codebase analysis of existing files (HIGH confidence -- direct code inspection):
  - `app/src/app/(authenticated)/(admin)/reports/page.tsx` -- current server component
  - `app/src/app/api/reports/route.ts` -- current API route
  - `app/src/components/reports/ReportsContent.tsx` -- current client orchestrator
  - `app/src/components/reports/OverviewTab.tsx` -- current overview
  - `app/src/components/reports/ByEmployeeTab.tsx` -- current employee drill-down
  - `app/src/components/reports/ByClientTab.tsx` -- current client drill-down
  - `app/src/lib/billing-pdf.tsx` -- canonical billing calculation functions
  - `app/src/lib/schema.ts` -- database schema (time_entries.topicName exists)
  - `app/src/app/api/billing/route.ts` -- existing billing list API (pattern for revenue query)

---
*Architecture research for: Legal practice reporting dashboards*
*Researched: 2026-02-24*
