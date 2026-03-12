# Phase 1: Data Layer - Research

**Researched:** 2026-02-24
**Domain:** Reports API extension (Drizzle ORM aggregation, TypeScript response shaping)
**Confidence:** HIGH

## Summary

Phase 1 extends the existing `GET /api/reports` endpoint and its server-component counterpart (`reports/page.tsx`) to include topic aggregations, revenue calculations, and write-off awareness. No new endpoints, no new database tables, no new dependencies are needed.

The existing codebase already has all the data the phase requires: `timeEntries.topicName` (denormalized string), `timeEntries.isWrittenOff` (boolean), `clients.clientType` (enum: REGULAR/INTERNAL/MANAGEMENT), and `clients.hourlyRate` (nullable decimal). The work is purely in-memory aggregation logic within the existing query-then-aggregate pattern and extending the TypeScript response interfaces.

**Primary recommendation:** Modify the single report aggregation loop in both `route.ts` and `page.tsx` to track topic-level hours (including written-off breakdown) and compute revenue consistently: exclude written-off entries from revenue, treat INTERNAL/MANAGEMENT clients as revenue=0, and treat null hourlyRate as revenue=0.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Written-off entries (isWrittenOff=true) are **included in hours totals** but **excluded from revenue calculations**
- Written-off entries **appear in the entries array** with isWrittenOff flag visible
- In topic aggregations, written-off hours appear **under their real topic** (not a separate pseudo-topic)
- Each topic item in the topics array carries a **writtenOffHours** field alongside totalHours so UI can distinguish
- Summary-level includes **totalWrittenOffHours** field for write-off visibility
- All revenue fields (summary.totalRevenue, byClient.revenue, byEmployee.revenue) consistently **exclude written-off entry hours**
- Clients with null hourlyRate: **revenue = 0** (not null)
- Entries with empty or null topicName: resolve to **"Uncategorized"** -- this applies both on individual entries AND as a topic item in the topics array
- INTERNAL/MANAGEMENT clients: **included in byClient** with revenue = 0, with a **clientType field** so the UI can separate billable from non-billable
- Employee items: include **billableHours** field alongside totalHours to distinguish billable from internal/management work
- **Extend existing response shape** -- no comparison-specific API changes
- Frontend already calls the API twice with different date ranges for comparison; this pattern continues
- **Fix existing revenue calculations** (summary.totalRevenue, byClient.revenue) to be consistent with new rules: exclude written-off entries, INTERNAL/MANAGEMENT = 0
- Entries include **isWrittenOff** flag for UI styling/filtering
- Entries include **clientType** for filtering billable vs internal
- **Return all entries** for the date range; frontend handles pagination

### Claude's Discretion
- Whether to include per-entry revenue (hourlyRate x hours) on individual entries, or let frontend derive it from client data
- Whether to add potentialRevenue (including written-off) alongside revenue on byClient items
- Employee revenue calculation consistency with written-off exclusion (recommended: keep consistent -- exclude written-off from employee revenue too)
- Exact field naming conventions for new response fields

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DAT-01 | Reports API includes topic data (topicName) in its response for entries and aggregations | `timeEntries.topicName` exists in schema, just needs to be selected in the Drizzle query and aggregated into `topics[]` arrays on byClient/byEmployee items. Empty/null resolved to "Uncategorized". |
| DAT-02 | Reports API includes per-client revenue (hourlyRate x hours) in its response | Already partially implemented (`byClient.revenue` exists). Needs fixing: must exclude written-off entries, must treat INTERNAL/MANAGEMENT as 0, must treat null rate as 0 (not null). |
| DAT-03 | Reports API includes per-employee revenue (proportional by hours worked on each client) in its response | New field on `byEmployee` items. Calculated as sum across all clients of (employee hours on client x client rate), excluding written-off hours, excluding INTERNAL/MANAGEMENT clients. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | (already installed) | Database queries with `with` relations | Already used for all DB access in the project |
| Next.js App Router | 16 (already installed) | API routes + Server Components | Project framework |
| TypeScript | (already installed) | Type-safe response shaping | Project language |
| Vitest | (already installed) | Unit testing the API route | Project test framework |

