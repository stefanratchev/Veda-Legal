# Stack Research

**Domain:** Legal practice reporting dashboard (advanced charts, revenue views, data aggregation)
**Researched:** 2026-02-24
**Confidence:** HIGH

## Executive Summary

This milestone does NOT require new dependencies. The existing stack (Recharts 3.6.0, Drizzle ORM 0.45.1, Next.js 16) covers every requirement. The work is pattern-based: new chart components using existing Recharts primitives, new SQL aggregation queries using existing Drizzle helpers, and new API response shapes. The only optional action is bumping Recharts from 3.6.0 to 3.7.0 for minor bug fixes (not blocking).

## Recommended Stack

### Core Technologies (Already Installed -- No Changes)

| Technology | Installed | Latest | Purpose | Status |
|------------|-----------|--------|---------|--------|
| Recharts | 3.6.0 | 3.7.0 | All chart rendering (bar, donut, area/line) | Keep. Optional bump to 3.7.0 for stacked charts improvements. |
| Drizzle ORM | 0.45.1 | 0.45.1 | SQL queries with type-safe aggregation (sum, count, groupBy) | Keep. Already at latest. |
| Next.js | 16.0.10 | 16.0.10 | App Router, Server Components for data fetching | Keep. No changes needed. |
| React | 19.2.1 | 19.2.1 | UI rendering | Keep. |
| TypeScript | 5.x | 5.x | Type safety for chart data shapes and API contracts | Keep. |

**Confidence: HIGH** -- Verified installed versions via `npm ls`, latest versions via `npm view`.

### Supporting Libraries (None Needed)

No new supporting libraries are required. Here's why each potential addition was rejected:

| Considered | Version | Purpose | Why NOT Needed |
|------------|---------|---------|----------------|
| `date-fns` | 4.x | Date manipulation for time series x-axis | Project already has `date-utils.ts` with all needed date functions. Recharts handles date formatting on axes natively. |
| `@tanstack/react-table` | 8.x | Sortable/paginated tables for entry lists | Existing `DataTable` component in `components/ui/` and plain HTML tables in drill-downs are sufficient for ~200 clients / ~10 employees. Scale doesn't justify the abstraction. |
| `shadcn/ui charts` | latest | Recharts wrapper with design tokens | Project already uses raw Recharts with CSS variables for theming. shadcn charts is a thin wrapper, not worth adopting mid-project. Would add inconsistency with existing chart components. |
| `d3-scale` / `d3-time` | 7.x | Time scale formatting | Recharts handles this internally (uses d3 submodules under the hood). No direct d3 usage needed. |

**Confidence: HIGH** -- Each rejection based on examination of existing codebase components.

## Chart Patterns for This Milestone

### Pattern 1: Grouped Bar Chart for Estimated vs Actual Revenue

**Use case:** Revenue by Client chart, Revenue by Employee chart (overview tab).

**Approach:** Use Recharts `BarChart` with two `Bar` children, each with a different `dataKey`. This renders side-by-side bars per category without any `stackId` (stacking would mislead -- estimated and actual are alternatives, not additive).

```typescript
// Data shape
interface RevenueChartData {
  name: string;          // Client or employee name
  id: string;            // For click-through
  estimated: number;     // rate x hours
  actual: number | null; // from finalized SDs, null if none
}

// Chart structure
<BarChart data={data} barGap={2} barCategoryGap="15%">
  <XAxis dataKey="name" />
  <YAxis tickFormatter={formatCurrency} />
  <Tooltip content={<RevenueTooltip />} />
  <Legend />
  <Bar dataKey="estimated" name="Estimated" fill="var(--accent-pink)" fillOpacity={0.4} radius={[4,4,0,0]} />
  <Bar dataKey="actual" name="Billed" fill="var(--accent-pink)" fillOpacity={0.9} radius={[4,4,0,0]} />
</BarChart>
```

**Why grouped bars, not ComposedChart with line overlay:**
- Both metrics are the same unit (EUR) and roughly the same scale
- Side-by-side bars make comparison intuitive ("this client: estimated X, billed Y")
- A line overlaid on bars is harder to read when values are similar

**Why not stacked bars:**
- Estimated and actual are not additive -- they're two ways of measuring the same thing
- Stacking would imply total = estimated + actual, which is meaningless

