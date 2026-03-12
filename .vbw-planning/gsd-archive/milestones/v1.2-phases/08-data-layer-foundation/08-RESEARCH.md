# Phase 8: Data Layer Foundation - Research

**Researched:** 2026-02-25
**Domain:** Report types, aggregation utilities, filter logic
**Confidence:** HIGH

## Summary

Phase 8 extends the existing reports data layer to support the Detail tab. The current `report-utils.ts` already has the query and aggregation pattern -- this phase adds `subtopicName` and `revenue` to the `ReportEntry` type, computes per-entry revenue server-side with admin gating, and creates four pure utility functions (`filterEntries`, `aggregateByClient`, `aggregateByEmployee`, `aggregateByTopic`) with full test coverage.

The codebase already has all the patterns needed: the Drizzle query with relations, the `ReportEntry` type in `types/reports.ts`, the revenue calculation logic (line 144 of report-utils.ts), and the test infrastructure (vitest, factories, mock helpers). No new packages are needed -- this is pure TypeScript utility work.

**Primary recommendation:** Extend existing files (types/reports.ts, lib/report-utils.ts) and add a new lib/report-detail-utils.ts for the pure filter/aggregate functions with a colocated test file.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All REGULAR client entries: revenue = `hourlyRate * hours`, regardless of retainer status
- Revenue is `number | null` -- returned as `null` for non-admin users (no client-side rate exposure)
- Written-off entries on REGULAR clients: revenue excluded from totals (matches existing behavior)
- INTERNAL/MANAGEMENT entries: non-billable, revenue not applicable
- Written-off entries ARE included in hours aggregations (Hours by Client/Employee/Topic charts)
- Written-off entries are EXCLUDED from revenue aggregations (Revenue charts show only effective revenue)
- The `isWrittenOff` flag must be present on the entry type so the UI can render visual distinction in Phase 10
- No separate filter toggle for written-off entries -- they're always visible alongside normal entries
- Each aggregation function returns: `{ id: string, name: string, totalHours: number, revenue: number | null }`
- Results sorted by `totalHours` descending (biggest contributors first)
- No top-N limit -- return all entities (data volume is trivially small: ~200 clients, ~10 employees)
- No entry count or percentage fields -- charts only need label + value
- IDs are included to enable chart-click-to-filter in Phase 11 (CHRT-07)
- AND across dimensions, OR within: entry must match ANY selected client AND ANY selected employee AND ANY selected topic
- "Empty Set = show all" convention: if no clients are selected, all clients pass; same for employees and topics
- Date range filtering stays server-side (API query parameter) -- `filterEntries` only handles client/employee/topic
- Filter options (available choices in dropdowns) are derived from entries in the current date range, not a static list

### Claude's Discretion
- INTERNAL/MANAGEMENT entry revenue: null vs explicit zero (recommend null for consistency)
- Written-off entry revenue: null vs computed-but-excluded (recommend null)
- REGULAR clients with no hourly rate set: revenue null vs zero (recommend null -- "unknown" vs "free")
- Filter parameter type: Sets vs arrays for filter values (success criteria specifies Sets)
- Exact function signatures and internal implementation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | (project version) | Type definitions | Already used throughout codebase |
| Vitest | (project version) | Unit testing | Already configured with jsdom, path aliases |
| Drizzle ORM | (project version) | Database queries | Already used in report-utils.ts |

### Supporting
No new packages needed. All work uses existing project dependencies.

### Alternatives Considered
None -- this phase is pure utility work within the existing stack.

## Architecture Patterns

### Recommended Project Structure
```
app/src/
├── types/
│   └── reports.ts           # MODIFY: Add subtopicName, revenue to ReportEntry
├── lib/
│   ├── report-utils.ts      # MODIFY: Add subtopicName to query columns, compute revenue per entry
│   └── report-detail-utils.ts      # NEW: filterEntries, aggregateByClient, aggregateByEmployee, aggregateByTopic
│   └── report-detail-utils.test.ts # NEW: Full test coverage for pure functions
```

