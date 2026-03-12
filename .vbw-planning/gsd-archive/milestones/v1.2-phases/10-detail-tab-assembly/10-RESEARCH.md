# Phase 10: Detail Tab Assembly - Research

**Researched:** 2026-02-25
**Domain:** React component assembly, Recharts horizontal bar charts, DataTable integration, client-side filtering
**Confidence:** HIGH

## Summary

Phase 10 wires together existing building blocks (FilterBar from Phase 9, BarChart/RevenueBarChart, DataTable, filterEntries/aggregate* from Phase 8) into a new Detail tab on the Reports page. No new libraries or architectural patterns are needed -- this is pure assembly work using established patterns from the codebase.

The existing BarChart component already supports `layout="vertical"` (horizontal bars), maxBars with "Other" grouping, and onBarClick callbacks. The RevenueBarChart component handles EUR formatting with comparison badges. FilterBar manages three MultiSelectFilter instances with clear-all. DataTable provides sorting and pagination. The aggregate functions (aggregateByClient, aggregateByEmployee, aggregateByTopic) return the exact AggregationResult shape needed for chart data.

**Primary recommendation:** Build the DetailTab as a new client component that manages filter state, derives filtered/aggregated data via useMemo, and renders FilterBar + six charts + DataTable. Integrate into ReportsContent by adding a "Detail" tab to the existing tab bar.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None explicitly locked -- all decisions are at Claude's discretion.

### Claude's Discretion

**Chart arrangement:**
- Pair charts by dimension: Hours by Client + Revenue by Client side-by-side, then Hours by Employee + Revenue by Employee, then Hours by Topic + Revenue by Topic
- 2-column grid on desktop (hours left, revenue right); single column on mobile
- Non-admins see only the 3 hours charts -- use full width when revenue chart is absent
- Reuse existing `BarChart` component from `components/reports/charts/BarChart.tsx` with horizontal layout
- Cap visible bars using existing `maxBars` prop; "Other" grouping for overflow

**Entry table design:**
- Default sort by date descending (most recent first)
- Columns: Date, Employee, Client, Topic, Subtopic, Description, Hours; admins additionally see Revenue
- Truncate long descriptions with ellipsis; show full text on hover/tooltip
- 50 entries per page with pagination controls
- Reuse existing `DataTable` component from `components/ui/` if it fits, or build a focused table component

**Page structure:**
- Top: FilterBar (Phase 9 component)
- Middle: Charts section (3 paired rows)
- Bottom: Entry table with pagination
- FilterBar does NOT need to be sticky -- the tab content is the exploration area
- No collapsible sections -- keep everything visible

**Empty & loading states:**
- When filters return zero results: centered message like "No entries match the selected filters" with a "Clear filters" link
- No skeleton loaders needed -- filtering is client-side and instant (data already loaded)
- Initial load uses server-fetched data passed from the page component

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DTAB-01 | User can navigate to a Detail tab in Reports alongside Overview, By Client, By Employee | Add "detail" to TabType union in ReportsContent.tsx, add tab button, render DetailTab when active |
| FILT-06 | All charts and entry table update simultaneously when any filter changes | FilterBar's onChange updates filter state; useMemo derives filtered entries + aggregations; all children re-render with new data |
| CHRT-01 | Hours by Client horizontal bar chart | Use BarChart with layout="vertical", data from aggregateByClient on filtered entries |
| CHRT-02 | Hours by Employee horizontal bar chart | Use BarChart with layout="vertical", data from aggregateByEmployee on filtered entries |
| CHRT-03 | Hours by Topic horizontal bar chart | Use BarChart with layout="vertical", data from aggregateByTopic on filtered entries |
| CHRT-04 | Admin sees Revenue by Client horizontal bar chart | Use RevenueBarChart (no comparison data in Detail tab), data from aggregateByClient revenue |
| CHRT-05 | Admin sees Revenue by Employee horizontal bar chart | Use RevenueBarChart (no comparison data), data from aggregateByEmployee revenue |
| CHRT-06 | Admin sees Revenue by Topic horizontal bar chart | Use RevenueBarChart (no comparison data), data from aggregateByTopic revenue |
| TABL-01 | Entry table with Date, Employee, Client, Topic, Subtopic, Description, Hours columns | Use DataTable with ColumnDef array, data from filtered ReportEntry[] |
| TABL-02 | Admin sees Revenue column in entry table | Conditionally add Revenue ColumnDef when isAdmin is true |
| TABL-03 | User can sort and paginate entry table at 50 per page | DataTable already supports sorting + pagination; pass pageSize={50} and defaultSort |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| React 19 | Component framework | Already in use |
| Recharts | BarChart, RevenueBarChart components | Already in use, BarChart.tsx and RevenueBarChart.tsx exist |
| Tailwind CSS v4 | Styling with design system CSS variables | Already in use |

