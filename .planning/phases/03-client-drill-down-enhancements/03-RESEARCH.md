# Phase 3: Client Drill-Down Enhancements - Research

**Researched:** 2026-02-24
**Domain:** React component refactoring (charts, tables, pagination, sorting)
**Confidence:** HIGH

## Summary

This phase enhances the existing client drill-down view in the Reports "By Client" tab. All data needed is already available: the API returns `topics: TopicAggregation[]` on each `ClientStats` object and `topicName` on every entry. The existing `BarChart` component supports horizontal bar charts. The existing `DataTable` component provides sorting, pagination, and column definitions out of the box.

The work is purely UI: (1) add a topic breakdown horizontal bar chart using the existing `BarChart` component with label formatting for "Xh (Y%)", (2) replace the hand-rolled 10-entry table with the reusable `DataTable` component configured with ~50 rows per page and a Topic column, and (3) reorganize the drill-down layout with side-by-side charts and section headings.

**Primary recommendation:** Refactor `ByClientTab.tsx` drill-down section to use the existing `BarChart` and `DataTable` components. No new libraries, API changes, or schema changes required.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Topic breakdown: horizontal bar chart matching existing Hours by Employee chart style
- Show all topics, no cap/grouping into "Other"
- Each bar label shows hours + percentage (e.g. "12.5h (34%)")
- Hide topics with zero hours
- Reuse existing `BarChart` component from `components/reports/charts/`
- Entry table shows ALL entries (replacing current 10-entry limit)
- Page numbers pagination at bottom ("Page 1 of 5" with prev/next)
- ~50 entries per page
- Default sort: newest first (most recent date at top)
- Sortable columns via click on column header
- Column order: Date, Employee, Topic, Description, Hours
- Section order: Header, Charts (Topic Breakdown + Hours by Employee side-by-side), Entry Table
- Each section has a visible heading label
- No hours trend chart (CDR-02 dropped)

### Claude's Discretion
- Exact page size (somewhere around 50)
- Responsive breakpoint for side-by-side to stacked chart transition
- Chart heights and spacing
- Pagination component styling (matching existing dark theme)
- Sort indicator styling on column headers

### Deferred Ideas (OUT OF SCOPE)
- Hours-over-time trend chart (CDR-02) -- user decided not needed for client drill-down
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CDR-01 | Topic breakdown summary showing hours per topic at top of client drill-down | `ClientStats.topics` already contains `TopicAggregation[]` from API. Reuse `BarChart` with `layout="vertical"` (horizontal bars). Compute percentage from topic hours / total hours. |
| CDR-02 | Hours-over-time trend chart for selected date range | **DROPPED by user decision.** No implementation needed. |
| CDR-03 | Entry table shows ALL entries for selected date range with pagination (~50/page) | Replace hand-rolled `recentEntries.slice(0, 10)` table with `DataTable` component. Pass `pageSize={50}` and `defaultSort={{ columnId: "date", direction: "desc" }}`. |
| CDR-04 | Entry table includes a topic column | Add `topicName` to the Entry type flowing into `ByClientTab`. Add a "Topic" column definition in the `DataTable` columns array. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | ^3.6.0 | Bar chart rendering | Already used for all charts in reports. `BarChart` wrapper component exists. |
| React | 19.2.1 | UI framework | Project framework |
| Next.js | 16.0.10 | App Router, pages | Project framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `DataTable` (internal) | n/a | Sortable, paginated table | Entry table with sorting and pagination |
| `BarChart` (internal) | n/a | Horizontal/vertical bar charts | Topic breakdown chart |
| `formatHours` (internal) | n/a | "Xh Ym" formatting | Bar chart value labels and table cells |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `DataTable` | Hand-rolled table (current) | DataTable already has sorting, pagination, dark theme styling. No reason to hand-roll. |
| `BarChart` wrapper | Raw Recharts | BarChart wrapper already handles dark theme, tooltips, styling. Consistency. |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/reports/
│   ├── ByClientTab.tsx          # Modified: refactored drill-down section
│   └── ReportsContent.tsx       # Modified: pass topicName in Entry type
├── components/ui/
│   ├── DataTable.tsx            # Existing: reuse as-is
│   └── table-types.ts           # Existing: ColumnDef, DataTableProps
```

### Pattern 1: Data Already Available -- No API Changes
**What:** The reports API (`/api/reports`) already returns `topics: TopicAggregation[]` on each `ClientStats` and `topicName: string` on each entry. Phase 1 (data layer) added this.
**When to use:** This phase consumes data already delivered by the API.
**Key data shapes:**

```typescript
// Already in API response (route.ts line 36)
interface ClientStats {
  topics: TopicAggregation[]; // { topicName, totalHours, writtenOffHours }
  // ...other fields
}