**Confidence: HIGH** -- Recharts grouped bars pattern is well-documented and the project already uses the `BarChart` component.

### Pattern 2: Area Chart for Hours Over Time Trends

**Use case:** Client drill-down hours trend, Employee drill-down hours trend.

**Approach:** Use Recharts `AreaChart` with a single `Area` child. Area (vs Line) provides better visual weight for time series in dark themes. Use gradient fill for the area below the line.

```typescript
// Data shape
interface TrendData {
  date: string;   // "2026-02-01" (or formatted "1 Feb")
  hours: number;
}

// Chart structure
<AreaChart data={data}>
  <defs>
    <linearGradient id="hoursGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="var(--accent-pink)" stopOpacity={0.3} />
      <stop offset="95%" stopColor="var(--accent-pink)" stopOpacity={0} />
    </linearGradient>
  </defs>
  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
  <YAxis tickFormatter={formatHours} />
  <Tooltip />
  <Area
    type="monotone"
    dataKey="hours"
    stroke="var(--accent-pink)"
    fill="url(#hoursGradient)"
    strokeWidth={2}
  />
</AreaChart>
```

**Why AreaChart, not LineChart:**
- Area fills provide better visual hierarchy on dark backgrounds
- The gradient gives a sense of volume/magnitude that pure lines lack
- Already using the same visual language as the design system's accent colors

**Why not BarChart for trends:**
- Time series with many points (30 days in a month) creates too many thin bars
- Line/area communicates "trend over time" more intuitively than bars

**Confidence: HIGH** -- AreaChart is a standard Recharts component. Gradient fill pattern is widely documented.

### Pattern 3: Horizontal Bar Chart for Topic Breakdowns

**Use case:** Client drill-down topic breakdown, Employee drill-down topic breakdown.

**Approach:** Reuse the existing `BarChart` component (already in `charts/BarChart.tsx`) with `layout="vertical"`. This component already supports vertical layout, click handlers, and custom value formatting.

```typescript
// Data shape -- same as existing BarChart interface
const topicData = [
  { name: "Company Incorporation", value: 12.5, id: "topic-1" },
  { name: "M&A Advisory", value: 8.25, id: "topic-2" },
  // ...
];

// Reuse existing component
<BarChart data={topicData} valueFormatter={formatHours} layout="vertical" />
```

**Why reuse existing BarChart:**
- Already handles both horizontal and vertical layouts
- Already styled with project's CSS variables
- Already supports click-through via `onBarClick`
- No need for a new component

**Confidence: HIGH** -- Component already exists and works.

### Pattern 4: Custom Tooltip for Dual-Metric Charts

**Use case:** Revenue charts need tooltips showing both estimated and actual values with labels.

**Approach:** Create a custom tooltip component that receives the standard Recharts `active`, `payload`, `label` props. Style it to match the existing tooltip pattern in the codebase.

```typescript
interface RevenueTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function RevenueTooltip({ active, payload, label }: RevenueTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: "var(--bg-elevated)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "4px",
      padding: "8px 12px",
      fontSize: "12px",
    }}>
      <p style={{ color: "var(--text-primary)", marginBottom: 4 }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color || "var(--text-secondary)" }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}
```

**Confidence: HIGH** -- Existing tooltips in codebase use inline `contentStyle`/`labelStyle` approach. Custom content tooltip is standard Recharts pattern.

## Data Aggregation Strategy

### Server-Side Aggregation with Drizzle ORM

**Principle:** All aggregation runs server-side in the API route. The client receives pre-computed chart-ready data. No client-side aggregation beyond what already exists in the current drill-down components.

**Why server-side:**
- Drizzle ORM's `groupBy` + `sum()` + `count()` map directly to PostgreSQL GROUP BY queries
- ~10 employees and ~200 clients means aggregation is fast (< 50ms even without optimization)
- Avoids shipping raw entry data to the client for topic/employee/client breakdowns
- Keeps the API as the single source of truth for calculations

### Aggregation Queries Needed

**1. Topic breakdown per client (new query)**