### Supporting (Already Installed)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| @/components/ui/DataTable | Sortable, paginated table | Entry table with 50 rows/page |
| @/components/ui/MultiSelectFilter | Searchable multi-select dropdown | Via FilterBar wrapper |
| @/components/reports/FilterBar | Three-filter wrapper with clear-all | Top of Detail tab |
| @/lib/report-detail-utils | filterEntries, aggregateByClient/Employee/Topic | Data derivation in useMemo |

### Alternatives Considered
None -- all required components already exist. No new packages needed.

## Architecture Patterns

### Component Structure
```
ReportsContent.tsx (existing, modified)
├── TabBar (existing, add "Detail" tab)
├── OverviewTab (existing, unchanged)
├── ByEmployeeTab (existing, unchanged)
├── ByClientTab (existing, unchanged)
└── DetailTab.tsx (NEW)
    ├── FilterBar (existing Phase 9 component)
    ├── ChartGrid (six charts in 3 rows x 2 cols)
    │   ├── Row 1: Hours by Client + Revenue by Client
    │   ├── Row 2: Hours by Employee + Revenue by Employee
    │   └── Row 3: Hours by Topic + Revenue by Topic
    └── DataTable (existing, with entry columns)
```

### Pattern 1: Filter State Management
**What:** DetailTab owns filter state via useState. Derives filtered data and aggregations in useMemo chains.
**When:** Always -- this is the only data flow pattern for client-side filtering.
```typescript
// DetailTab manages its own filter state
const [filters, setFilters] = useState<FilterState>({
  clientIds: new Set(),
  employeeIds: new Set(),
  topicNames: new Set(),
});

// Derive filtered entries from full dataset
const filteredEntries = useMemo(
  () => filterEntries(entries, filters.clientIds, filters.employeeIds, filters.topicNames),
  [entries, filters]
);

// Derive aggregations from filtered entries
const byClient = useMemo(() => aggregateByClient(filteredEntries), [filteredEntries]);
const byEmployee = useMemo(() => aggregateByEmployee(filteredEntries), [filteredEntries]);
const byTopic = useMemo(() => aggregateByTopic(filteredEntries), [filteredEntries]);
```

### Pattern 2: AggregationResult to Chart Data Transformation
**What:** Map AggregationResult[] to BarChartItem[] for BarChart, and to RevenueItem[] for RevenueBarChart.
```typescript
// Hours chart data (BarChart expects { name, value, id? })
const clientHoursData = byClient.map(r => ({ name: r.name, value: r.totalHours, id: r.id }));

// Revenue chart data (RevenueBarChart expects { name, value, id? })
const clientRevenueData = byClient
  .filter(r => r.revenue != null && r.revenue > 0)
  .map(r => ({ name: r.name, value: r.revenue!, id: r.id }));
```

### Pattern 3: Extract Filter Options from Full Dataset
**What:** Derive unique client/employee/topic options from the FULL (unfiltered) entries, not the filtered subset.
**Why:** If options came from filtered data, selecting one filter would remove options from other filters.
```typescript
const clientOptions = useMemo(() => {
  const map = new Map<string, string>();
  for (const e of entries) map.set(e.clientId, e.clientName);
  return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
}, [entries]);
```

