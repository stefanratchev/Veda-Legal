# Architecture Research

**Domain:** Reports Detail View -- multi-select filters, topic aggregation, chart-filter interactivity in Next.js 16 + Recharts
**Researched:** 2026-02-25
**Confidence:** HIGH

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                  ReportsContent (existing)                            │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────┐ │
│  │ DateRange    │  │ ComparisonPicker │  │ Tab Bar                │ │
│  │ Picker       │  │                  │  │ [Overview|Detail|      │ │
│  │ (existing)   │  │ (existing)       │  │  By Employee|By Client]│ │
│  └──────┬───────┘  └────────┬─────────┘  └────────────┬───────────┘ │
│         │                   │                         │             │
│  ┌──────┴───────────────────┴─────────────────────────┴───────────┐ │
│  │                     Data Layer (existing)                       │ │
│  │  data: ReportData  │  comparisonData: ReportData | null         │ │
│  └────────────────────────────┬───────────────────────────────────┘ │
│                               │                                     │
│  ┌────────────────────────────┴───────────────────────────────────┐ │
│  │                     DetailTab (NEW)                             │ │
│  │  ┌───────────────────────────────────────────────────────────┐ │ │
│  │  │           Filter Bar (NEW)                                 │ │ │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │ │ │
│  │  │  │ MultiSelect  │ │ MultiSelect  │ │ MultiSelect  │      │ │ │
│  │  │  │ Client       │ │ Employee     │ │ Topic        │      │ │ │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘      │ │ │
│  │  └────────────────────────┬──────────────────────────────────┘ │ │
│  │                           │ filteredEntries                    │ │
│  │  ┌────────────────────────┴──────────────────────────────────┐ │ │
│  │  │           Charts Section                                   │ │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                  │ │ │
│  │  │  │ByClient  │ │ByEmployee│ │ByTopic   │  (Hours row)     │ │ │
│  │  │  │BarChart  │ │BarChart  │ │BarChart  │                  │ │ │
│  │  │  └──────────┘ └──────────┘ └──────────┘                  │ │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                  │ │ │
│  │  │  │ByClient  │ │ByEmployee│ │ByTopic   │  (Revenue row,   │ │ │
│  │  │  │Revenue   │ │Revenue   │ │Revenue   │   admin only)    │ │ │
│  │  │  └──────────┘ └──────────┘ └──────────┘                  │ │ │
│  │  └───────────────────────────────────────────────────────────┘ │ │
│  │  ┌───────────────────────────────────────────────────────────┐ │ │
│  │  │           Entry DataTable                                  │ │ │
│  │  │  Date | Employee | Client | Topic | Subtopic | Desc |     │ │ │
│  │  │  Hours | Revenue(admin)                                    │ │ │
│  │  └───────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New/Modified |
|-----------|----------------|--------------|
| ReportsContent | Tab state, date range, data fetching, passes data to tabs | MODIFIED -- add "detail" tab type |
| DetailTab | Filter state, derive filtered data, render charts + table | NEW |
| MultiSelectFilter | Dropdown with checkboxes, search, select all/none, pill display | NEW reusable component |
| FilterBar | Compose 3 MultiSelectFilter instances, derive option lists from data | NEW (part of DetailTab or separate) |
| BarChart | Render horizontal bar chart from data array | EXISTING -- no changes |
| RevenueBarChart | Render horizontal bar chart with EUR formatting | EXISTING -- no changes |
| DataTable | Sortable, paginated table | EXISTING -- no changes |

## Recommended Integration Approach

### Key Decision: Client-Side Filtering (No API Changes)

The existing API already returns all entries for the period in `data.entries` (type `ReportEntry[]`). The Detail tab filters and re-aggregates this data client-side. This is the correct approach because:

1. **Data is already loaded.** `ReportData.entries` contains every time entry for the date range. No additional fetch needed.
2. **~10 employees, ~200 clients, 1 month** = at most a few thousand entries. Client-side filtering is instant.
3. **Filters are interactive.** Users toggle filters rapidly. A round-trip per toggle would feel sluggish and wasteful.
4. **Re-aggregation is simple.** Sum hours/revenue by client/employee/topic from the filtered entry set. Same logic as `report-utils.ts` but in the component.

No changes to `/api/reports` route or `report-utils.ts` query logic are needed for filtering.

### API Change: Add `subtopicName` to ReportEntry