// Already in API response (route.ts line 55)
interface Entry {
  topicName: string; // "Uncategorized" when null
  // ...other fields
}
```

### Pattern 2: Entry Type Extension for topicName
**What:** `ReportsContent.tsx` transforms raw API entries into a local `Entry` type. Currently that type lacks `topicName`. Both `ByClientTab` and `ByEmployeeTab` use this same `Entry` type.
**How to implement:**

```typescript
// In ReportsContent.tsx -- add topicName to Entry interface
interface Entry {
  id: string;
  date: string;
  hours: number;
  description: string;
  topicName: string;        // ADD THIS
  client: { id: string; name: string };
  employee: { id: string; name: string };
}

// In transformedEntries mapping -- include topicName
const transformedEntries: Entry[] = data.entries.map((e) => ({
  // ...existing fields
  topicName: e.topicName,  // ADD THIS
}));
```

**Note:** This will also pass `topicName` to `ByEmployeeTab`, which is useful for Phase 4 (EDR-03 needs the same topic column in employee drill-down).

### Pattern 3: Topic Chart Data Preparation
**What:** Transform `ClientStats.topics` into `BarChart` data format with percentage labels.
**Key consideration:** The `BarChart` component's data shape is `{ name: string; value: number; id?: string }[]`. Topic names go in `name`, hours in `value`. But the user wants labels showing "12.5h (34%)" -- this requires a custom `valueFormatter` on the `BarChart`.

```typescript
// Prepare topic chart data from selectedClient.topics
const topicChartData = selectedClient.topics
  .filter((t) => t.totalHours > 0)  // Hide zero-hour topics
  .map((t) => ({
    name: t.topicName,
    value: t.totalHours,
  }))
  .sort((a, b) => b.value - a.value);

// Custom formatter showing "12.5h (34%)"
const topicValueFormatter = (value: number) => {
  const pct = Math.round((value / selectedClient.totalHours) * 100);
  return `${formatHours(value)} (${pct}%)`;
};
```

### Pattern 4: DataTable Column Definitions for Entries
**What:** Define `ColumnDef<Entry>[]` for the entries table matching the user's column order.

```typescript
import { ColumnDef } from "@/components/ui/table-types";

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
    id: "employee",
    header: "Employee",
    accessor: (row) => row.employee.name,
    cell: (row) => (
      <span className="text-[var(--text-primary)] text-[13px]">
        {row.employee.name}
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

### Pattern 5: Side-by-Side Chart Layout
**What:** Place Topic Breakdown and Hours by Employee charts in a responsive 2-column grid.
**Existing pattern:** `OverviewTab.tsx` uses `grid grid-cols-1 md:grid-cols-2 gap-4` for side-by-side charts. `ByEmployeeTab.tsx` uses `grid grid-cols-2 gap-4` (no responsive breakpoint). Use the responsive `md:` pattern from OverviewTab.

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Topic Breakdown */}
  <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
    <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
      Topic Breakdown
    </h3>
    <div className="h-64">
      <BarChart data={topicChartData} valueFormatter={topicValueFormatter} layout="vertical" />
    </div>
  </div>
  {/* Hours by Employee (existing) */}
  <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
    <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
      Hours by Employee
    </h3>
    <div className="h-64">
      <BarChart data={employeeChartData} valueFormatter={formatHours} layout="vertical" />
    </div>
  </div>