```typescript
import { sum, eq, and, gte, lte } from "drizzle-orm";

// Group time entries by topicName for a given client and date range
const topicBreakdown = await db
  .select({
    topicName: timeEntries.topicName,
    totalHours: sum(timeEntries.hours),
  })
  .from(timeEntries)
  .where(and(
    eq(timeEntries.clientId, clientId),
    gte(timeEntries.date, startStr),
    lte(timeEntries.date, endStr),
  ))
  .groupBy(timeEntries.topicName);
```

**2. Topic breakdown per employee (new query)**

```typescript
// Group time entries by topicName for a given employee across all clients
const topicBreakdown = await db
  .select({
    topicName: timeEntries.topicName,
    totalHours: sum(timeEntries.hours),
  })
  .from(timeEntries)
  .where(and(
    eq(timeEntries.userId, employeeId),
    gte(timeEntries.date, startStr),
    lte(timeEntries.date, endStr),
  ))
  .groupBy(timeEntries.topicName);
```

**3. Actual revenue from finalized service descriptions (new query)**

```typescript
// Fetch finalized SDs overlapping the date range with their topics and line items
const finalizedSDs = await db.query.serviceDescriptions.findMany({
  where: and(
    eq(serviceDescriptions.status, "FINALIZED"),
    // SD periods overlapping the report date range
    lte(serviceDescriptions.periodStart, endStr),
    gte(serviceDescriptions.periodEnd, startStr),
  ),
  with: {
    client: { columns: { id: true, name: true } },
    topics: {
      with: { lineItems: true },
    },
  },
});

// Calculate actual revenue per client using existing billing-pdf.tsx functions
for (const sd of finalizedSDs) {
  const isRetainer = sd.retainerFee != null && sd.retainerHours != null;
  const total = isRetainer
    ? calculateRetainerGrandTotal(sd.topics, ...)
    : calculateGrandTotal(sd.topics, sd.discountType, sd.discountValue);
  // Map to client ID for the revenue chart
}
```

**Why reuse `calculateGrandTotal` / `calculateRetainerGrandTotal`:**
- These functions already handle ALL billing complexity: caps, discounts, waivers, retainer logic
- Re-implementing the calculation would create divergence from invoice/PDF amounts
- They are pure functions that accept data, not tied to any UI or DB context

**Confidence: HIGH** -- Drizzle aggregation helpers verified via official docs. Billing functions already exist in codebase.

### API Response Shape Changes

The current `/api/reports` endpoint returns a flat structure. For this milestone, extend the response rather than creating new endpoints:

```typescript
interface ReportData {
  // Existing fields (unchanged)
  summary: { totalHours; totalRevenue; activeClients; };
  byEmployee: EmployeeStats[];
  byClient: ClientStats[];
  entries: Entry[];

  // New fields
  revenueByClient: { id; name; estimated; actual: number | null }[];
  revenueByEmployee: { id; name; estimated; actual: number | null }[];
}

// Extended EmployeeStats (add to existing)
interface EmployeeStats {
  // ...existing fields...
  topicBreakdown: { topicName: string; hours: number }[];
}

// Extended ClientStats (add to existing)
interface ClientStats {
  // ...existing fields...
  topicBreakdown: { topicName: string; hours: number }[];
  dailyHours: { date: string; hours: number }[];
}

// Extended Entry (add topic column)
interface Entry {
  // ...existing fields...
  topicName: string | null;
}
```

**Why extend existing endpoint, not add new ones:**
- Current pattern is one fetch per date range change
- Adding separate endpoints would increase network requests and complexity
- Data size is small (~10 employees, ~200 clients, ~few hundred entries per month)
- Adding topic breakdowns and revenue data adds minimal payload