The Detail tab's entry table requires a Subtopic column. The `subtopicName` field exists on `timeEntries` in the schema but is not currently included in the report-utils query or `ReportEntry` type.

**Changes required:**
1. `types/reports.ts` -- Add `subtopicName: string` to `ReportEntry`
2. `lib/report-utils.ts` -- Add `subtopicName` to query columns and to the `entries` mapping

This is a backward-compatible addition (new field on an existing response).

## Recommended Project Structure

```
src/
├── components/
│   ├── reports/
│   │   ├── ReportsContent.tsx          # MODIFIED: add "detail" tab
│   │   ├── DetailTab.tsx               # NEW: filter state + layout
│   │   ├── DetailFilterBar.tsx         # NEW: composes 3 MultiSelectFilters
│   │   ├── OverviewTab.tsx             # existing (unchanged)
│   │   ├── ByClientTab.tsx             # existing (unchanged)
│   │   ├── ByEmployeeTab.tsx           # existing (unchanged)
│   │   └── charts/
│   │       ├── BarChart.tsx            # existing (unchanged)
│   │       └── RevenueBarChart.tsx     # existing (unchanged)
│   └── ui/
│       ├── MultiSelectFilter.tsx       # NEW: reusable multi-select dropdown
│       ├── MultiSelectFilter.test.tsx  # NEW: tests
│       ├── DataTable.tsx               # existing (unchanged)
│       └── ...
├── lib/
│   ├── report-utils.ts                # MODIFIED: add subtopicName to query
│   └── detail-tab-utils.ts            # NEW: pure aggregation + filtering logic
├── types/
│   └── reports.ts                      # MODIFIED: add subtopicName to ReportEntry
└── ...
```

### Structure Rationale

- **`MultiSelectFilter` in `ui/`:** It is a general-purpose component (dropdown with checkboxes, search, pills). Other pages could reuse it. Follows the pattern of `ClientSelect` in `ui/`.
- **`DetailTab` in `reports/`:** Page-specific component, same level as `OverviewTab`, `ByClientTab`, `ByEmployeeTab`.
- **`DetailFilterBar` in `reports/`:** Composes MultiSelectFilter instances with report-specific logic (deriving option lists from `ReportData`). Not general-purpose, so lives in `reports/`.
- **`detail-tab-utils.ts` in `lib/`:** Pure functions for filtering entries, aggregating by dimension, computing revenue. Separating from the component enables unit testing without rendering.

## Architectural Patterns

### Pattern 1: Client-Side Filter + Re-Aggregate

**What:** Store filter selections as `Set<string>` in DetailTab state. Derive `filteredEntries` via `useMemo`. Derive chart data from `filteredEntries` via separate `useMemo` calls. All downstream visualizations receive derived data as props.

**When to use:** When the full dataset is already in memory and small enough for instant filtering (< 10K rows).

**Trade-offs:**
- PRO: Zero latency on filter changes, no loading states, no API complexity
- PRO: Comparison data filtering follows the same path
- CON: If the dataset ever grew to 50K+ entries, would need server-side filtering (not a concern for ~200 clients, ~10 employees, 1-month window)

**Example:**

```typescript
// DetailTab.tsx (simplified)
interface DetailTabProps {
  data: ReportData;
  comparison: ReportData | null;
  isAdmin: boolean;
}

export function DetailTab({ data, comparison, isAdmin }: DetailTabProps) {
  // Filter state: empty Set means "all selected" (no filter active)
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

  // Derive filtered entries
  const filteredEntries = useMemo(() => {
    return filterEntries(data.entries, {
      clientIds: selectedClients,
      employeeIds: selectedEmployees,
      topicNames: selectedTopics,
    });
  }, [data.entries, selectedClients, selectedEmployees, selectedTopics]);

  // Derive chart data from filtered entries
  const byClient = useMemo(() => aggregateByClient(filteredEntries, isAdmin), [filteredEntries, isAdmin]);
  const byEmployee = useMemo(() => aggregateByEmployee(filteredEntries, isAdmin), [filteredEntries, isAdmin]);
  const byTopic = useMemo(() => aggregateByTopic(filteredEntries, isAdmin), [filteredEntries, isAdmin]);

  // ... render filter bar, charts, table
}
```

### Pattern 2: "Empty Set = All" Filter Convention

**What:** An empty `Set<string>` means no filter is active (all items pass). A non-empty set means only items matching the set pass. This avoids pre-populating the set with every possible value.

**When to use:** Multi-select filters where the default state is "show everything."

