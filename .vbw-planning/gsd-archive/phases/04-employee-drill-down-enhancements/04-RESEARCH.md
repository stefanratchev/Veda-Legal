# Phase 4: Employee Drill-Down Enhancements - Research

**Researched:** 2026-02-24
**Domain:** React component refactoring (charts, tables, pagination) - mirror of Phase 3 for employee view
**Confidence:** HIGH

## Summary

This phase enhances the employee drill-down view in the Reports "By Employee" tab to match the patterns established in Phase 3's client drill-down. All data is already available from the API: `EmployeeStats.topics` contains `TopicAggregation[]` (verified in `route.ts` lines 271-272) and `transformedEntries` in `ReportsContent` already includes `topicName` (line 255). The existing `BarChart` and `DataTable` components are proven and ready to reuse.

The current `ByEmployeeTab.tsx` has three gaps matching the three requirements: (1) no topic distribution chart -- only "Hours by Client" and "Hours by Day" charts exist, (2) the entry table is hand-rolled with a `.slice(0, 10)` limit (line 129), and (3) the entry table lacks a Topic column (columns are Date, Client, Description, Hours). All three gaps follow the exact pattern Phase 3 solved for `ByClientTab.tsx`.

The work is purely UI. No API changes, schema changes, or new libraries are needed. The `ByEmployeeTab` component's local `EmployeeStats` interface needs `topics` added, its local `Entry` interface needs `topicName` added, the "Hours by Day" chart should be replaced with the "Topic Breakdown" chart, and the hand-rolled table should be replaced with `DataTable`.