### Supporting
No new libraries needed. All required data fields already exist in the database schema.

### Alternatives Considered
None -- this phase uses only existing libraries and patterns. No new dependencies.

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### Recommended Changes Structure
```
app/src/
├── app/
│   ├── api/reports/
│   │   ├── route.ts              # MODIFY: extend query + aggregation + response
│   │   └── route.test.ts         # MODIFY: add tests for new fields
│   └── (authenticated)/(admin)/reports/
│       └── page.tsx              # MODIFY: extend server-side aggregation (mirrors route.ts)
└── components/reports/
    └── ReportsContent.tsx        # MODIFY: update TypeScript interfaces only
```

### Pattern 1: Single-Pass Aggregation with Topic Tracking
**What:** Extend the existing `for (const entry of entries)` aggregation loop to track per-topic hours in addition to per-employee and per-client data.
**When to use:** When adding new aggregation dimensions to the same dataset.
**Example:**
```typescript
// Inside the existing aggregation loop:
const topicName = entry.topicName || "Uncategorized";
const isWrittenOff = entry.isWrittenOff;
const clientType = entry.client.clientType;
const isBillable = clientType === "REGULAR";
const hours = Number(entry.hours);
const clientRate = entry.client.hourlyRate ? Number(entry.client.hourlyRate) : 0;

// Topic aggregation for this client
if (!client.topicMap.has(topicName)) {
  client.topicMap.set(topicName, { topicName, totalHours: 0, writtenOffHours: 0 });
}
const topicData = client.topicMap.get(topicName)!;
topicData.totalHours += hours;
if (isWrittenOff) topicData.writtenOffHours += hours;

// Revenue (excluding written-off, excluding non-REGULAR clients)
if (!isWrittenOff && isBillable) {
  clientRevenue += hours * clientRate;
}
```

### Pattern 2: Consistent Revenue Calculation
**What:** All revenue fields follow the same rules: exclude written-off entries, INTERNAL/MANAGEMENT = 0, null rate = 0.
**When to use:** Everywhere revenue is computed (summary.totalRevenue, byClient.revenue, byEmployee.revenue).
**Example:**
```typescript
// Employee revenue = sum across all clients of (non-written-off hours on that client * client rate)
// Only for REGULAR clients (INTERNAL/MANAGEMENT contribute 0)
function shouldCountRevenue(entry: { isWrittenOff: boolean; clientType: string }): boolean {
  return !entry.isWrittenOff && entry.clientType === "REGULAR";
}
```

### Pattern 3: Dual Code Paths (API Route + Server Component)
**What:** The reports data is built in two places: `route.ts` (API, called by client-side fetches for date changes) and `page.tsx` (server component, initial page load). Both must return identical shapes.
**When to use:** This is an existing pattern in the codebase.
**Important:** Both files must be updated in lockstep. Extract shared types (or at least keep interfaces identical) to avoid drift.

### Anti-Patterns to Avoid
- **Revenue field returning null for missing rates:** The user decision says null rate = revenue 0, not null. This is a CHANGE from the current behavior where `byClient.revenue` returns `null` when `hourlyRate` is null.
- **Separate "written-off" pseudo-topic:** Written-off entries stay under their real topic with a `writtenOffHours` breakdown field. Do NOT create a synthetic "Written Off" topic.
- **Forgetting server component page.tsx:** The route.ts gets all the tests, but page.tsx has a near-identical `getReportData()` function that must also be updated. These two code paths must stay in sync.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal precision | Custom rounding | Standard `Number()` conversion (existing pattern) | Drizzle returns numeric as strings; `Number()` is sufficient for display-level precision with small data volumes |
| Date comparison | Manual string compare | Drizzle `gte`/`lte` operators (existing) | Already working correctly in the codebase |
| Topic name normalization | Complex regex cleanup | Simple `entry.topicName \|\| "Uncategorized"` | topicName is a clean denormalized string; empty string and null are the only edge cases |