**Trade-offs:**
- PRO: Initial state is trivial (`new Set()`)
- PRO: Checking "is filter active?" is `set.size > 0`
- PRO: "Clear filter" is `setFilter(new Set())`
- CON: Filter function has a conditional check, but it is simple

**Example:**

```typescript
// detail-tab-utils.ts
export function filterEntries(
  entries: ReportEntry[],
  filters: {
    clientIds: Set<string>;
    employeeIds: Set<string>;
    topicNames: Set<string>;
  }
): ReportEntry[] {
  return entries.filter((entry) => {
    if (filters.clientIds.size > 0 && !filters.clientIds.has(entry.clientId)) return false;
    if (filters.employeeIds.size > 0 && !filters.employeeIds.has(entry.userId)) return false;
    if (filters.topicNames.size > 0 && !filters.topicNames.has(entry.topicName)) return false;
    return true;
  });
}
```

### Pattern 3: Topic Aggregation from Entries (Not Pre-Computed)

**What:** The existing `ReportData` has topic data nested inside `byClient[].topics` and `byEmployee[].topics`, but NOT as a top-level `byTopic` array. For the Detail tab's "by Topic" charts, aggregate directly from the filtered `entries` array rather than trying to re-derive from nested structures.

**When to use:** When filters invalidate pre-computed aggregations. If the user filters to 2 of 10 employees, the existing `byClient[].topics` totals are wrong because they include all employees.

**Trade-offs:**
- PRO: Always correct regardless of which filters are active
- PRO: Consistent approach for all three dimensions (client, employee, topic)
- CON: Re-aggregation on every filter change -- but trivial cost for hundreds/low-thousands of entries

**Example:**

```typescript
// detail-tab-utils.ts
interface TopicChartItem {
  name: string;
  value: number;  // hours
  revenue: number;
}

export function aggregateByTopic(
  entries: ReportEntry[],
  isAdmin: boolean
): TopicChartItem[] {
  const map = new Map<string, { hours: number; revenue: number }>();

  for (const entry of entries) {
    const existing = map.get(entry.topicName) ?? { hours: 0, revenue: 0 };
    existing.hours += entry.hours;
    // Revenue needs client rate -- must be available on entry
    // (see "Revenue Calculation" section below)
    map.set(entry.topicName, existing);
  }

  return Array.from(map.entries())
    .map(([name, data]) => ({
      name,
      value: data.hours,
      revenue: isAdmin ? data.revenue : 0,
    }))
    .sort((a, b) => b.value - a.value);
}
```

### Pattern 4: Reusable MultiSelectFilter Component

**What:** A dropdown component with checkboxes, search input, select-all/clear-all actions, and pill display of selections. Modeled after the existing `ClientSelect` pattern (dropdown with search, keyboard navigation, `useClickOutside`).

**When to use:** Any filter where users need to select multiple items from a list.

**Interface design:**

```typescript
interface MultiSelectFilterProps {
  label: string;                         // "Client", "Employee", "Topic"
  options: { value: string; label: string }[];
  selected: Set<string>;                 // empty = all (no filter)
  onChange: (selected: Set<string>) => void;
  placeholder?: string;                  // "All Clients"
}
```

**Key UX details:**
- Trigger button shows "All [Label]s" when empty set, or "N selected" / pill names when filtered
- Dropdown has search input at top (reuse pattern from ClientSelect)
- Checkboxes next to each option
- "Select All" / "Clear All" links at top of list
- Close on outside click (reuse `useClickOutside` hook)
- `animate-fade-up` on dropdown open (matches app animation rule)

**Trade-offs:**
- PRO: Consistent with existing dropdown patterns in the codebase
- PRO: Reusable for future filter needs
- CON: More complex than a simple `<select multiple>` -- but native multi-select has terrible UX

## Data Flow

### Filter-to-Visualization Pipeline

```
ReportData.entries (full dataset from API)
    |
    v
DetailTab State:
  selectedClients: Set<string>
  selectedEmployees: Set<string>
  selectedTopics: Set<string>
    |
    v
filterEntries(entries, { clientIds, employeeIds, topicNames })
    |
    v
filteredEntries: ReportEntry[]
    |
    +---> aggregateByClient(filteredEntries)  --> BarChart + RevenueBarChart
    +---> aggregateByEmployee(filteredEntries) --> BarChart + RevenueBarChart
    +---> aggregateByTopic(filteredEntries)    --> BarChart + RevenueBarChart
    +---> DataTable (filteredEntries directly, with sorting/pagination)
```