### Pattern 4: ReportsContent Tab Integration
**What:** Add "detail" to TabType, add tab button, conditionally render DetailTab.
```typescript
type TabType = "overview" | "by-employee" | "by-client" | "detail";

// In tabs array:
{ id: "detail", label: "Detail" }

// In render:
{activeTab === "detail" && (
  <DetailTab entries={data.entries} isAdmin={isAdmin} />
)}
```

### Pattern 5: Responsive Chart Grid (Admin vs Non-Admin)
**What:** When admin, render 2-col grid (hours left, revenue right). When non-admin, render single column full-width.
```typescript
<div className={`grid grid-cols-1 ${isAdmin ? "md:grid-cols-2" : ""} gap-4`}>
  {/* Hours chart always rendered */}
  <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
    <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
      Hours by Client
    </h3>
    <div className="h-64">
      <BarChart data={clientHoursData} layout="vertical" valueFormatter={formatHours} maxBars={10} />
    </div>
  </div>
  {/* Revenue chart only for admin */}
  {isAdmin && (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
      <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
        Revenue by Client
      </h3>
      <div className="h-64">
        <RevenueBarChart data={clientRevenueData} maxBars={10} />
      </div>
    </div>
  )}
</div>
```

### Anti-Patterns to Avoid
- **Filtering options from filtered data:** Options must come from the full dataset. Otherwise, selecting a client filter would remove employees who only work for other clients.
- **Storing derived data in state:** Never useState for filtered entries or aggregations. Always useMemo.
- **Passing comparison data to Detail tab charts:** Detail tab excludes comparison badges per STATE.md decision. Do NOT pass comparisonData to RevenueBarChart.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable paginated table | Custom table implementation | DataTable from components/ui/ | Already handles sort state, pagination, column definitions |
| Multi-select filter dropdowns | Custom filter UI | FilterBar + MultiSelectFilter | Phase 9 built these, fully tested |
| Bar chart rendering | SVG/Canvas charts | BarChart + RevenueBarChart | Recharts-based, already styled for dark theme |
| Filtering logic | Inline .filter() chains | filterEntries() from report-detail-utils | Tested, handles empty-Set-means-all convention |
| Aggregation | Inline reduce/groupBy | aggregateByClient/Employee/Topic | Tested, handles null revenue, sorts by totalHours desc |

## Common Pitfalls

### Pitfall 1: Filter Options from Filtered Data
**What goes wrong:** If you derive client/employee/topic options from the currently filtered entries, selecting a filter removes options from other filters, making them impossible to clear.
**How to avoid:** Always derive options from the FULL entry array, not the filtered subset.

### Pitfall 2: Pagination Reset on Filter Change
**What goes wrong:** DataTable's internal page state stays on page 5 when filters reduce results to 10 entries.
**How to avoid:** DataTable already clamps currentPage to valid range via `Math.min(currentPage, totalPages)`. Using a `key` prop on DataTable that changes with filters will force remount and page reset. Alternatively, derive validCurrentPage (already done in DataTable).

### Pitfall 3: Revenue Column Visibility for Non-Admins
**What goes wrong:** Revenue data is null for non-admins, but column renders "null" or "0" instead of being hidden.
**How to avoid:** Conditionally include the Revenue ColumnDef in the columns array based on isAdmin. Don't render a column that shows null.

### Pitfall 4: Chart Heights with Variable Data Counts
**What goes wrong:** Fixed chart heights look awkward with 1-2 bars (too much empty space) or 20+ bars (too cramped).
**How to avoid:** Use fixed height (h-64 = 256px) with maxBars={10} to cap visible bars. The existing BarChart "Other" grouping handles overflow.

### Pitfall 5: Tab State Reset
**What goes wrong:** Switching from Detail to Overview and back preserves stale filter state from an earlier visit.
**How to avoid:** Use `key={activeTab}` on DetailTab to force remount when returning to the tab. This resets filter state to empty Sets. Per STATE.md: "research recommends reset via key prop".

## Code Examples

