# Phase 02: Overview Revenue Charts - Research

**Researched:** 2026-02-24
**Domain:** Recharts bar charts, data transformation, responsive layout, admin-gated UI
**Confidence:** HIGH

## Summary

This phase adds two vertical bar charts (Revenue by Client, Revenue by Employee) to the existing Reports overview tab, visible only to Admin/Partner users. The data layer is already complete from Phase 1 -- the API returns per-client `revenue` (number) and per-employee `revenue` (number|null) fields. The work is purely frontend: extending the OverviewTab component to render revenue charts alongside the existing hours charts, with top-10 grouping, EUR formatting, and per-bar comparison % change badges.

The existing codebase uses Recharts 3.6.0 with a reusable `BarChart` wrapper component. The revenue charts need a vertical bar layout (distinct from the existing horizontal bar hours charts per CONTEXT.md), a new color (green/teal range for money, distinct from coral pink used for hours), custom EUR formatting with abbreviations, and per-bar comparison badges. The existing `BarChart` component will need to be either extended or a new `RevenueBarChart` component created. The comparison data for per-item revenue is already fetched by `ReportsContent` but not currently passed through to `OverviewTab` -- only the summary-level comparison data is threaded through.

**Primary recommendation:** Create a dedicated `RevenueBarChart` component (not overload the existing `BarChart`) that handles EUR formatting, top-10 + "Other" grouping, per-bar comparison badges, and the green/teal color scheme. Extend `OverviewTab` props to accept per-item comparison data from the already-fetched `comparisonData`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Paired rows: Hours by Client | Revenue by Client on row 1, Hours by Employee | Revenue by Employee on row 2
- No extra section headings -- each chart has its own title label (e.g., "Revenue by Client")
- On narrow/mobile screens, paired charts stack vertically (hours above revenue)
- Revenue charts use vertical bar charts (distinct from existing horizontal bar hours charts)
- Distinct accent color for revenue bars -- separate from coral pink used for hours (e.g., green/teal for money)
- Show top 10 clients/employees by revenue, group the rest as "Other"
- EUR labels abbreviated for large values (EUR 12.5K, EUR 1.2M); tooltip shows exact amount
- % change badge on each bar when comparison period is active (matches existing hours chart pattern)
- Clients/employees with zero revenue in current period are excluded from the chart (even if they had revenue in comparison period)
- New clients/employees with no comparison period data show no badge (omit rather than "New" label)
- Tooltip shows: current value + % change only (e.g., "EUR 12,450 (+22%)"), not both absolute values
- Revenue charts are not rendered at all for non-admin users (no empty placeholders)
- Hours charts remain at half width even when revenue charts are absent (consistent card size across roles)

### Claude's Discretion
- Exact accent color choice for revenue bars (within the dark theme design system)
- Loading skeleton design for revenue charts
- Error/empty state handling (no revenue data for period)
- Exact spacing, padding, and typography within charts

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REV-01 | Admin/Partner can see a Revenue by Client bar chart in overview tab showing hourlyRate x hours per client | API already returns `byClient[].revenue` (number). Filter to top 10 by revenue, group rest as "Other". Use vertical bar layout with green/teal color. |
| REV-02 | Admin/Partner can see a Revenue by Employee bar chart in overview tab showing proportional revenue per employee | API already returns `byEmployee[].revenue` (number\|null, number for admin). Same top-10 grouping and formatting as REV-01. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.6.0 | Bar chart rendering | Already installed and used for existing hours charts |
| React | 19+ | Component framework | Already the project's framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Intl.NumberFormat | Built-in | EUR currency formatting | Format tooltip exact amounts and abbreviated labels |

### No New Dependencies Required
The entire phase can be implemented with the existing installed packages. No additional libraries needed.

## Architecture Patterns

### Current OverviewTab Layout (Before)
```
[Summary Cards Row]
[Hours by Employee (BarChart horizontal)] | [Hours by Client (DonutChart)]
```