**Key insight:** This phase is purely aggregation logic -- no complex data structures, no external libraries, no tricky algorithms. The main risk is inconsistency between the multiple places revenue/topics are computed.

## Common Pitfalls

### Pitfall 1: Revenue Inconsistency Between Summary and Detail
**What goes wrong:** `summary.totalRevenue` computes differently from `sum(byClient.revenue)`, or `byEmployee.revenue` uses different rules than `byClient.revenue`.
**Why it happens:** Revenue exclusion rules (written-off, client type, null rate) are applied in some places but not others.
**How to avoid:** Define a single `shouldCountRevenue(entry)` predicate used everywhere. Compute summary totals by summing the already-computed byClient/byEmployee values, not by re-scanning entries.
**Warning signs:** Test that `summary.totalRevenue === sum(byClient.revenue where clientType === 'REGULAR')`.

### Pitfall 2: Forgetting to Update page.tsx Server Component
**What goes wrong:** API route returns correct new fields but initial page load (SSR) returns old shape.
**Why it happens:** `page.tsx` has its own `getReportData()` that duplicates the route.ts logic.
**How to avoid:** Update both files. Test the API route (where mocks are straightforward), then apply identical logic to page.tsx.
**Warning signs:** Page works after client-side date change but not on initial load.

### Pitfall 3: Breaking Existing Tests
**What goes wrong:** Changing revenue from `null` to `0` for null-rate clients breaks existing assertions.
**Why it happens:** Current tests assert `revenue: null` for clients without hourlyRate (see route.test.ts line 418).
**How to avoid:** Update existing test expectations alongside the logic changes. The user explicitly decided null rate = revenue 0.
**Warning signs:** Test failures in "handles client without hourly rate" test case.

### Pitfall 4: Empty topicName Handling
**What goes wrong:** Entries with `topicName: ""` (the schema default) create an empty-string topic instead of "Uncategorized".
**Why it happens:** The schema has `topicName: text().default('').notNull()`, so many entries have `topicName: ""` rather than null.
**How to avoid:** Normalize with `entry.topicName || "Uncategorized"` (falsy check catches both "" and null).
**Warning signs:** A topic with empty name "" appearing in aggregations.

### Pitfall 5: Non-Admin Revenue Visibility
**What goes wrong:** Revenue fields leak to non-admin users.
**Why it happens:** New revenue fields on byEmployee items might not be filtered for non-admin users.
**How to avoid:** Maintain existing pattern: non-admins get `revenue: null` in summary, and byClient items have rate/revenue nulled out. Apply same pattern to new byEmployee.revenue field.
**Warning signs:** Non-admin API response containing revenue numbers.

## Code Examples

### Current Drizzle Query (What Needs to Change)
```typescript
// Current query in route.ts -- needs these additions:
const entries = await db.query.timeEntries.findMany({
  where: whereClause,
  columns: {
    id: true,
    date: true,
    hours: true,
    description: true,
    userId: true,
    clientId: true,
    topicName: true,        // ADD: already in schema, just not selected
    isWrittenOff: true,     // ADD: already in schema, just not selected
  },
  with: {
    user: { columns: { id: true, name: true } },
    client: {
      columns: {
        id: true,
        name: true,
        hourlyRate: true,
        clientType: true,   // ADD: already in schema, just not selected
      },
    },
  },
  orderBy: [desc(timeEntries.date)],
});
```

### Topic Aggregation Structure
```typescript
// Topic item in the topics[] array on byClient/byEmployee
interface TopicAggregation {
  topicName: string;        // "General Advisory", "Uncategorized", etc.
  totalHours: number;       // All hours under this topic (including written-off)
  writtenOffHours: number;  // Hours where isWrittenOff === true
}
```