</div>
```

### Anti-Patterns to Avoid
- **Modifying the API route:** All data is already available. Do not add new endpoints or query parameters.
- **Creating a custom pagination component:** `DataTable` already has built-in pagination with prev/next buttons, "Page X of Y", and "Showing X to Y of Z".
- **Creating a custom sort implementation:** `DataTable` handles sorting via `ColumnDef.accessor` and clickable column headers.
- **Filtering entries client-side before passing to DataTable:** The current `clientEntries` filter is correct. Do not paginate server-side -- the dataset is small (~200 clients, ~10 employees, ~400 entries/month).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable table with pagination | Custom sort + page state + prev/next buttons | `DataTable` component (`components/ui/DataTable.tsx`) | Already built, tested (DataTable.test.tsx), matches dark theme. Supports `ColumnDef`, `defaultSort`, `pageSize`. |
| Bar chart with dark theme styling | Raw Recharts setup | `BarChart` component (`components/reports/charts/BarChart.tsx`) | Already styled for dark theme with tooltips, axis labels, responsive container. |
| Date formatting | Inline date logic | `formatDateDisplay()` (already in ByClientTab.tsx) | Already exists as a local function. |
| Hours formatting | Inline hours logic | `formatHours()` from `@/lib/date-utils` | Already used across all report components. |

**Key insight:** This phase is almost entirely about replacing hand-rolled UI with existing reusable components. The `DataTable` component was likely built anticipating exactly this use case.

## Common Pitfalls

### Pitfall 1: ByClientTab Entry Type Mismatch
**What goes wrong:** `ByClientTab.tsx` defines its own `Entry` interface (line 14-27) that lacks `topicName`. If you add `topicName` to the `ByClientTab` props but forget to update `ReportsContent.tsx`'s `Entry` type and `transformedEntries` mapping, the field will be `undefined`.
**Why it happens:** The Entry type is duplicated between `ReportsContent.tsx` (line 49-62) and `ByClientTab.tsx` (line 14-27). They must stay in sync.
**How to avoid:** Update BOTH: (1) the `Entry` interface in `ReportsContent.tsx`, (2) the `transformedEntries` mapping to include `topicName: e.topicName`, (3) the `Entry` interface in `ByClientTab.tsx`.
**Warning signs:** Topic column shows "undefined" or empty in the entries table.

### Pitfall 2: ByClientTab ClientStats Type Missing topics
**What goes wrong:** `ByClientTab.tsx` defines its own `ClientStats` interface (line 6-12) that lacks the `topics` field. The parent `ReportsContent.tsx` passes `data.byClient` which DOES have `topics`, but TypeScript won't expose it through the narrower interface.
**Why it happens:** Local interface redefinition shadows the richer API type.
**How to avoid:** Add `topics: { topicName: string; totalHours: number; writtenOffHours: number }[]` to the `ClientStats` interface in `ByClientTab.tsx`.
**Warning signs:** `selectedClient.topics` is `undefined` or TypeScript compilation error.

### Pitfall 3: DataTable defaultSort Not Matching Column ID
**What goes wrong:** If `defaultSort.columnId` doesn't match any `ColumnDef.id`, the sort is silently ignored and entries appear in API order (already date desc, but fragile).
**Why it happens:** Typo or mismatch between column id string and defaultSort columnId.
**How to avoid:** Use the exact same string constant. Column id `"date"` must match `defaultSort: { columnId: "date", direction: "desc" }`.
**Warning signs:** Entries not sorted by date on initial render.

### Pitfall 4: Percentage Calculation Division by Zero
**What goes wrong:** If `selectedClient.totalHours` is 0 (empty state that somehow passes the guard), the percentage calculation `(value / totalHours) * 100` produces `Infinity` or `NaN`.
**Why it happens:** The drill-down view should not render when `clientEntries.length === 0` (there's an early return), but `totalHours` could still theoretically be 0 if all entries have 0 hours.
**How to avoid:** Guard: `const pct = selectedClient.totalHours > 0 ? Math.round((value / selectedClient.totalHours) * 100) : 0;`
**Warning signs:** "NaN%" or "Infinity%" in chart labels.

### Pitfall 5: BarChart Tooltip Shows Raw valueFormatter Output
**What goes wrong:** The `BarChart` tooltip uses `valueFormatter` for the tooltip content AND the axis ticks. If the formatter includes percentage ("12.5h (34%)"), the axis ticks also show percentages which looks wrong on the Y-axis number scale.
**Why it happens:** `BarChart` passes `valueFormatter` to both `<Tooltip formatter>` and `<XAxis tickFormatter>` (for vertical layout, X is the value axis).
**How to avoid:** Two options: (1) Use `formatHours` as the `valueFormatter` (axis-friendly) and accept that tooltip won't show percentage, OR (2) pass `formatHours` as `valueFormatter` and handle the percentage display differently (e.g., in the bar name: "Topic Name - 12.5h (34%)"). The user wants percentage on each bar label, so option (2) with the name including percentage, or a custom tooltip. Given the existing BarChart signature, the cleanest approach is to include "Xh (Y%)" in the `name` field of each data point.
**Warning signs:** Garbled axis labels like "12.5h (34%)" on the numeric axis.

## Code Examples

### Complete Topic Chart Data Preparation
```typescript
// Source: Codebase analysis of BarChart component and ByClientTab data flow

// The BarChart component uses `name` for labels and `value` for bar length.
// Including hours + percentage in the `name` field avoids axis formatting issues.
const topicChartData = selectedClient.topics
  .filter((t) => t.totalHours > 0)
  .map((t) => {
    const pct = selectedClient.totalHours > 0
      ? Math.round((t.totalHours / selectedClient.totalHours) * 100)
      : 0;
    return {
      name: t.topicName,
      value: t.totalHours,
    };
  })
  .sort((a, b) => b.value - a.value);
```

### DataTable Usage for Entries
```typescript
// Source: Codebase analysis of DataTable component (components/ui/DataTable.tsx)

import { DataTable } from "@/components/ui/DataTable";
import { ColumnDef } from "@/components/ui/table-types";