### Pattern 1: Existing ReportEntry Mapping (report-utils.ts lines 304-317)
**What:** The `aggregateEntries` function maps raw DB entries to `ReportEntry` objects at lines 304-317
**When to use:** This is where `subtopicName` and `revenue` fields need to be added
**Current code:**
```typescript
entries: entries.map((e) => ({
  id: e.id,
  date: e.date,
  hours: Number(e.hours),
  description: e.description,
  userId: e.userId,
  userName: e.user.name || "Unknown",
  clientId: e.clientId,
  clientName: e.client.name,
  topicName: e.topicName || "Uncategorized",
  isWrittenOff: e.isWrittenOff ?? false,
  clientType: e.client.clientType as ClientType,
})),
```

### Pattern 2: Revenue Calculation (report-utils.ts line 144)
**What:** Revenue is computed only for non-written-off, billable (REGULAR), rate > 0 entries
**Existing logic:**
```typescript
if (!isWrittenOff && isBillable && clientRate > 0) {
  totalRevenue += hours * clientRate;
}
```
**For per-entry revenue:** Same logic but per entry, returning `number | null`:
- REGULAR + not written off + rate > 0 → `hours * rate`
- Otherwise → `null`

### Pattern 3: Admin Gating (report-utils.ts lines 249, 284, 292-295)
**What:** Revenue and sensitive fields are set to `null` for non-admin users
**Existing pattern:**
```typescript
revenue: isAdmin ? emp.revenue : null,
// and
totalRevenue: isAdmin ? totalRevenue : null,
```
**For per-entry revenue:** Same pattern -- compute revenue for all entries, then gate on `isAdmin` when mapping to ReportEntry.

### Pattern 4: Drizzle Query Columns (report-utils.ts lines 39-48)
**What:** The `getReportData` query specifies explicit column selection
**Current columns fetched:**
```typescript
columns: {
  id: true, date: true, hours: true, description: true,
  userId: true, clientId: true, topicName: true, isWrittenOff: true,
},
```
**Needs:** Add `subtopicName: true` to columns. The field already exists in the schema.

### Pattern 5: Pure Function Testing (colocated tests)
**What:** Test files are colocated with source (e.g., `lib/date-utils.test.ts`)
**Test infrastructure:**
- `vitest` with `jsdom` environment
- `@/test/mocks/factories` for mock data creation
- No DB mocking needed for pure functions -- just pass data directly

### Anti-Patterns to Avoid
- **Exposing hourlyRate to non-admin users:** Revenue must be `null` (not `0`) for non-admins
- **Computing revenue client-side:** Rate information must never leave the server for non-admin users
- **Modifying existing aggregation logic:** The `byEmployee`/`byClient` aggregations in report-utils.ts should remain unchanged -- the new aggregation functions are separate utilities
- **Using arrays instead of Sets for filter params:** Success criteria explicitly requires Sets

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Revenue calculation | New revenue logic | Extend existing pattern from line 144 | Already proven correct, matches billing behavior |
| Admin gating | New auth checks | Extend existing `isAdmin` pattern | Consistent with current security model |

## Common Pitfalls

### Pitfall 1: Breaking Existing Entry Mapping
**What goes wrong:** Adding fields to ReportEntry causes type errors in all consumers
**Why it happens:** ReportEntry is used by overview, by-client, and by-employee tabs
**How to avoid:** Add `subtopicName` and `revenue` as required fields to ReportEntry type, then update the mapping in report-utils.ts. All existing consumers get the fields automatically.
**Warning signs:** TypeScript compilation errors in report components

### Pitfall 2: Revenue for Non-Billable Entries
**What goes wrong:** Computing revenue for INTERNAL/MANAGEMENT entries returns 0 instead of null
**Why it happens:** `hours * 0 = 0` when hourlyRate is null/0
**How to avoid:** Check `clientType === "REGULAR"` first; return `null` for non-REGULAR entries regardless of rate
**Warning signs:** Revenue showing $0 instead of "N/A" for internal entries

### Pitfall 3: Written-Off Entry Revenue
**What goes wrong:** Written-off entries show revenue when they shouldn't
**Why it happens:** Revenue computed before checking isWrittenOff
**How to avoid:** User decision: written-off entry revenue = null (not computed-but-excluded)
**Warning signs:** Revenue totals don't match billing actuals