### Extended Response Interfaces
```typescript
// Changes to existing interfaces
interface ClientStats {
  // ... existing fields ...
  clientType: "REGULAR" | "INTERNAL" | "MANAGEMENT";  // NEW
  revenue: number;           // CHANGED: was number | null, now always number (0 for non-billable/null rate)
  topics: TopicAggregation[];  // NEW
}

interface EmployeeStats {
  // ... existing fields ...
  totalHours: number;        // Existing: all hours including written-off
  billableHours: number;     // NEW: hours on REGULAR clients, excluding written-off
  revenue: number;           // NEW: sum of (non-written-off hours on client * client rate) for REGULAR clients
  topics: TopicAggregation[];  // NEW
}

interface ReportSummary {
  totalHours: number;
  totalRevenue: number | null;      // null for non-admin, number for admin
  totalWrittenOffHours: number;     // NEW
  activeClients: number;
}

// Entry in the entries[] array
interface ReportEntry {
  // ... existing fields ...
  topicName: string;         // NEW: resolved to "Uncategorized" if empty/null
  isWrittenOff: boolean;     // NEW
  clientType: "REGULAR" | "INTERNAL" | "MANAGEMENT";  // NEW
}
```

### Employee Revenue Calculation
```typescript
// Employee revenue is proportional: for each client the employee worked on,
// sum (employee's non-written-off hours on that client) * (client's hourly rate)
// Only for REGULAR clients.
for (const [clientId, clientHours] of emp.clientHoursMap.entries()) {
  const clientData = clientMap.get(clientId);
  if (clientData && clientData.clientType === "REGULAR" && clientData.hourlyRate) {
    // clientHours.billableHours excludes written-off entries
    empRevenue += clientHours.billableHours * clientData.hourlyRate;
  }
}
```

### Discretionary Decisions (Researcher Recommendations)

**Per-entry revenue:** Recommend NOT including per-entry revenue on individual entries. The frontend can derive it from `clientId` -> `byClient[].hourlyRate` lookup. Adding `entry.revenue` creates redundancy and another place for consistency bugs.

**potentialRevenue on byClient:** Recommend NOT adding for Phase 1. It adds complexity with unclear UI value. Can be added later as a simple `totalHours * hourlyRate` calculation if needed.

**Written-off exclusion consistency:** Recommend keeping consistent as CONTEXT.md suggests -- exclude written-off from employee revenue just like client revenue.

**Field naming:** Recommend these specific names for consistency with existing codebase patterns:
- `topics` (array) -- matches existing `clients`, `employees` naming pattern
- `billableHours` -- clear distinction from `totalHours`
- `writtenOffHours` -- matches `isWrittenOff` naming
- `totalWrittenOffHours` -- matches `totalHours` naming at summary level
- `clientType` -- matches schema field name exactly

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `revenue: null` for null-rate clients | `revenue: 0` for null-rate/non-billable clients | This phase (user decision) | Simpler frontend: no null-checking for revenue display |
| No topic data in reports | Topic aggregation per client/employee | This phase (new requirement) | Enables Phase 3/4 drill-down topic breakdowns |
| No write-off awareness in reports | Written-off entries tracked with separate hours | This phase (new requirement) | Revenue accuracy + UI visibility |

