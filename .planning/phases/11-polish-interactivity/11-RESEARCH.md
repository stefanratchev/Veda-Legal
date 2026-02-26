# Phase 11: Polish & Interactivity - Research

**Researched:** 2026-02-26
**Domain:** React component interactivity, Recharts bar click events, filter-driven summary stats
**Confidence:** HIGH

## Summary

Phase 11 adds two features to the existing Detail tab: (1) a summary stats row showing entry count, total hours, and total revenue (admin-only) that reacts to filter changes, and (2) chart bar click-to-filter functionality where clicking a bar toggles that entity as a filter in the FilterBar.

Both features build entirely on existing infrastructure. The `DetailTab` component already manages `FilterState` and derives `filteredEntries` via `useMemo`. Summary stats are a trivial computation over `filteredEntries`. The `BarChart` and `RevenueBarChart` components already accept `onBarClick` props and have cursor styling wired up. The only new work is: wiring `onBarClick` callbacks to update `FilterState`, adding visual feedback for active/selected bars via Recharts `Cell` `fillOpacity`, building a `SummaryStats` row component, and handling the "Other" aggregated bar (not clickable).

**Primary recommendation:** Add summary stats as a compact inline row between FilterBar and charts, wire `onBarClick` to toggle filter state, and dim unselected bars to 0.3 opacity when any bar in a chart category is selected.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- user granted full discretion on all implementation decisions.

### Claude's Discretion
User granted full discretion on all implementation decisions. Key areas to resolve during planning:

**Summary stats row:**
- Placement relative to FilterBar and charts
- Visual style (inline compact row vs stat cards)
- Which stats to display (entry count, total hours, total revenue for admins)
- How stats update when filters change (they should react to filtered data)

**Chart click-to-filter interaction:**
- Visual feedback for active/selected bars (highlight, dim others, border, etc.)
- Toggle mechanics (click to add filter, click again to remove)
- Handling of "Other" aggregated bar (not clickable since it represents multiple entities)
- How click-to-filter integrates with existing FilterBar state