<DataTable
  data={clientEntries}
  columns={entryColumns}
  getRowKey={(entry) => entry.id}
  pageSize={50}
  defaultSort={{ columnId: "date", direction: "desc" }}
  emptyMessage="No entries for this client"
/>
```

### Section Heading Pattern (from existing codebase)
```typescript
// Source: ByClientTab.tsx line 196-199, ByEmployeeTab.tsx line 179
<h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
  Topic Breakdown
</h3>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled table with `.slice(0, 10)` | `DataTable` with pagination | Phase 3 (this phase) | All entries visible, sortable, paginated |
| No topic info in drill-down | Topic breakdown chart + topic column | Phase 3 (this phase) | Admins see work distribution by topic |

**No deprecated or outdated patterns to address.** All existing components (`BarChart`, `DataTable`) are current and well-tested.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + React Testing Library |
| Config file | `app/vitest.config.ts` |
| Quick run command | `npm run test -- --run ByClientTab` |
| Full suite command | `npm run test -- --run` |
| Estimated runtime | ~5 seconds |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CDR-01 | Topic breakdown chart renders with topic data | unit (component) | `npm run test -- --run ByClientTab` | No -- Wave 0 gap |
| CDR-02 | DROPPED | n/a | n/a | n/a |
| CDR-03 | Entry table shows all entries with pagination (not limited to 10) | unit (component) | `npm run test -- --run ByClientTab` | No -- Wave 0 gap |
| CDR-04 | Entry table includes topic column | unit (component) | `npm run test -- --run ByClientTab` | No -- Wave 0 gap |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `npm run test -- --run ByClientTab`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~5 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `app/src/components/reports/ByClientTab.test.tsx` -- covers CDR-01, CDR-03, CDR-04. Tests: (1) renders topic breakdown chart section when client selected with topics, (2) renders all entries via DataTable (not limited to 10), (3) entry table has Topic column header, (4) topic chart hides zero-hour topics, (5) topic chart shows percentage labels, (6) default sort is newest-first, (7) pagination appears when entries exceed page size.

*(Existing `DataTable.test.tsx` covers sorting and pagination mechanics thoroughly. Phase tests should focus on integration: correct data flows into DataTable and BarChart.)*

## Open Questions

1. **BarChart label positioning for "Xh (Y%)" format**
   - What we know: The `BarChart` component uses `valueFormatter` for both tooltip AND axis tick labels. Putting percentage in `valueFormatter` would pollute the X-axis.
   - What's unclear: Whether to (a) put "Xh (Y%)" in the bar name/label via Recharts LabelList, (b) include it in the Y-axis tick label by concatenating to `name`, or (c) modify the `BarChart` component to accept separate tooltip vs axis formatters.
   - Recommendation: The simplest approach is to use the `BarChart` `valueFormatter` with `formatHours` for the axis, and use a custom Recharts `LabelList` on the bar for the "Xh (Y%)" text (similar to how `RevenueBarChart` uses `LabelList` for `percentChange` badges). This keeps the axis clean and puts the detailed label on each bar. Alternatively, the "Xh (Y%)" can be concatenated into the topic name shown on the Y-axis (e.g., "M&A Advisory - 12.5h (34%)"), which requires no `BarChart` changes but makes long names. The implementer should choose based on visual result. **Both approaches require no new dependencies.**

## Sources

### Primary (HIGH confidence)
- Codebase inspection of `app/src/components/reports/ByClientTab.tsx` -- current drill-down implementation
- Codebase inspection of `app/src/components/reports/ReportsContent.tsx` -- data flow and Entry type
- Codebase inspection of `app/src/app/api/reports/route.ts` -- API response shape, topics already included
- Codebase inspection of `app/src/components/ui/DataTable.tsx` -- sorting, pagination, column definitions
- Codebase inspection of `app/src/components/ui/table-types.ts` -- ColumnDef, DataTableProps interfaces
- Codebase inspection of `app/src/components/reports/charts/BarChart.tsx` -- chart wrapper component
- Codebase inspection of `app/src/components/reports/charts/RevenueBarChart.tsx` -- LabelList pattern reference
- Codebase inspection of `app/src/components/reports/OverviewTab.tsx` -- responsive grid layout pattern
- Codebase inspection of `app/src/components/reports/ByEmployeeTab.tsx` -- parallel drill-down pattern

### Secondary (MEDIUM confidence)
- None needed. All findings verified from codebase.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components already exist in the codebase and are well-tested
- Architecture: HIGH -- data already flows from API, only UI rendering changes needed
- Pitfalls: HIGH -- identified from direct codebase inspection of type mismatches and component contracts

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable -- no external dependencies, all internal components)