**Deprecated/outdated:**
- `byClient.revenue: number | null` pattern -- being replaced with `revenue: number` (always 0 for non-billable). This is a breaking change for any frontend code checking `revenue !== null`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x with jsdom environment |
| Config file | `app/vitest.config.ts` |
| Quick run command | `npm run test -- src/app/api/reports/route.test.ts --run` |
| Full suite command | `npm run test -- --run` |
| Estimated runtime | ~8 seconds (full suite: 43 files, 893 tests) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DAT-01a | Entries include topicName (resolved from schema field) | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Needs new tests in existing file |
| DAT-01b | Null/empty topicName resolves to "Uncategorized" | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Needs new tests in existing file |
| DAT-01c | byClient items include topics[] array with hours per topic | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Needs new tests in existing file |
| DAT-01d | byEmployee items include topics[] array with hours per topic | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Needs new tests in existing file |
| DAT-02a | byClient.revenue is number (not null) for all clients | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Existing test needs update (line 418 asserts null) |
| DAT-02b | INTERNAL/MANAGEMENT clients have revenue = 0 | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Needs new tests in existing file |
| DAT-02c | Written-off entries excluded from client revenue | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Needs new tests in existing file |
| DAT-02d | summary.totalRevenue excludes written-off and non-billable | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Needs new tests in existing file |
| DAT-03a | byEmployee items include revenue field | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Needs new tests in existing file |
| DAT-03b | Employee revenue = proportional (hours on client * client rate) | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Needs new tests in existing file |
| DAT-03c | Employee revenue excludes written-off and non-REGULAR clients | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Needs new tests in existing file |
| ALL | summary.totalRevenue === sum(byClient.revenue for REGULAR) | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Needs new consistency test |
| ALL | Non-admin users see null revenue fields | unit | `npm run test -- src/app/api/reports/route.test.ts --run` | Existing tests cover this pattern, needs extension |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `npm run test -- src/app/api/reports/route.test.ts --run`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~3 seconds (single test file)

### Wave 0 Gaps (must be created before implementation)
- [ ] Extend `createMockTimeEntryWithRelations()` in route.test.ts to support `topicName`, `isWrittenOff`, and `client.clientType` fields
- [ ] Update existing test that asserts `revenue: null` for null-rate clients (line ~418) to assert `revenue: 0`
- [ ] Add new test describe blocks: "Topic Aggregations", "Written-off Handling", "Client Type Revenue Rules", "Employee Revenue", "Revenue Consistency"

*(No new test files needed -- all tests belong in the existing `route.test.ts`. No framework install needed.)*

## Open Questions

1. **Should page.tsx `getReportData()` be extracted to a shared utility?**
   - What we know: route.ts and page.tsx have near-identical aggregation logic (~100 lines duplicated)
   - What's unclear: Whether the user wants a refactor or just parallel updates
   - Recommendation: For Phase 1, update both in parallel. Extracting to a shared utility is a good follow-up but adds scope. Flag for planner to decide.

2. **Non-admin byEmployee.revenue visibility**
   - What we know: Non-admins currently get `revenue: null` in summary and nulled-out rate/revenue on byClient
   - What's unclear: Should the new `byEmployee.revenue` also be hidden for non-admins?
   - Recommendation: Yes, follow existing pattern -- non-admins should not see any revenue data. Apply same null-out treatment to byEmployee.revenue and byEmployee.billableHours.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection:** `app/src/app/api/reports/route.ts` -- current API implementation (253 lines)
- **Codebase inspection:** `app/src/app/api/reports/route.test.ts` -- existing test suite (802 lines, comprehensive)
- **Codebase inspection:** `app/src/lib/schema.ts` -- Drizzle schema with `timeEntries.topicName`, `timeEntries.isWrittenOff`, `clients.clientType`, `clients.hourlyRate`
- **Codebase inspection:** `app/src/app/(authenticated)/(admin)/reports/page.tsx` -- server component with duplicate aggregation logic
- **Codebase inspection:** `app/src/components/reports/ReportsContent.tsx` -- frontend TypeScript interfaces consuming API response

### Secondary (MEDIUM confidence)
- **CONTEXT.md decisions** -- user-locked implementation choices from `/gsd:discuss-phase`

### Tertiary (LOW confidence)
- None -- all findings are from direct codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing patterns
- Architecture: HIGH -- extending existing code with well-understood patterns
- Pitfalls: HIGH -- identified from direct code inspection and test analysis

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable -- pure application logic, no library version concerns)