### Target OverviewTab Layout (After, Admin View)
```
[Summary Cards Row]
Row 1: [Hours by Client (horizontal bar)] | [Revenue by Client (vertical bar)]
Row 2: [Hours by Employee (horizontal bar)] | [Revenue by Employee (vertical bar)]
```

### Target OverviewTab Layout (After, Non-Admin View)
```
[Summary Cards Row]
[Hours by Employee (horizontal bar)] | [Hours by Client (donut)]
```
Non-admin view stays exactly the same -- revenue charts are simply not rendered.

### Recommended File Structure
```
app/src/components/reports/
  charts/
    BarChart.tsx              # Existing - no changes needed
    DonutChart.tsx            # Existing - no changes needed
    RevenueBarChart.tsx       # NEW - vertical bar chart with EUR formatting + comparison badges
  OverviewTab.tsx             # MODIFIED - new layout, accept revenue data + comparison per-item data
  ReportsContent.tsx          # MODIFIED - thread comparison byClient/byEmployee to OverviewTab
```

### Pattern 1: RevenueBarChart Component
**What:** A dedicated vertical bar chart for EUR revenue data with top-10 grouping, abbreviated labels, and per-bar comparison badges
**When to use:** Revenue by Client and Revenue by Employee charts
**Why separate from BarChart:** The existing `BarChart` handles hours with simple formatting. Revenue charts need: (1) top-10 + "Other" grouping logic, (2) EUR abbreviation formatting on axis labels, (3) per-bar comparison % change overlay, (4) custom tooltip with "current value + % change" format. Overloading the existing `BarChart` with all these features would make it complex and fragile.

**Example:**
```typescript
// Source: Codebase analysis of existing BarChart.tsx + CONTEXT.md decisions
interface RevenueBarChartProps {
  data: { name: string; value: number; id?: string }[];
  comparisonData?: { name: string; value: number }[];
  onBarClick?: (id: string) => void;
  maxBars?: number; // default 10
}

// EUR abbreviation formatter
function formatEurAbbreviated(value: number): string {
  if (value >= 1_000_000) return `\u20AC${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `\u20AC${(value / 1_000).toFixed(1)}K`;
  return `\u20AC${value.toLocaleString()}`;
}

// Exact EUR formatter for tooltips
function formatEurExact(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
```

### Pattern 2: Data Transformation for Top-10 + "Other"
**What:** Sort by revenue descending, take top 10, aggregate remaining into "Other"
**When to use:** Before passing data to RevenueBarChart
**Example:**
```typescript
function prepareRevenueData(
  items: { id: string; name: string; revenue: number | null }[]
): { name: string; value: number; id?: string }[] {
  // Filter out zero/null revenue
  const withRevenue = items.filter((item) => item.revenue && item.revenue > 0);
  // Sort descending
  const sorted = [...withRevenue].sort((a, b) => b.revenue! - a.revenue!);
  // Top 10 + Other
  const top = sorted.slice(0, 10).map((item) => ({
    name: item.name,
    value: item.revenue!,
    id: item.id,
  }));
  const rest = sorted.slice(10);
  if (rest.length > 0) {
    const otherTotal = rest.reduce((sum, item) => sum + item.revenue!, 0);
    top.push({ name: "Other", value: otherTotal });
  }
  return top;
}
```

### Pattern 3: Threading Comparison Data
**What:** Pass per-item comparison data from ReportsContent to OverviewTab
**When to use:** Required for per-bar % change badges
**Key insight:** `ReportsContent` already fetches the full `ReportData` for comparison (including `byClient` and `byEmployee` with revenue). Currently, `OverviewTab` only receives `comparison.summary`. The fix is to extend the `OverviewTabProps.comparison` type to include `byClient` and `byEmployee` arrays, then compute per-bar % change inside `OverviewTab` or `RevenueBarChart`.

```typescript
// Current OverviewTabProps.comparison type:
comparison: {
  summary: { totalHours: number; totalRevenue: number | null; activeClients: number };
} | null;

// Target OverviewTabProps.comparison type:
comparison: {
  summary: { totalHours: number; totalRevenue: number | null; activeClients: number };
  byClient: { id: string; name: string; revenue: number | null }[];
  byEmployee: { id: string; name: string; revenue: number | null }[];
} | null;
```

### Pattern 4: Per-Bar Comparison Badge
**What:** Overlay a small % change badge on each bar when comparison data is active
**When to use:** When `comparisonData` is provided to `RevenueBarChart`
**Implementation approach:** Match items by `id` between current and comparison data, compute `((current - previous) / previous) * 100`. Items with no match in comparison data get no badge (per CONTEXT.md decision).

Use Recharts' custom `label` prop on `<Bar>` to render badges, OR use a custom tooltip that shows the % change. The CONTEXT.md specifies: "% change badge on each bar" + "Tooltip shows: current value + % change only". This means both are needed:
1. A small visual badge/label on each bar showing the % change
2. A tooltip on hover showing exact EUR amount + % change

For the badge, use Recharts' `<Bar label>` with a custom render function, or `<LabelList>` component.

### Pattern 5: Responsive Layout
**What:** Paired charts in rows with mobile stacking
**When to use:** The chart grid in OverviewTab
**Example:**
```typescript
// Tailwind responsive: 1 column on mobile, 2 columns on md+
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Hours chart */}
  {/* Revenue chart (admin only) */}