### DetailTab Component Shape
```typescript
"use client";

import { useState, useMemo } from "react";
import { FilterBar, FilterState } from "@/components/reports/FilterBar";
import { BarChart } from "@/components/reports/charts/BarChart";
import { RevenueBarChart } from "@/components/reports/charts/RevenueBarChart";
import { DataTable } from "@/components/ui/DataTable";
import { ColumnDef } from "@/components/ui/table-types";
import { filterEntries, aggregateByClient, aggregateByEmployee, aggregateByTopic } from "@/lib/report-detail-utils";
import { formatHours } from "@/lib/date-utils";
import type { ReportEntry } from "@/types/reports";

interface DetailTabProps {
  entries: ReportEntry[];
  isAdmin: boolean;
}

export function DetailTab({ entries, isAdmin }: DetailTabProps) {
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    clientIds: new Set(),
    employeeIds: new Set(),
    topicNames: new Set(),
  });

  // Derive options from FULL dataset
  const clientOptions = useMemo(() => { /* ... */ }, [entries]);
  const employeeOptions = useMemo(() => { /* ... */ }, [entries]);
  const topicOptions = useMemo(() => { /* ... */ }, [entries]);

  // Derive filtered entries
  const filteredEntries = useMemo(
    () => filterEntries(entries, filters.clientIds, filters.employeeIds, filters.topicNames),
    [entries, filters]
  );

  // Aggregations for charts
  const byClient = useMemo(() => aggregateByClient(filteredEntries), [filteredEntries]);
  const byEmployee = useMemo(() => aggregateByEmployee(filteredEntries), [filteredEntries]);
  const byTopic = useMemo(() => aggregateByTopic(filteredEntries), [filteredEntries]);

  // Chart data transformations
  // ... map AggregationResult[] to BarChartItem[] and RevenueItem[]

  // Column definitions
  // ... 7 columns (+ Revenue for admin)

  return (
    <div className="space-y-6">
      <FilterBar ... />
      {/* 3 chart rows */}
      <DataTable ... />
    </div>
  );
}
```

### ReportsContent Tab Integration
```typescript
// Add to TabType union
type TabType = "overview" | "by-employee" | "by-client" | "detail";

// Add to tabs array
const tabs: { id: TabType; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "by-employee", label: "By Employee" },
  { id: "by-client", label: "By Client" },
  { id: "detail", label: "Detail" },
];

// Add to render (use key prop for state reset)
{activeTab === "detail" && (
  <DetailTab key="detail" entries={data.entries} isAdmin={isAdmin} />
)}
```

### Entry Table Column Definitions
```typescript
const columns: ColumnDef<ReportEntry>[] = [
  { id: "date", header: "Date", accessor: (r) => r.date, cell: (r) => formatDateDisplay(r.date) },
  { id: "employee", header: "Employee", accessor: (r) => r.userName },
  { id: "client", header: "Client", accessor: (r) => r.clientName },
  { id: "topic", header: "Topic", accessor: (r) => r.topicName },
  { id: "subtopic", header: "Subtopic", accessor: (r) => r.subtopicName, sortable: false },
  { id: "description", header: "Description", accessor: (r) => r.description, sortable: false, cell: truncated },
  { id: "hours", header: "Hours", accessor: (r) => r.hours, align: "right", cell: (r) => formatHours(r.hours) },
  // Admin only:
  ...(isAdmin ? [{ id: "revenue", header: "Revenue", accessor: (r) => r.revenue, align: "right", cell: formatRevenue }] : []),
];
```

## Open Questions

None -- all required components and patterns are established in the codebase.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `components/reports/ReportsContent.tsx`, `FilterBar.tsx`, `BarChart.tsx`, `RevenueBarChart.tsx`, `DataTable.tsx`
- Codebase inspection: `lib/report-detail-utils.ts` (filterEntries, aggregateByClient/Employee/Topic)
- Codebase inspection: `types/reports.ts` (ReportEntry, ReportData)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components already exist and are tested
- Architecture: HIGH -- follows established patterns from OverviewTab and ByClientTab
- Pitfalls: HIGH -- identified from codebase patterns and STATE.md notes

**Research date:** 2026-02-25
**Valid until:** Indefinite (no external dependencies)