**Primary recommendation:** Mirror Phase 3's `ByClientTab` refactoring pattern exactly. The ByClientTab.tsx after Phase 3 serves as the reference implementation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Simple sum aggregation: merge hours across clients into a single bar per topic (no per-client breakdown within bars)
- Horizontal bar chart using the same `BarChart` component from Phase 3
- Bar labels show hours + percentage (e.g., "M&A Advisory 8.0h (45%)")
- Include "Uncategorized" entries (null topic) in the chart -- same treatment as Phase 1 data layer
- Dynamic height scaling: same formula as Phase 3 (`Math.max(256, items * 40)`)
- Side-by-side with existing "Hours by Client" chart (Topic Breakdown on left, Hours by Client on right)
- Same responsive pattern as Phase 3: stack vertically on mobile
- Same side-by-side grid layout implementation
- Columns: Date, Client, Topic, Description, Hours
- Default sort: Date descending (most recent first)
- Sortable columns: Date, Client, Topic, Hours (Description excluded -- same decision as Phase 3)
- Pagination: 50 entries per page (consistent with Phase 3)
- Uses the existing DataTable component (same as Phase 3's entry table)
- TDD pattern matching Phase 3: test scaffold first (wave 0), then implementation
- Plan structure: ~3 plans (test scaffold, topic chart + layout, DataTable entry table)
- Always show topic chart even with a single topic (one bar communicating "100% on one topic")
- Empty date range: show "No entries for this period" in chart and table areas
- Include INTERNAL/MANAGEMENT client entries in both chart and table

### Claude's Discretion
- Exact chart color palette (match existing or adapt)
- Empty state message wording
- Test data factory structure for ByEmployeeTab tests

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EDR-01 | Employee drill-down shows a topic breakdown chart showing hours per topic across all clients | `EmployeeStats.topics` already contains `TopicAggregation[]` from API (route.ts line 23). Reuse `BarChart` with `layout="vertical"` (horizontal bars). Compute percentage from topic hours / employee total hours. Same label format as Phase 3: `"${topicName}  ${formatHours(hours)} (${pct}%)"`. |
| EDR-02 | Employee drill-down entry table shows ALL entries for the selected date range, with pagination if exceeding ~50 | Replace current `.slice(0, 10)` (ByEmployeeTab.tsx line 129) with `DataTable` component configured with `pageSize={50}` and `defaultSort={{ columnId: "date", direction: "desc" }}`. Identical pattern to Phase 3's ByClientTab entry table. |
| EDR-03 | Employee drill-down entry table includes a topic column | Add `topicName: string` to ByEmployeeTab's local `Entry` interface (data already flows from `transformedEntries` in ReportsContent line 255). Add Topic column definition matching Phase 3's ByClientTab column pattern. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts (via BarChart) | Already installed | Horizontal bar chart for topic breakdown | Same component used in Phase 3 client drill-down, Overview tab |
| DataTable (project component) | N/A | Sortable, paginated entry table | Generic table component with sorting/pagination built in Phase 3 |
| table-types (project types) | N/A | ColumnDef, SortState, DataTableProps | Shared type definitions for DataTable columns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-utils (formatHours) | N/A | Format hours for display (e.g., "8.5h") | All hour values in chart labels and table cells |

### Alternatives Considered
None. Phase 3 established the component stack and this phase reuses it identically.

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Reference Implementation: ByClientTab.tsx (after Phase 3)

The `ByClientTab.tsx` file at `/Users/stefan/projects/veda-legal-timesheets/app/src/components/reports/ByClientTab.tsx` is the reference implementation. Phase 4 mirrors its patterns for the employee drill-down. Key structural elements to replicate:

### Pattern 1: Topic Chart Data Preparation from EmployeeStats.topics
**What:** Aggregate topic hours from the pre-computed `topics` array on `EmployeeStats`, format labels with hours and percentage, filter zero-hour topics, sort descending by value.
**When to use:** When rendering the topic breakdown chart in the drill-down view.
**Example (adapted from ByClientTab lines 142-153):**
```typescript
// selectedEmployee.topics is TopicAggregation[] from the API
const topicChartData = selectedEmployee.topics
  .filter((t) => t.totalHours > 0)
  .map((t) => {
    const pct = selectedEmployee.totalHours > 0
      ? Math.round((t.totalHours / selectedEmployee.totalHours) * 100)
      : 0;
    return {
      name: `${t.topicName}  ${formatHours(t.totalHours)} (${pct}%)`,
      value: t.totalHours,
    };
  })
  .sort((a, b) => b.value - a.value);
```

### Pattern 2: Dynamic Chart Height
**What:** Scale chart height based on number of data items to avoid cramped bars.
**When to use:** For both the topic breakdown and hours by client charts.
**Example (from ByClientTab lines 156-157):**
```typescript
const topicChartHeight = Math.max(256, topicChartData.length * 40);
const clientChartHeight = Math.max(256, clientChartData.length * 40);
```

### Pattern 3: Side-by-Side Chart Layout
**What:** Two charts in a responsive grid that stacks on mobile.
**When to use:** Chart section of the drill-down view.
**Example (from ByClientTab lines 253-280):**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Topic Breakdown */}
  <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
    <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
      Topic Breakdown
    </h3>
    <div style={{ height: topicChartHeight }}>
      <BarChart data={topicChartData} valueFormatter={formatHours} layout="vertical" />
    </div>
  </div>
  {/* Hours by Client */}
  <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
    <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
      Hours by Client
    </h3>
    <div style={{ height: clientChartHeight }}>
      <BarChart data={clientChartData} valueFormatter={formatHours} layout="vertical" />
    </div>
  </div>