**Active state indication on charts:**
- How filtered charts visually distinguish active vs inactive bars
- Whether dimming unselected bars, adding borders, or highlighting selected
- Coordination across all chart types (BarChart + RevenueBarChart)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DTAB-02 | User sees summary stats row (entry count, total hours, total revenue for admins) that updates with filters | Summary stats derived from `filteredEntries` in DetailTab; reuses SummaryCard pattern from OverviewTab or compact inline row |
| CHRT-07 | User can click a chart bar to toggle that entity as a filter | Both BarChart and RevenueBarChart already have `onBarClick` prop, `Cell` component, and cursor styling; wire to FilterState toggle |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | 3.6.0 | Bar chart rendering with Cell-level styling | Already in use; `Cell` component supports `fillOpacity` for per-bar dimming |
| React | 19.2.1 | Component framework with `useMemo` for derived state | Already in use; `useMemo` is the correct pattern for derived summary stats |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/date-utils` | (internal) | `formatHours()` for displaying hour values | Already imported in DetailTab |
| `@/lib/report-detail-utils` | (internal) | `filterEntries()` and aggregation functions | Already imported in DetailTab |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline summary row | Reuse `SummaryCard` from OverviewTab | SummaryCard has comparison badge support which is unused in Detail tab; simpler inline row is lighter weight and more compact |
| Per-bar `fillOpacity` dimming | CSS class-based highlighting | Recharts renders SVG; CSS classes would require custom className on Cell which Recharts doesn't support well; `fillOpacity` is the canonical approach |

**Installation:**
No new dependencies required. Everything uses existing libraries.

## Architecture Patterns

### Recommended Project Structure
No new files needed beyond potential `SummaryStats` component. All changes are within existing files:
```
components/reports/
├── DetailTab.tsx           # Add summary stats row, wire onBarClick callbacks
├── charts/BarChart.tsx     # Add activeIds prop for visual feedback
├── charts/RevenueBarChart.tsx  # Add activeIds prop for visual feedback
└── SummaryStats.tsx        # NEW: compact summary stats row component (optional - could inline in DetailTab)
```

### Pattern 1: Toggle Filter from Bar Click
**What:** Clicking a chart bar adds/removes that entity from the corresponding FilterState dimension
**When to use:** All six chart instances in DetailTab (3 hours + 3 revenue)
**Example:**
```typescript
// In DetailTab.tsx
const handleClientBarClick = useCallback((id: string) => {
  setFilters(prev => {
    const next = new Set(prev.clientIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return { ...prev, clientIds: next };
  });
}, []);
```

Key points:
- Hours-by-Client and Revenue-by-Client charts both call `handleClientBarClick`
- Hours-by-Employee and Revenue-by-Employee charts both call `handleEmployeeBarClick`
- Hours-by-Topic and Revenue-by-Topic charts both call `handleTopicBarClick`
- "Other" bars have no `id` -- the existing `handleClick` in BarChart/RevenueBarChart already guards `if (entry.id)`, so "Other" clicks are naturally ignored

### Pattern 2: Visual Feedback via Cell fillOpacity
**What:** When a filter is active for a chart dimension, highlight selected bars and dim others
**When to use:** BarChart and RevenueBarChart when `activeIds` prop is provided
**Example:**
```typescript
// In BarChart.tsx - add activeIds prop
interface BarChartProps {
  data: BarChartItem[];
  onBarClick?: (id: string) => void;
  activeIds?: Set<string>;  // NEW
  // ...existing props
}

// In the Cell rendering:
{chartData.map((item, index) => {
  const isActive = !activeIds || activeIds.size === 0 || activeIds.has(item.id ?? "");
  return (
    <Cell
      key={`cell-${index}`}
      fill={BAR_COLORS[index % BAR_COLORS.length]}
      fillOpacity={isActive ? 0.8 : 0.25}
    />
  );
})}
```

Key points:
- When `activeIds` is undefined or empty, all bars render at normal opacity (0.8) -- no visual change
- When `activeIds` has entries, only matching bars stay at 0.8; others dim to 0.25
- This applies to both BarChart and RevenueBarChart independently
- The "Other" bar (no id) is always dimmed when any filter is active, since it cannot be selected

### Pattern 3: Summary Stats from Filtered Data
**What:** Compute entry count, total hours, and total revenue from `filteredEntries`
**When to use:** Between FilterBar and chart grid in DetailTab
**Example:**
```typescript
// Derived from filteredEntries (already computed in DetailTab)
const summaryStats = useMemo(() => {
  const entryCount = filteredEntries.length;
  const totalHours = filteredEntries.reduce((sum, e) => sum + e.hours, 0);
  const totalRevenue = filteredEntries.reduce((sum, e) => sum + (e.revenue ?? 0), 0);
  const hasRevenue = filteredEntries.some(e => e.revenue !== null);
  return { entryCount, totalHours, totalRevenue: hasRevenue ? totalRevenue : null };
}, [filteredEntries]);
```

### Pattern 4: Mapping FilterState to activeIds per Chart
**What:** Each chart pair (hours + revenue) in a dimension gets the relevant activeIds from FilterState
**When to use:** When passing activeIds to chart components
**Example:**
```typescript
// Client charts get filters.clientIds
<BarChart data={clientHoursData} onBarClick={handleClientBarClick} activeIds={filters.clientIds} />
<RevenueBarChart data={clientRevenueData} onBarClick={handleClientBarClick} activeIds={filters.clientIds} />

// Employee charts get filters.employeeIds
<BarChart data={employeeHoursData} onBarClick={handleEmployeeBarClick} activeIds={filters.employeeIds} />

// Topic charts get filters.topicNames
<BarChart data={topicHoursData} onBarClick={handleTopicBarClick} activeIds={filters.topicNames} />
```

Note: The `activeIds` values are the **same Sets** already in `FilterState`. No additional mapping or transformation is needed.

### Anti-Patterns to Avoid
- **Separate click state from filter state:** Don't maintain a separate "selected bars" state that duplicates FilterState. The chart visual feedback should derive directly from `FilterState`, not a parallel state object. One source of truth.
- **Mutating Sets directly:** Always create a new Set when toggling (spread into new Set or clone), since React state must be immutable for re-render detection.
- **Adding click handlers to "Other" bars:** The "Other" bar represents aggregated data with no single ID. The existing guard `if (entry.id)` in both chart components already prevents this. Don't add special handling; just let the guard work.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Summary stats computation | Custom aggregation loop | `Array.reduce()` over `filteredEntries` | Simple reduce is sufficient; `filteredEntries` is already computed |
| Bar dimming visual | Custom SVG overlay or CSS | Recharts `Cell` `fillOpacity` prop | Native SVG attribute, no extra DOM elements, no CSS tricks |
| Click toggle mechanics | Complex event system | Set.has() + Set.delete() + Set.add() | Standard Set operations, no library needed |

**Key insight:** This phase has zero architectural complexity. Every building block exists. The work is purely wiring existing mechanisms together.

## Common Pitfalls

### Pitfall 1: Stale Closure in Toggle Handler
**What goes wrong:** Using `filters` directly in the toggle callback captures a stale closure
**Why it happens:** `useCallback` with `[filters]` dependency means a new function on every filter change; but if you forget the dependency, you get stale state
**How to avoid:** Use the functional form of `setFilters(prev => ...)` so the callback never reads stale `filters`. This also lets you use `useCallback` with `[]` dependencies for a stable reference.
**Warning signs:** Clicking a bar works once but subsequent clicks don't accumulate filters

### Pitfall 2: activeIds Mismatch Between Chart Data IDs and FilterState IDs
**What goes wrong:** The chart data `id` field doesn't match the FilterState Set values
**Why it happens:** For topics, FilterState uses `topicNames` (the topic name string), while chart data also uses `topicName` as `id` (see `aggregateByTopic`). But for clients, FilterState uses `clientIds` (UUIDs) while chart data has `id` set to `clientId`. These already align, but a mismatch would cause bars to never highlight.
**How to avoid:** Verify that `aggregateByClient` returns `id: clientId`, `aggregateByEmployee` returns `id: userId`, and `aggregateByTopic` returns `id: topicName` -- then confirm FilterState dimensions use the same keys. All three already match in the current codebase.
**Warning signs:** Bar click toggles the filter (data changes) but no bar highlights

### Pitfall 3: prepareBarData Loses IDs During "Other" Aggregation
**What goes wrong:** After `prepareBarData` runs with `maxBars`, items beyond the top N are merged into "Other" which has no `id`. If a filtered entity is in the "Other" bucket, its bar won't exist to highlight.
**Why it happens:** `prepareBarData` takes the top N by value and aggregates the rest. If a selected filter entity has low hours/revenue, it gets merged into "Other".
**How to avoid:** This is acceptable behavior. When a user clicks a bar to filter, the data re-aggregates and the filtered subset will show fewer bars (likely all within top N). The visual feedback uses `activeIds` which checks `item.id`, and "Other" has no id, so it naturally dims. No special handling needed.
**Warning signs:** None -- this is expected behavior

### Pitfall 4: Revenue Stats for Non-Admin
**What goes wrong:** Showing revenue to non-admin users
**Why it happens:** Summary stats computation doesn't check `isAdmin` before including revenue
**How to avoid:** Pass `isAdmin` to the summary stats component. Only render the revenue stat when `isAdmin` is true. The revenue value should still be computed (it's derived from entry data that includes `revenue: null` for non-admin), but the UI should gate display on `isAdmin`.
**Warning signs:** Non-admin users see a revenue number (likely `null` or 0)

### Pitfall 5: Chart Pair Click Handlers Diverge
**What goes wrong:** Hours-by-Client chart and Revenue-by-Client chart have different click handlers
**Why it happens:** Copy-paste error when wiring six charts
**How to avoid:** Each dimension (client/employee/topic) should have ONE handler shared by both hours and revenue charts. E.g., `handleClientBarClick` is used by both `clientHoursData` chart and `clientRevenueData` chart.
**Warning signs:** Clicking hours chart filters correctly but clicking revenue chart doesn't, or vice versa

## Code Examples

### Summary Stats Row (compact inline style)
```typescript
// Compact inline row matching the design system
<div className="flex items-center gap-6 px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded">
  <div>
    <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Entries</span>
    <span className="ml-2 text-sm font-medium text-[var(--text-primary)]">{summaryStats.entryCount}</span>
  </div>
  <div className="w-px h-4 bg-[var(--border-subtle)]" />
  <div>
    <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Hours</span>
    <span className="ml-2 text-sm font-medium text-[var(--text-primary)]">{formatHours(summaryStats.totalHours)}</span>
  </div>
  {isAdmin && summaryStats.totalRevenue !== null && (
    <>
      <div className="w-px h-4 bg-[var(--border-subtle)]" />
      <div>
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Revenue</span>
        <span className="ml-2 text-sm font-medium text-[var(--accent-pink)]">{formatCurrency(summaryStats.totalRevenue)}</span>
      </div>
    </>
  )}
</div>
```

### Toggle Handler with Stable Reference
```typescript
const handleClientBarClick = useCallback((id: string) => {
  setFilters(prev => {
    const next = new Set(prev.clientIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return { ...prev, clientIds: next };
  });
}, []);
```

### Cell with Active State
```typescript
// In BarChart.tsx Cell rendering
{chartData.map((item, index) => {
  const isActive =
    !activeIds || activeIds.size === 0 || (item.id != null && activeIds.has(item.id));
  return (
    <Cell
      key={`cell-${index}`}
      fill={BAR_COLORS[index % BAR_COLORS.length]}
      fillOpacity={isActive ? 0.8 : 0.25}
    />
  );
})}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts 2.x `onClick` on Bar | Recharts 3.x `onClick` on Bar (same API) | Recharts 3.0 (2024) | No breaking changes to click handler API |
| CSS-based bar highlighting | SVG `fillOpacity` via Cell props | Standard practice | More reliable in SVG rendering context |

**Deprecated/outdated:**
- None relevant. Recharts 3.x maintained backward compatibility for `Cell`, `Bar`, `onClick` APIs.

## Open Questions

1. **Summary stats: inline row vs SummaryCard grid?**
   - What we know: OverviewTab uses `SummaryCard` in a grid layout with comparison badges. Detail tab has no comparison data.
   - What's unclear: Whether to reuse `SummaryCard` (consistent look) or use a more compact inline row (less vertical space).
   - Recommendation: Use a compact inline row. SummaryCard's comparison badge support is wasted here, and the compact row uses less vertical space between FilterBar and charts. This is Claude's discretion per CONTEXT.md.

2. **Should chart click feedback coordinate across chart pairs?**
   - What we know: Client filter affects data in ALL charts (they all re-filter). But visual "active bar" highlighting should only show on the dimension being filtered.
   - What's unclear: If user clicks "Acme Corp" in Hours by Client chart, should Revenue by Client also highlight the Acme Corp bar?
   - Recommendation: Yes -- both charts in the same dimension share the same `activeIds` (both client charts use `filters.clientIds`). This naturally highlights the bar in both charts and provides consistent visual feedback. The employee and topic charts won't highlight because their activeIds (employeeIds, topicNames) are empty.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 + React Testing Library |
| Config file | `app/vitest.config.ts` |
| Quick run command | `npm run test -- --run DetailTab` |
| Full suite command | `npm run test -- --run` |
| Estimated runtime | ~5 seconds (single file), ~30 seconds (full suite) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DTAB-02 | Summary stats row shows entry count, total hours | unit | `npm run test -- --run DetailTab` | Yes (extend `DetailTab.test.tsx`) |
| DTAB-02 | Summary stats shows revenue for admin only | unit | `npm run test -- --run DetailTab` | Yes (extend `DetailTab.test.tsx`) |
| DTAB-02 | Summary stats update when filters change | unit | `npm run test -- --run DetailTab` | Yes (extend `DetailTab.test.tsx`) |
| CHRT-07 | Clicking a bar toggles it as filter | unit | `npm run test -- --run DetailTab` | Yes (extend `DetailTab.test.tsx`) |
| CHRT-07 | Clicking same bar again removes filter | unit | `npm run test -- --run DetailTab` | Yes (extend `DetailTab.test.tsx`) |
| CHRT-07 | "Other" bar click is ignored (no id) | unit | `npm run test -- --run BarChart` | No -- Wave 0 gap |
| CHRT-07 | Active bars show full opacity, inactive bars dim | unit | `npm run test -- --run BarChart` | No -- Wave 0 gap |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `npm run test -- --run DetailTab`
- **Full suite trigger:** Before merging final task of plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~5 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] Extend `DetailTab.test.tsx` with summary stats rendering tests
- [ ] Extend `DetailTab.test.tsx` with bar click-to-filter interaction tests
- [ ] Add `BarChart.test.tsx` for activeIds visual feedback (fillOpacity) -- currently no test file exists for BarChart

*(Note: Recharts is mocked in JSDOM tests, so fillOpacity tests will verify the Cell props are passed correctly rather than visual rendering. The onClick handler tests verify the callback is called with correct arguments.)*

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `app/src/components/reports/DetailTab.tsx` -- current filter state management, chart rendering
- Codebase inspection: `app/src/components/reports/charts/BarChart.tsx` -- existing `onBarClick` prop, `Cell` component with `fillOpacity`
- Codebase inspection: `app/src/components/reports/charts/RevenueBarChart.tsx` -- existing `onBarClick` prop, `Cell` component
- Codebase inspection: `app/src/components/reports/FilterBar.tsx` -- `FilterState` interface with `clientIds`, `employeeIds`, `topicNames` Sets
- Codebase inspection: `app/src/lib/report-detail-utils.ts` -- `filterEntries()`, `aggregateByClient/Employee/Topic()` with `id` fields
- Codebase inspection: `app/src/components/reports/OverviewTab.tsx` -- existing `SummaryCard` usage pattern
- Codebase inspection: `app/src/components/reports/SummaryCard.tsx` -- existing component with comparison badge support

### Secondary (MEDIUM confidence)
- Recharts 3.6.0 `Cell` component -- `fillOpacity` prop is standard SVG attribute passed through; verified by existing usage in codebase (`fillOpacity={0.8}`)
- Recharts `Bar` `onClick` API -- verified by existing usage in both BarChart and RevenueBarChart components

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new dependencies, all existing code
- Architecture: HIGH - all patterns verified in existing codebase, trivial wiring
- Pitfalls: HIGH - edge cases identified from actual code inspection (stale closures, id matching, "Other" bar)

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable -- no external dependencies to change)