**Confidence: HIGH** -- Based on current API structure and data volume constraints.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Recharts 3.6.0 (current) | Upgrade to 3.7.0 | 3.7.0 has stacked charts fixes but nothing blocking this milestone. Optional bump, not required. |
| Recharts BarChart with two Bars | ComposedChart (Bar + Line) | Both metrics are EUR at similar scale. Side-by-side bars communicate comparison better than bar+line overlay. |
| AreaChart for time trends | LineChart | Area fills work better on dark backgrounds. Same API, just different visual weight. |
| Server-side aggregation in API route | Client-side aggregation in React | Server-side is already the pattern. Client-side would ship more data and duplicate logic. |
| Extend existing `/api/reports` endpoint | New `/api/reports/revenue` endpoint | One-call pattern is simpler. Data volume is trivially small. |
| Drizzle `groupBy` + `sum()` | Raw SQL via `db.execute()` | Drizzle's type-safe helpers are sufficient. Raw SQL adds type-safety risk for no benefit at this scale. |
| Reuse existing `BarChart` component for topics | New `TopicBreakdownChart` component | Existing component already handles vertical layout and all needed features. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `victory-charts` / `nivo` / `@visx` | Project is already on Recharts. Mixing chart libraries creates inconsistent styling and bundle bloat. | Recharts 3.6.0 (already installed) |
| `shadcn/ui charts` | Thin wrapper over Recharts. Project already uses raw Recharts with CSS variables. Adopting mid-project adds inconsistency. shadcn is still migrating to Recharts v3 -- potential compat issues. | Raw Recharts components styled with existing CSS vars |
| Dual Y-axis charts | Dual axes are notoriously misleading (you can make any two series appear correlated by adjusting scales). Not needed here since estimated and actual revenue share the same unit and scale. | Grouped bars with single Y-axis |
| Client-side SQL (e.g., `sql.js`, `@electric-sql/pglite`) | Over-engineered for ~10 employees. Server queries take < 50ms. | Server-side Drizzle queries |
| `@tanstack/react-table` for entry tables | Current HTML tables are sufficient. ~200 clients with perhaps 50-100 entries per month in a drill-down doesn't need virtual scrolling or complex table state management. | Plain HTML `<table>` with existing styling |
| `react-window` / `react-virtualized` for long entry lists | "All entries for period" means hundreds, not thousands. Browser renders this fine without virtualization. | Scrollable `<table>` or paginated view if needed later |

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| recharts@3.6.0 | 3.6.0 | React 19.2.1 | Recharts 3.x supports React 18+. Verified working in current codebase. |
| recharts@3.7.0 | 3.7.0 | React 19.2.1 | Safe upgrade if desired. No breaking changes between 3.6.0 and 3.7.0. |
| drizzle-orm@0.45.1 | 0.45.1 | pg@8.16.3, drizzle-kit@0.31.8 | Already at latest. `sum()`, `count()`, `groupBy()` all available. |

## Installation

```bash
# No new packages needed. Zero npm installs for this milestone.

# Optional: Bump Recharts from 3.6.0 to 3.7.0 for minor improvements
npm install recharts@3.7.0
```

## Sources

- [Recharts BarChart API](https://recharts.github.io/en-US/api/BarChart/) -- Grouped bars via multiple `<Bar>` children, `barGap` and `barCategoryGap` props (HIGH confidence)
- [Recharts ComposedChart API](https://recharts.github.io/en-US/api/ComposedChart/) -- Combining chart types in single view (HIGH confidence)
- [Recharts AreaChart API](https://recharts.github.io/en-US/api/AreaChart/) -- Area chart for time trends (HIGH confidence)
- [Recharts GitHub Releases](https://github.com/recharts/recharts/releases) -- Version 3.7.0 latest, 3.6.0 installed (HIGH confidence)
- [Recharts 3.0 Migration Guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) -- State management rewrite, no breaking changes since 3.0 (HIGH confidence)
- [Drizzle ORM Select Docs](https://orm.drizzle.team/docs/select) -- `groupBy()`, `sum()`, `count()`, `having()` syntax (HIGH confidence)
- [Grouped Stacked Bar Charts with Recharts](https://spin.atomicobject.com/stacked-bar-charts-recharts/) -- Pattern for multiple Bar components with different stackIds (MEDIUM confidence -- blog post, but matches official API)
- [Recharts Custom Tooltip API](https://recharts.github.io/en-US/api/Tooltip/) -- Custom `content` prop for tooltips (HIGH confidence)
- npm registry verified via `npm view`: recharts@3.7.0, drizzle-orm@0.45.1 (HIGH confidence)
- Installed versions verified via `npm ls`: recharts@3.6.0, drizzle-orm@0.45.1 (HIGH confidence)

---
*Stack research for: Legal practice reporting dashboard*
*Researched: 2026-02-24*