</div>
```

### Pattern 4: DataTable Column Definitions
**What:** Define columns with accessor functions for sorting and custom cell renderers for styling.
**When to use:** Replacing the hand-rolled entry table with DataTable.
**Example (adapted from ByClientTab lines 160-213 for employee context):**
```typescript
const entryColumns: ColumnDef<Entry>[] = [
  {
    id: "date",
    header: "Date",
    accessor: (row) => row.date,
    cell: (row) => (
      <span className="text-[var(--text-secondary)] text-[13px]">
        {formatDateDisplay(row.date)}
      </span>
    ),
  },
  {
    id: "client",
    header: "Client",
    accessor: (row) => row.client.name,
    cell: (row) => (
      <span className="text-[var(--text-primary)] text-[13px]">
        {row.client.name}
      </span>
    ),
  },
  {
    id: "topic",
    header: "Topic",
    accessor: (row) => row.topicName,
    cell: (row) => (
      <span className="text-[var(--text-secondary)] text-[13px]">
        {row.topicName}
      </span>
    ),
  },
  {
    id: "description",
    header: "Description",
    accessor: (row) => row.description,
    cell: (row) => (
      <span className="text-[var(--text-secondary)] text-[13px] max-w-xs truncate block">
        {row.description}
      </span>
    ),
    sortable: false,
  },
  {
    id: "hours",
    header: "Hours",
    accessor: (row) => row.hours,
    align: "right",
    cell: (row) => (
      <span className="text-[var(--text-primary)] text-[13px]">
        {formatHours(row.hours)}
      </span>
    ),
  },
];
```

Note: The employee drill-down column set is Date, Client, Topic, Description, Hours. The client drill-down column set is Date, Employee, Topic, Description, Hours. The difference is the second column: Client vs Employee contextual pivot.

### Pattern 5: Empty State for Drill-Down with No Entries
**What:** When an employee is selected but has no entries in the period, show the back button header with an empty state message.
**When to use:** Edge case handling for empty date ranges.
**Example (from ByClientTab lines 86-123):**
```tsx
if (employeeEntries.length === 0) {
  return (
    <div className="space-y-6">
      {/* Back button and header - same as normal view */}
      {/* Empty state message */}
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--text-secondary)] text-[13px]">
          No time entries for this employee in the selected period
        </p>
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Slicing entries to fixed count:** The current `ByEmployeeTab` uses `.slice(0, 10)` on line 129. This must be completely removed. DataTable handles pagination.
- **Hand-rolling table HTML:** The current table with `<thead>/<tbody>/<tr>/<td>` should be fully replaced by `<DataTable>`. Do not mix hand-rolled rows with DataTable.
- **Computing topic hours from entries:** The `selectedEmployee.topics` array already has aggregated topic hours from the API. Do NOT re-aggregate from entries -- use the pre-computed data. (This is what Phase 3 did for clients.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable, paginated table | `<table>` with manual sort/paginate logic | `<DataTable>` from `@/components/ui/DataTable` | Already built, tested (DataTable.test.tsx has 18+ tests), handles sort cycling, null values, pagination |
| Horizontal bar chart | SVG/Canvas chart or new Recharts wrapper | `<BarChart>` from `./charts/BarChart` | Handles colors, tooltips, responsive sizing, vertical/horizontal layout |
| Column type definitions | Inline type annotations | `ColumnDef<T>` from `@/components/ui/table-types` | Generic, type-safe, used across the app |

**Key insight:** Phase 4 should introduce zero new components or abstractions. Everything exists from Phase 3.

## Common Pitfalls

### Pitfall 1: ByEmployeeTab Interface Mismatch
**What goes wrong:** The local `EmployeeStats` interface in ByEmployeeTab.tsx (line 6-14) lacks `topics: TopicAggregation[]`. The local `Entry` interface (line 16-28) lacks `topicName: string`. TypeScript won't error because the data flows through (excess properties are allowed), but the component can't ACCESS these fields without updating the interfaces.
**Why it happens:** Phase 1 added `topics` to the API response and ReportsContent's types, but ByEmployeeTab's local interfaces were not updated (same gap Phase 3 fixed for ByClientTab).
**How to avoid:** Update BOTH local interfaces before writing any chart or table code. Add `topics: { topicName: string; totalHours: number; writtenOffHours: number }[]` to `EmployeeStats` and `topicName: string` to `Entry`.
**Warning signs:** `Property 'topics' does not exist on type 'EmployeeStats'` TypeScript errors.

### Pitfall 2: "Hours by Day" Chart Removal
**What goes wrong:** The current ByEmployeeTab has TWO charts: "Hours by Client" and "Hours by Day". The user decided on "Topic Breakdown" and "Hours by Client" as the side-by-side pair. The "Hours by Day" chart (lines 111-124, 178-189) must be REMOVED, not just hidden.
**Why it happens:** Easy to add the topic chart without removing the day chart, ending up with three charts.
**How to avoid:** The drill-down section should have exactly two chart cards. Replace the "Hours by Day" card entirely with the "Topic Breakdown" card. Remove the `hoursByDay` computation (lines 111-124) and its chart card.
**Warning signs:** Three chart cards visible in the drill-down view.

### Pitfall 3: Client Column in Employee Table
**What goes wrong:** The client drill-down table has an "Employee" column (who worked on this client). The employee drill-down table needs a "Client" column (which client the work was for). Using the wrong column or omitting it breaks the contextual navigation.
**Why it happens:** Copy-pasting from ByClientTab without adjusting the pivot dimension.
**How to avoid:** Column order for employee drill-down is: Date, Client, Topic, Description, Hours. The `client.name` accessor already exists on the Entry type.
**Warning signs:** "Employee" column appearing in employee drill-down (redundant -- we already know which employee).

### Pitfall 4: Topic Chart Using Entries Instead of EmployeeStats.topics
**What goes wrong:** Aggregating topic hours from the entries array instead of using the pre-computed `selectedEmployee.topics` from the API.
**Why it happens:** It seems simpler to reduce entries, but the API's aggregation includes proper Uncategorized handling and is consistent with what Phase 1 established.
**How to avoid:** Use `selectedEmployee.topics` directly, following the same pattern as `selectedClient.topics` in ByClientTab.
**Warning signs:** Topic totals not matching between chart and table; "Uncategorized" label inconsistencies.

### Pitfall 5: BarChart Mock in Tests
**What goes wrong:** Recharts components render SVG in real browsers but don't render readable text in JSDOM. Tests that assert on chart content fail.
**Why it happens:** JSDOM doesn't support SVG layout/rendering fully.
**How to avoid:** Mock `BarChart` in tests to render data as DOM text, exactly as Phase 3 did:
```typescript
vi.mock("./charts/BarChart", () => ({
  BarChart: ({ data }: { data: { name: string; value: number }[] }) => (
    <div data-testid="bar-chart">
      {data.map((d) => (
        <span key={d.name}>{d.name}</span>
      ))}
    </div>
  ),
}));
```
**Warning signs:** Tests timing out or asserting on empty container text.

## Code Examples

Verified patterns from the existing codebase (Phase 3 implementation):

### DataTable Integration (from ByClientTab.tsx lines 286-293)
```typescript
// Source: app/src/components/reports/ByClientTab.tsx
<DataTable
  data={clientEntries}
  columns={entryColumns}
  getRowKey={(entry) => entry.id}
  pageSize={50}
  defaultSort={{ columnId: "date", direction: "desc" }}
  emptyMessage="No entries for this client"
/>
```

For the employee drill-down, adapt to:
```typescript
<DataTable
  data={employeeEntries}
  columns={entryColumns}
  getRowKey={(entry) => entry.id}
  pageSize={50}
  defaultSort={{ columnId: "date", direction: "desc" }}
  emptyMessage="No entries for this employee"
/>
```

### Test Factory Pattern (from ByClientTab.test.tsx lines 42-70)
```typescript
// Source: app/src/components/reports/ByClientTab.test.tsx
function createEmployee(overrides?: Partial<EmployeeStats>): EmployeeStats {
  return {
    id: "e1",
    name: "John Smith",
    totalHours: 24,
    clientCount: 2,
    topClient: { name: "Acme Corp", hours: 16 },
    clients: [
      { id: "c1", name: "Acme Corp", hours: 16 },
      { id: "c2", name: "Beta Ltd", hours: 8 },
    ],
    dailyHours: [{ date: "2026-02-20", hours: 8 }],
    topics: [
      { topicName: "M&A Advisory", totalHours: 14, writtenOffHours: 0 },
      { topicName: "Company Law", totalHours: 10, writtenOffHours: 0 },
    ],
    ...overrides,
  };
}

function createEntry(overrides?: Partial<Entry>): Entry {
  return {
    id: "entry-1",
    date: "2026-02-20",
    hours: 2,
    description: "Drafted agreement",
    topicName: "M&A Advisory",
    client: { id: "c1", name: "Acme Corp" },
    employee: { id: "e1", name: "John Smith" },
    ...overrides,
  };
}
```

## Current State of ByEmployeeTab.tsx

Key gaps to address (line references to current file):

| Current State | Target State | Lines Affected |
|---------------|-------------|----------------|
| `EmployeeStats` lacks `topics` field | Add `topics: { topicName: string; totalHours: number; writtenOffHours: number }[]` | Lines 6-14 |
| `Entry` lacks `topicName` field | Add `topicName: string` | Lines 16-28 |
| "Hours by Day" chart (second chart) | Replace with "Topic Breakdown" chart | Lines 111-124 (computation), 178-189 (render) |
| Fixed `h-64` chart heights | Dynamic `style={{ height }}` based on item count | Lines 169, 183 |
| Two charts in `grid grid-cols-2` (no responsive) | `grid grid-cols-1 md:grid-cols-2` for responsive stacking | Line 164 |
| Hand-rolled table with `.slice(0, 10)` | `DataTable` with `pageSize={50}` | Lines 127-232 (table section) |
| Columns: Date, Client, Description, Hours | Columns: Date, Client, Topic, Description, Hours | Table columns |
| "Recent Entries" heading | "Entries" heading (all entries, not just recent) | Line 197 |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library (JSDOM) |
| Config file | `app/vitest.config.ts` |
| Quick run command | `cd /Users/stefan/projects/veda-legal-timesheets/app && npm run test -- --run ByEmployeeTab` |
| Full suite command | `cd /Users/stefan/projects/veda-legal-timesheets/app && npm run test -- --run` |
| Estimated runtime | ~5 seconds (single file), ~30 seconds (full suite) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDR-01 | Topic breakdown chart renders with hours + percentage labels | unit (component) | `npm run test -- --run ByEmployeeTab` | No -- Wave 0 gap |
| EDR-01 | Zero-hour topics hidden from chart | unit (component) | `npm run test -- --run ByEmployeeTab` | No -- Wave 0 gap |
| EDR-02 | All entries rendered (not limited to 10) | unit (component) | `npm run test -- --run ByEmployeeTab` | No -- Wave 0 gap |
| EDR-02 | Pagination shown when >50 entries | unit (component) | `npm run test -- --run ByEmployeeTab` | No -- Wave 0 gap |
| EDR-02 | Default sort by date descending | unit (component) | `npm run test -- --run ByEmployeeTab` | No -- Wave 0 gap |
| EDR-03 | Topic column header present | unit (component) | `npm run test -- --run ByEmployeeTab` | No -- Wave 0 gap |
| EDR-03 | topicName displayed in entry rows | unit (component) | `npm run test -- --run ByEmployeeTab` | No -- Wave 0 gap |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `cd /Users/stefan/projects/veda-legal-timesheets/app && npm run test -- --run ByEmployeeTab`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~5 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `app/src/components/reports/ByEmployeeTab.test.tsx` -- covers EDR-01, EDR-02, EDR-03 (all three requirements)
- No framework install needed -- Vitest + RTL already configured
- No shared fixtures needed -- test factories defined inline (matching Phase 3 pattern)

## Open Questions

None. This phase is a direct mirror of Phase 3's patterns with no ambiguity. The data layer is complete, the UI components exist, and the user decisions are fully specified.

## Sources

### Primary (HIGH confidence)
- `/Users/stefan/projects/veda-legal-timesheets/app/src/components/reports/ByEmployeeTab.tsx` -- current implementation (the file to modify)
- `/Users/stefan/projects/veda-legal-timesheets/app/src/components/reports/ByClientTab.tsx` -- Phase 3 reference implementation
- `/Users/stefan/projects/veda-legal-timesheets/app/src/components/reports/ByClientTab.test.tsx` -- Phase 3 test reference
- `/Users/stefan/projects/veda-legal-timesheets/app/src/components/reports/charts/BarChart.tsx` -- BarChart component API
- `/Users/stefan/projects/veda-legal-timesheets/app/src/components/ui/DataTable.tsx` -- DataTable component API
- `/Users/stefan/projects/veda-legal-timesheets/app/src/components/ui/table-types.ts` -- ColumnDef type definitions
- `/Users/stefan/projects/veda-legal-timesheets/app/src/components/reports/ReportsContent.tsx` -- data flow from API to tabs
- `/Users/stefan/projects/veda-legal-timesheets/app/src/app/api/reports/route.ts` -- API response shape with EmployeeStats.topics

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components already exist and are proven in Phase 3
- Architecture: HIGH -- direct mirror of Phase 3 patterns, no new patterns needed
- Pitfalls: HIGH -- identified from actual Phase 3 experience and current code inspection

**Research date:** 2026-02-24
**Valid until:** Indefinite -- this is internal codebase research, not dependent on external library versions