</div>
```

### Anti-Patterns to Avoid
- **Overloading existing BarChart:** Don't add revenue-specific logic (EUR formatting, badges, top-10 grouping) to the existing hours `BarChart`. It would make the component unwieldy and create coupling.
- **Dual-axis charts:** CONTEXT.md explicitly prohibits dual-axis -- revenue charts must be separate.
- **Fetching additional data:** All revenue data already exists in the API response. Do not add new API endpoints or queries.
- **Rendering revenue charts for non-admins then hiding:** The revenue data is `null` for non-admins at the API level. Don't render-and-hide; conditionally render based on `isAdmin`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency formatting | Custom string manipulation | `Intl.NumberFormat` with `style: "currency"` | Handles localization, grouping separators, edge cases |
| Chart rendering | Custom SVG bars | Recharts `<BarChart>` + `<Bar>` | Already used in project, handles responsive sizing, tooltips, animation |
| Top-N grouping | N/A (simple enough) | Inline utility function | Only 5-10 lines of code, not worth a library |
| Responsive grid | Custom media queries | Tailwind `grid-cols-1 md:grid-cols-2` | Already the project's CSS framework |

**Key insight:** This phase requires no new libraries. Recharts and Intl.NumberFormat handle everything.

## Common Pitfalls

### Pitfall 1: Revenue Data is `null` for Non-Admin
**What goes wrong:** Attempting to render revenue charts or format `null` as currency crashes the component.
**Why it happens:** The API returns `revenue: null` for non-admin users at both summary and per-item levels. The `OverviewTab` already receives `isAdmin` but the revenue data itself can be null.
**How to avoid:** Gate rendering with `isAdmin` check BEFORE accessing revenue data. Use the existing pattern from the summary card: `{isAdmin && <RevenueChart ... />}`.
**Warning signs:** TypeScript will flag `number | null` access if you try to use it as number.

### Pitfall 2: Comparison Data Matching by ID, Not Name
**What goes wrong:** Matching current and comparison items by `name` instead of `id` causes mismatches when a client/employee name changes between periods.
**Why it happens:** Names are display strings. IDs are stable identifiers.
**How to avoid:** Always match comparison items by `id`. Build a `Map<string, number>` from comparison data keyed by `id`.
**Warning signs:** % change badges showing on wrong items or missing entirely.

### Pitfall 3: "Other" Category in Comparison
**What goes wrong:** The "Other" category in the current period doesn't have a single ID, so comparison matching fails.
**Why it happens:** "Other" is an aggregation of multiple items that may differ between periods.
**How to avoid:** Don't show a comparison badge on the "Other" bar. It's an aggregate that isn't directly comparable across periods.
**Warning signs:** Misleading % change on the "Other" bar.

### Pitfall 4: Empty Revenue Period
**What goes wrong:** Revenue chart shows nothing or crashes when no REGULAR clients have entries in the period.
**Why it happens:** All entries might be for INTERNAL/MANAGEMENT clients, or all might be written off.
**How to avoid:** Handle the empty state gracefully -- show a "No revenue data" message in the chart card, similar to the existing "No data" state in `BarChart`.
**Warning signs:** Blank chart area with no feedback to the user.

### Pitfall 5: EUR Abbreviation Edge Cases
**What goes wrong:** Values like EUR 999 show as "EUR 0.9K" or EUR 12,345,678 shows incorrectly.
**Why it happens:** Thresholds in the abbreviation logic don't handle boundary values well.
**How to avoid:** Test abbreviation formatter with boundary values: 0, 100, 999, 1000, 999999, 1000000. Use `toFixed(1)` and trim trailing ".0" for clean display.
**Warning signs:** Labels looking odd at specific value ranges.

### Pitfall 6: Recharts Re-render Performance
**What goes wrong:** Revenue charts re-render unnecessarily when unrelated state changes (tab switches, date picker interaction).
**Why it happens:** Inline data transformations (filter, sort, map) create new array references on every render.
**How to avoid:** Use `useMemo` for the data transformation functions (prepareRevenueData). The `RevenueBarChart` component should receive stable references.
**Warning signs:** Visible chart re-animation when switching comparison types.

### Pitfall 7: Layout Shift on Admin vs Non-Admin
**What goes wrong:** Hours charts change width or position depending on whether revenue charts are rendered.
**Why it happens:** Grid layout changes when revenue columns are absent.
**How to avoid:** Per CONTEXT.md: "Hours charts remain at half width even when revenue charts are absent." For non-admin, keep `grid-cols-2` but only render hours charts (they'll each take one column).
**Warning signs:** Different chart sizes when logged in as admin vs non-admin.

## Code Examples

### EUR Abbreviation Formatter
```typescript
// Utility function for chart axis labels
function formatEurAbbreviated(value: number): string {
  if (value >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(1);
    return `\u20AC${formatted.replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    const formatted = (value / 1_000).toFixed(1);
    return `\u20AC${formatted.replace(/\.0$/, "")}K`;
  }
  return `\u20AC${Math.round(value).toLocaleString()}`;
}
// Examples: formatEurAbbreviated(12500) => "\u20AC12.5K"
//           formatEurAbbreviated(1200000) => "\u20AC1.2M"
//           formatEurAbbreviated(850) => "\u20AC850"
```

### Exact EUR Formatter (for tooltips)
```typescript
// Reuse the pattern from ByClientTab.tsx
function formatEurExact(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
// Examples: formatEurExact(12450) => "\u20AC12,450"
```

### Custom Tooltip with % Change
```typescript
// Source: Recharts <Tooltip> content prop pattern
interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; payload: { name: string; percentChange?: number | null } }[];
}

function RevenueTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const { value, payload: item } = payload[0];
  const changeStr = item.percentChange != null
    ? ` (${item.percentChange > 0 ? "+" : ""}${item.percentChange.toFixed(0)}%)`
    : "";

  return (
    <div
      style={{
        backgroundColor: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "4px",
        padding: "8px 12px",
        fontSize: "12px",
      }}
    >
      <div style={{ color: "var(--text-primary)", marginBottom: 2 }}>{item.name}</div>
      <div style={{ color: "var(--text-secondary)" }}>
        {formatEurExact(value)}{changeStr}
      </div>
    </div>
  );
}
```

### Recharts LabelList for Per-Bar Badge
```typescript
// Source: Recharts API - LabelList for custom labels on bars
import { LabelList } from "recharts";

// Inside <Bar>:
<Bar dataKey="value" fill={revenueColor} radius={[4, 4, 0, 0]}>
  <LabelList
    dataKey="percentChange"
    position="top"
    content={({ value, x, y, width }) => {
      if (value == null) return null;
      const isPositive = (value as number) > 0;
      const color = isPositive ? "var(--success)" : "var(--danger)";
      const text = `${isPositive ? "+" : ""}${(value as number).toFixed(0)}%`;
      return (
        <text
          x={(x as number) + (width as number) / 2}
          y={(y as number) - 6}
          fill={color}
          textAnchor="middle"
          fontSize={10}
        >
          {text}
        </text>
      );
    }}
  />
</Bar>
```

### Color Choice for Revenue Bars
```typescript
// Recommendation: Use a teal/emerald green that complements the dark theme
// and is clearly distinct from --accent-pink (#FF9999)
const REVENUE_COLOR = "#4ECDC4"; // Teal - money association, good contrast on dark
// Alternative: var(--success) = #4a9d6e -- but this is semantic for "good/pass"
// and might conflict with the green used in comparison arrows

// Recommendation: Use #4ECDC4 (teal) as primary, with 0.8 opacity to match
// the existing BarChart pattern: fillOpacity={0.8}
```

### Extended OverviewTab Props
```typescript
interface OverviewTabProps {
  data: {
    summary: {
      totalHours: number;
      totalRevenue: number | null;
      activeClients: number;
    };
    byEmployee: { id: string; name: string; totalHours: number; revenue: number | null }[];
    byClient: { id: string; name: string; totalHours: number; revenue: number | null }[];
  };
  comparison: {
    summary: {
      totalHours: number;
      totalRevenue: number | null;
      activeClients: number;
    };
    byClient: { id: string; name: string; revenue: number | null }[];
    byEmployee: { id: string; name: string; revenue: number | null }[];
  } | null;
  comparisonLabel: string;
  isAdmin: boolean;
  onEmployeeClick: (id: string) => void;
  onClientClick: (id: string) => void;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts 2.x Cell-based coloring | Recharts 3.x same API (Cell still works) | Recharts 3.0 (2024) | No migration needed, API stable |
| Custom tooltip with `formatter` | Custom `content` prop for full control | Always available | Better for complex tooltips with % change |
| Separate comparison API calls | Already parallel-fetched in ReportsContent | Phase 1 | No new API work needed |

**Deprecated/outdated:**
- Nothing deprecated in the current stack. Recharts 3.6.0 is current and the APIs used (`BarChart`, `Bar`, `Tooltip`, `ResponsiveContainer`, `XAxis`, `YAxis`, `Cell`, `LabelList`) are all stable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 + React Testing Library 16.3.1 |
| Config file | `app/vitest.config.ts` |
| Quick run command | `npm run test -- --run OverviewTab` (from app/) |
| Full suite command | `npm run test -- --run` (from app/) |
| Estimated runtime | ~5-10 seconds for targeted, ~30s for full suite |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REV-01 | Revenue by Client chart renders for admin with correct data | unit | `npm run test -- --run RevenueBarChart` | No - Wave 0 gap |
| REV-01 | Revenue by Client chart NOT rendered for non-admin | unit | `npm run test -- --run OverviewTab` | No - Wave 0 gap |
| REV-01 | Top-10 grouping with "Other" aggregation | unit | `npm run test -- --run RevenueBarChart` | No - Wave 0 gap |
| REV-01 | EUR abbreviation formatting | unit | `npm run test -- --run RevenueBarChart` | No - Wave 0 gap |
| REV-02 | Revenue by Employee chart renders for admin | unit | `npm run test -- --run RevenueBarChart` | No - Wave 0 gap |
| REV-01/02 | Per-bar comparison badge when comparison active | unit | `npm run test -- --run RevenueBarChart` | No - Wave 0 gap |
| REV-01/02 | No badge when no comparison match | unit | `npm run test -- --run RevenueBarChart` | No - Wave 0 gap |
| REV-01/02 | Empty state when no revenue data | unit | `npm run test -- --run OverviewTab` | No - Wave 0 gap |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task, run: `cd /Users/stefan/projects/veda-legal-timesheets/app && npm run test -- --run`
- **Full suite trigger:** Before merging final task
- **Phase-complete gate:** Full suite green before `/gsd:verify-work`
- **Estimated feedback latency per task:** ~10 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `app/src/components/reports/charts/RevenueBarChart.test.tsx` -- covers REV-01, REV-02 (chart rendering, formatting, grouping, badges)
- [ ] `app/src/components/reports/OverviewTab.test.tsx` -- covers admin vs non-admin rendering, layout, data threading
- [ ] EUR formatting utility tests (can be inline in RevenueBarChart test or a separate `revenue-utils.test.ts`)

Note: Recharts components render SVGs in jsdom which can be tested for presence/attributes but not pixel-perfect visuals. Focus tests on: (1) conditional rendering based on `isAdmin`, (2) data transformation correctness (top-10 grouping, "Other" aggregation), (3) formatter output, (4) comparison badge computation logic.

## Open Questions

1. **Chart height for revenue charts**
   - What we know: Existing hours charts use `h-64` (256px height). Revenue charts should probably match.
   - What's unclear: With more charts (4 total for admin), the overview tab becomes taller. Is this acceptable?
   - Recommendation: Use `h-64` to match existing charts. The vertical scroll is fine for a reports page.

2. **Hours chart type change (Client)**
   - What we know: Currently "Hours by Client" uses a `DonutChart`, but CONTEXT.md says "Paired rows: Hours by Client | Revenue by Client on row 1". The decision says revenue charts use vertical bars while hours charts use horizontal bars. The current DonutChart for "Hours by Client" would need to change to a horizontal bar chart to match the "Hours by Employee" chart pattern and create consistent pairing.
   - What's unclear: Does the user want to keep the DonutChart for Hours by Client, or switch it to a horizontal bar chart for consistency with the paired layout?
   - Recommendation: Switch "Hours by Client" from DonutChart to horizontal BarChart (matching "Hours by Employee") to create a consistent paired layout. This maintains the "horizontal bar for hours, vertical bar for revenue" distinction. Flag this decision for the planner.

3. **Revenue color CSS variable**
   - What we know: The design system has `--accent-pink`, `--success`, `--info` as defined colors. There's no existing revenue/money color variable.
   - What's unclear: Should we add a new CSS variable (e.g., `--accent-revenue: #4ECDC4`) to the design system, or just use the color directly?
   - Recommendation: Add `--accent-revenue` to the CSS variables in `globals.css` for consistency with the design system pattern. This is Claude's discretion per CONTEXT.md.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `app/src/components/reports/OverviewTab.tsx` -- current layout and props
- Codebase analysis: `app/src/components/reports/charts/BarChart.tsx` -- existing Recharts usage patterns
- Codebase analysis: `app/src/components/reports/ReportsContent.tsx` -- data flow and comparison threading
- Codebase analysis: `app/src/app/api/reports/route.ts` -- API response shape with revenue fields
- Codebase analysis: `app/src/app/globals.css` -- design system CSS variables
- Codebase analysis: `app/src/components/reports/ByClientTab.tsx` -- existing EUR formatting pattern
- Codebase analysis: `app/vitest.config.ts` -- test framework configuration

### Secondary (MEDIUM confidence)
- Recharts 3.x API: BarChart, Bar, LabelList, Tooltip (content prop), ResponsiveContainer -- stable APIs from v2 through v3

### Tertiary (LOW confidence)
- None -- all findings based on codebase analysis and established Recharts patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Recharts 3.6.0 already installed, no new deps needed
- Architecture: HIGH -- clear extension of existing patterns, data already available from Phase 1
- Pitfalls: HIGH -- identified from direct codebase analysis of data shapes and null handling
- Validation: HIGH -- Vitest + RTL already configured, known testing patterns from route.test.ts

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable -- no fast-moving dependencies)