### Filter Option Derivation

```
ReportData
    |
    +---> data.byClient.map(c => ({ value: c.id, label: c.name }))  --> Client MultiSelect options
    +---> data.byEmployee.map(e => ({ value: e.id, label: e.name })) --> Employee MultiSelect options
    +---> uniqueTopics(data.entries)                                  --> Topic MultiSelect options
```

Important: Filter options come from the UNFILTERED data (full period), not from filtered entries. If the user selects Employee A, the Client filter still shows all clients in the period (not just Employee A's clients). This prevents the "filter cascade" problem where selecting one filter narrows options in other filters, making it confusing to undo.

### Revenue Calculation in Filtered Aggregations

The existing `ReportEntry` type includes `clientId` and `clientType` but NOT `hourlyRate`. Revenue is pre-computed in `report-utils.ts` at the `byClient` and `byEmployee` level but not on individual entries.

**Solution:** Add an `hourlyRate` field to `ReportEntry` (or compute revenue inline). Since `report-utils.ts` already has access to `entry.client.hourlyRate`, include a computed `revenue` field on each `ReportEntry`:

```typescript
// In ReportEntry type (modified)
export interface ReportEntry {
  // ... existing fields ...
  subtopicName: string;       // NEW
  revenue: number | null;     // NEW: pre-computed per-entry revenue (admin only)
}
```

Then in `report-utils.ts`, compute `revenue` per entry:
```typescript
revenue: isAdmin && !e.isWrittenOff && (e.client.clientType === "REGULAR") && e.client.hourlyRate
  ? Number(e.hours) * Number(e.client.hourlyRate)
  : null
```

This avoids having to join hourly rate data during client-side re-aggregation. Each entry carries its own revenue, making aggregation a simple sum.

### Comparison Data and Filters

The comparison period data (`comparisonData`) should be filtered with the same filter selections. However, comparison filtering must match by entity (client ID, employee ID, topic name), NOT by entry content. The comparison period may have different clients/employees active.

```
comparisonData.entries --> filterEntries(same filters) --> aggregate
    --> pass as comparisonData to RevenueBarChart
```

### State Reset on Date/Period Change

When the user changes the date range or comparison period, filters should reset to empty (show all). This follows the existing pattern where `handleDateChange` resets `selectedEmployeeId` and `selectedClientId`. The filter state lives inside `DetailTab`, so remounting the tab on data change achieves this automatically. Alternatively, use a `useEffect` keyed on `data` to reset filters.

Recommended: Use a `key` prop on `DetailTab` tied to the data identity (e.g., date range string) so React unmounts/remounts it on date change, resetting all state naturally.

```typescript
// In ReportsContent.tsx
{activeTab === "detail" && (
  <DetailTab
    key={`${formatDateISO(startDate)}-${formatDateISO(endDate)}`}
    data={data}
    comparison={comparisonData}
    comparisonLabel={getComparisonLabel()}
    isAdmin={isAdmin}
  />
)}
```

## Integration Points

### Modified Files

| File | Change | Reason |
|------|--------|--------|
| `types/reports.ts` | Add `subtopicName: string` and `revenue: number \| null` to `ReportEntry` | Detail table needs subtopic column; aggregation needs per-entry revenue |
| `lib/report-utils.ts` | Add `subtopicName` to query columns; add `revenue` to entry mapping | Supply data for new ReportEntry fields |
| `components/reports/ReportsContent.tsx` | Add `"detail"` to `TabType` union; add tab button; render `DetailTab` | New tab in existing tab bar |

### New Files

| File | Purpose | Depends On |
|------|---------|------------|
| `components/ui/MultiSelectFilter.tsx` | Reusable multi-select dropdown with search + checkboxes | `useClickOutside` hook |
| `components/ui/MultiSelectFilter.test.tsx` | Unit tests for MultiSelectFilter | MultiSelectFilter |
| `lib/detail-tab-utils.ts` | Pure functions: `filterEntries`, `aggregateByClient`, `aggregateByEmployee`, `aggregateByTopic` | `ReportEntry` type |
| `lib/detail-tab-utils.test.ts` | Unit tests for aggregation and filtering logic | detail-tab-utils |
| `components/reports/DetailTab.tsx` | Detail tab layout: filter bar + charts + table | MultiSelectFilter, detail-tab-utils, BarChart, RevenueBarChart, DataTable |
| `components/reports/DetailTab.test.tsx` | Integration tests for DetailTab | DetailTab |

### Unchanged Files

| File | Why Unchanged |
|------|---------------|
| `app/api/reports/route.ts` | No new API parameters needed; filtering is client-side |
| `components/reports/OverviewTab.tsx` | Separate tab, not affected |
| `components/reports/ByClientTab.tsx` | Separate tab, not affected |
| `components/reports/ByEmployeeTab.tsx` | Separate tab, not affected |
| `components/reports/charts/BarChart.tsx` | Already supports the needed interface |
| `components/reports/charts/RevenueBarChart.tsx` | Already supports the needed interface |
| `components/ui/DataTable.tsx` | Already supports custom columns, sorting, pagination |
| `app/(authenticated)/(admin)/reports/page.tsx` | Server component; no changes needed for new client-side tab |

## Anti-Patterns

### Anti-Pattern 1: Server-Side Filtering via API Query Params

**What people do:** Add `?clientIds=X,Y&employeeIds=A,B&topicNames=T1,T2` query params to the API and filter in SQL.
**Why it's wrong for this case:** The full dataset is already fetched (needed by Overview, By Employee, By Client tabs). Adding filter params would mean a second API call for the Detail tab, returning a subset of data already in memory. Adds API complexity, loading states, and latency for zero benefit at this data scale.
**Do this instead:** Filter the in-memory `entries` array client-side with a `useMemo`.

### Anti-Pattern 2: Cascading Filter Options

**What people do:** When Employee A is selected, narrow the Client dropdown to only clients Employee A worked on.
**Why it's wrong:** Creates a confusing dependency chain. If you select Employee A then Client X, then deselect Employee A, does Client X stay selected even though the option disappears? Users cannot explore data combinations freely. "Why did my client options change?" becomes a FAQ.
**Do this instead:** Derive filter options from the UNFILTERED dataset. All filters are independent. Selecting Employee A filters the charts and table, but Client and Topic dropdowns still show all options from the full period.

### Anti-Pattern 3: Separate State for Each Chart's Data

**What people do:** Compute and store `byClientChartData`, `byEmployeeChartData`, `byTopicChartData` as separate state variables, updating each when filters change.
**Why it's wrong:** Duplicates derived state. Risk of charts showing inconsistent data if one state update is missed. More state = more bugs.
**Do this instead:** Single source of truth: `filteredEntries` derived via `useMemo`. Each chart's data derived from `filteredEntries` via separate `useMemo` calls. React handles re-rendering automatically.

### Anti-Pattern 4: Putting Filter Logic Inside the MultiSelectFilter Component

**What people do:** Have the MultiSelectFilter component own the filtering logic (accepting the full dataset and returning filtered data).
**Why it's wrong:** Couples a generic UI component to report-specific data shapes. Makes the component non-reusable. Makes testing harder.
**Do this instead:** MultiSelectFilter is purely a UI component: receives options, selected set, and onChange callback. The parent (DetailTab) owns filter state and derives filtered data.

## Build Order (Dependency-Aware)

### Phase 1: Data Layer Changes

1. **`types/reports.ts`** -- Add `subtopicName: string` and `revenue: number | null` to `ReportEntry`
2. **`lib/report-utils.ts`** -- Add `subtopicName` to query columns; compute `revenue` per entry in mapping
3. **Update existing report-utils tests** if they assert on the entry shape

**Why first:** All downstream components depend on the correct data shape. Changing the type first surfaces any type errors across the codebase.

### Phase 2: Pure Logic Layer

4. **`lib/detail-tab-utils.ts`** -- `filterEntries`, `aggregateByClient`, `aggregateByEmployee`, `aggregateByTopic`
5. **`lib/detail-tab-utils.test.ts`** -- Unit tests for all pure functions

**Why second:** These are pure functions with no React dependency. Easiest to write and test in isolation. Every downstream component depends on them.

### Phase 3: MultiSelectFilter Component

6. **`components/ui/MultiSelectFilter.tsx`** -- Reusable dropdown with checkboxes, search, select-all/clear
7. **`components/ui/MultiSelectFilter.test.tsx`** -- Unit tests (render, toggle, search, select all, clear)

**Why third:** DetailTab needs this component, but it can be built and tested independently.

### Phase 4: DetailTab Assembly

8. **`components/reports/DetailTab.tsx`** -- Filter bar (3x MultiSelectFilter), charts section (6 charts: 3 hours + 3 revenue), entry DataTable
9. **`components/reports/DetailTab.test.tsx`** -- Integration tests (filter changes update charts/table)
10. **`components/reports/ReportsContent.tsx`** -- Add "Detail" tab to tab bar and render DetailTab

**Why last:** Depends on all previous phases. This is pure assembly -- wiring together existing BarChart/RevenueBarChart/DataTable with the new filter state and aggregation utils.

### Summary of Changes by Category

| Category | Files Changed | Files Created |
|----------|---------------|---------------|
| Types | 1 (`reports.ts`) | 0 |
| Data/API | 1 (`report-utils.ts`) | 0 |
| Pure Logic | 0 | 2 (`detail-tab-utils.ts` + test) |
| UI Component | 0 | 2 (`MultiSelectFilter.tsx` + test) |
| Report Components | 1 (`ReportsContent.tsx`) | 2 (`DetailTab.tsx` + test) |
| **Total** | **3 modified** | **6 new** |

## Scaling Considerations

| Concern | Current Scale (~200 clients, ~10 employees) | If Scale Grew 10x |
|---------|----------------------------------------------|---------------------|
| Client-side filtering | Instant (< 5K entries/month) | Still fine (< 50K). Consider server-side only at 100K+ entries. |
| Chart rendering | 6 Recharts charts, each < 200 items | Top-15 grouping already handles this. No concern. |
| Filter option lists | ~200 clients, ~10 employees, ~30 topics | Still instant. Only virtualize at 1K+ options. |
| DataTable pagination | 50 rows/page, standard sorting | Already paginated. No concern. |

### Scaling Priorities

1. **First bottleneck (unlikely):** If entry count per period exceeds ~50K, the `entries` array in the API response becomes large. Solution: Add optional server-side filtering to `/api/reports` at that point. Not needed now.
2. **Second bottleneck (very unlikely):** If topic count exceeds ~100, the "by Topic" chart would need top-N grouping (same `maxBars` pattern already used in BarChart). Easy to add.

## Detail Tab Layout Specification

### Chart Grid (3 Columns)

```
┌────────────────┬────────────────┬────────────────┐
│ Hours by       │ Hours by       │ Hours by       │
│ Client         │ Employee       │ Topic          │
│ (BarChart)     │ (BarChart)     │ (BarChart)     │
├────────────────┼────────────────┼────────────────┤
│ Revenue by     │ Revenue by     │ Revenue by     │  (admin only row)
│ Client         │ Employee       │ Topic          │
│ (RevenueBar)   │ (RevenueBar)   │ (RevenueBar)   │
└────────────────┴────────────────┴────────────────┘
```

On smaller screens (`md` breakpoint), collapse to 1 column. Use `grid grid-cols-1 lg:grid-cols-3 gap-4` to match the existing 2-column pattern in OverviewTab but expanded to 3 for the detail view.

### Entry Table Columns

| Column | Source Field | Sortable | Admin Only |
|--------|-------------|----------|------------|
| Date | `entry.date` | Yes | No |
| Employee | `entry.userName` | Yes | No |
| Client | `entry.clientName` | Yes | No |
| Topic | `entry.topicName` | Yes | No |
| Subtopic | `entry.subtopicName` | Yes | No |
| Description | `entry.description` | No | No |
| Hours | `entry.hours` | Yes | No |
| Revenue | `entry.revenue` | Yes | Yes |

Reuse the existing `DataTable` with `ColumnDef<ReportEntry>[]`. Page size 50 (matches drill-down tabs).

## Sources

- Existing codebase analysis (HIGH confidence -- direct code reading)
- `ReportsContent.tsx`: Tab architecture, data flow, state management patterns
- `report-utils.ts`: Query shape, aggregation logic, entry mapping
- `types/reports.ts`: ReportData, ReportEntry, EmployeeStats, ClientStats types
- `BarChart.tsx`, `RevenueBarChart.tsx`: Chart component interfaces, maxBars grouping
- `DataTable.tsx`, `table-types.ts`: Table component interface, ColumnDef, sorting
- `ClientSelect.tsx`: Dropdown pattern with search, useClickOutside, keyboard nav
- `schema.ts`: `timeEntries.subtopicName` field exists, ready to query

---
*Architecture research for: Reports Detail View with multi-select filters, topic aggregation, chart-filter interactivity*
*Researched: 2026-02-25*