### Pitfall 4: Floating Point Precision in Aggregation
**What goes wrong:** `0.1 + 0.2 !== 0.3` in revenue totals
**Why it happens:** JavaScript floating-point arithmetic
**How to avoid:** The existing codebase uses simple addition (no rounding in aggregation). For display, rounding happens in the UI. Keep the same approach -- aggregate raw numbers, let UI format.
**Warning signs:** Pennies off in revenue totals

### Pitfall 5: Empty Set Filter Semantics
**What goes wrong:** Empty filter set returns no results instead of all results
**Why it happens:** Treating empty set as "nothing selected" vs "no filter active"
**How to avoid:** Explicitly check `set.size === 0` to mean "show all" per user decision
**Warning signs:** Blank charts when no filters applied

## Code Examples

### Extended ReportEntry Type
```typescript
export interface ReportEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  userId: string;
  userName: string;
  clientId: string;
  clientName: string;
  topicName: string;
  subtopicName: string;      // NEW - from timeEntries.subtopicName
  isWrittenOff: boolean;
  clientType: ClientType;
  revenue: number | null;     // NEW - computed server-side, null for non-admin
}
```

### Per-Entry Revenue Computation
```typescript
function computeEntryRevenue(
  clientType: string,
  isWrittenOff: boolean,
  hourlyRate: number | string | null,
  hours: number,
  isAdmin: boolean
): number | null {
  if (!isAdmin) return null;
  const isBillable = clientType === "REGULAR";
  const rate = hourlyRate ? Number(hourlyRate) : 0;
  if (!isBillable || isWrittenOff || rate <= 0) return null;
  return hours * rate;
}
```

### Aggregation Function Shape
```typescript
interface AggregationResult {
  id: string;
  name: string;
  totalHours: number;
  revenue: number | null;
}

function aggregateByClient(
  entries: ReportEntry[],
  clientIds: Set<string>,
  employeeIds: Set<string>,
  topicNames: Set<string>
): AggregationResult[] {
  const filtered = filterEntries(entries, clientIds, employeeIds, topicNames);
  const map = new Map<string, AggregationResult>();
  // ... aggregate filtered entries by clientId
  return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours);
}
```

### Filter Function
```typescript
function filterEntries(
  entries: ReportEntry[],
  clientIds: Set<string>,
  employeeIds: Set<string>,
  topicNames: Set<string>
): ReportEntry[] {
  return entries.filter((entry) => {
    const matchClient = clientIds.size === 0 || clientIds.has(entry.clientId);
    const matchEmployee = employeeIds.size === 0 || employeeIds.has(entry.userId);
    const matchTopic = topicNames.size === 0 || topicNames.has(entry.topicName);
    return matchClient && matchEmployee && matchTopic;
  });
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project version) |
| Config file | `app/vitest.config.ts` |
| Quick run command | `npm run test -- report-detail-utils --run` |
| Full suite command | `npm run test -- --run` |
| Estimated runtime | ~5 seconds (pure function tests) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | ReportEntry includes subtopicName and revenue | unit | `npm run test -- report-detail-utils --run` | No - Wave 0 gap |
| SC-2 | Revenue null for non-admin | unit | `npm run test -- report-detail-utils --run` | No - Wave 0 gap |
| SC-3 | filterEntries + 3 aggregate functions with tests | unit | `npm run test -- report-detail-utils --run` | No - Wave 0 gap |
| SC-4 | Existing report tests still pass | regression | `npm run test -- route.test --run` | Yes |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `npm run test -- report-detail-utils --run`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before verification
- **Estimated feedback latency per task:** ~5 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `app/src/lib/report-detail-utils.test.ts` -- covers SC-1 through SC-3
- No framework install needed -- vitest already configured

## Open Questions

None -- all questions resolved by CONTEXT.md decisions and existing codebase patterns.

## Sources

### Primary (HIGH confidence)
- `app/src/lib/report-utils.ts` -- existing query, aggregation, revenue logic, admin gating
- `app/src/types/reports.ts` -- current ReportEntry, ReportData types
- `app/src/lib/schema.ts` -- timeEntries table with subtopicName column (line 168)
- `app/src/app/api/reports/route.test.ts` -- existing test patterns and mock setup
- `app/src/test/mocks/factories.ts` -- mock data factory patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing
- Architecture: HIGH -- extending proven patterns, code locations identified
- Pitfalls: HIGH -- derived from actual codebase review

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable -- internal codebase patterns)
