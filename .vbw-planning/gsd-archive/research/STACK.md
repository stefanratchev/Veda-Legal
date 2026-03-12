# Stack Research

**Domain:** Reports Detail View -- multi-select filters, chart-filter interactivity, topic aggregation
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

No new npm packages are needed. The v1.2 Detail tab requires three capabilities -- multi-select filter dropdowns, filter-driven chart/table updates, and topic-level aggregation -- all achievable with existing dependencies and patterns already established in the codebase.

**Multi-select filters:** Build a custom `MultiSelect` component following the existing `ClientSelect` pattern (dropdown with search, keyboard navigation, `useClickOutside`). The project has ~10 employees, ~200 clients, and ~30 topics -- trivially small lists that do not need virtualization or a heavyweight select library. The existing component handles the hard UX problems (search, keyboard nav, scroll-into-view, close-on-outside-click) and extending it to multi-select is ~50 lines of delta.

**Chart-filter state management:** React `useState` with `useMemo`-derived filtered data, matching the existing pattern in `ReportsContent.tsx`. Filter state is three arrays (`selectedClientIds: string[]`, `selectedEmployeeIds: string[]`, `selectedTopicNames: string[]`). Filtered entries flow through `useMemo` into both charts and the DataTable. No state management library, URL state sync, or context provider needed -- the Detail tab is a single component tree with one source of truth.

**Topic aggregation:** The API already returns `topicName` on every `ReportEntry` and `topics: TopicAggregation[]` on both `ClientStats` and `EmployeeStats`. The Detail tab's "by Topic" charts aggregate from the filtered entries client-side using `Array.reduce()` -- the same pattern used by `ByClientTab` and `ByEmployeeTab` for their drill-down charts. No API changes needed.

## Recommended Stack

### Core Technologies (Already Installed -- No Changes)

| Technology | Version | Purpose | Why Sufficient |
|------------|---------|---------|----------------|
| React | 19.2.1 | `useState` + `useMemo` for filter state and derived filtered data | 3 filter arrays + 1 `useMemo` per chart. Same pattern as existing `OverviewTab`. No state library needed for this complexity. |
| Recharts | 3.6.0 | `BarChart` and `RevenueBarChart` components for all six Detail charts | Existing chart components accept `data: BarChartItem[]` -- pass filtered/aggregated data. No new chart types. |
| Next.js | 16.0.10 | App Router, client components | Detail tab is a client component like existing tabs. No server component changes. |
| TypeScript | 5.x | Type-safe filter state, aggregation functions | Existing `ReportEntry`, `ReportData`, `TopicAggregation` types cover all data shapes. |
| Tailwind CSS | 4.x | Multi-select dropdown styling | Follow existing `ClientSelect` CSS patterns (dark theme variables, `animate-fade-up`). |

**Confidence: HIGH** -- All versions verified from `package.json`. All patterns verified from existing components.

### Supporting Libraries (None Needed)

No new npm packages are required. Here is why each potential addition was rejected:

| Considered | Purpose | Why NOT Needed |
|------------|---------|----------------|
| `react-select` | Multi-select dropdown with search, tags, clear-all | 47KB gzipped. Requires custom theme/styling to match the dark design system. The existing `ClientSelect` already solves search, keyboard nav, scroll-into-view, and close-on-click-outside. Extending it to multi-select (checkboxes + selected count badge) is less work than restyling react-select. |
| `cmdk` (command menu) | Composable combobox/command palette | Designed for command palettes, not filter dropdowns. No built-in multi-select. Would need wrapping and styling. Adds complexity for no benefit. |
| `@headlessui/react` (Combobox/Listbox) | Accessible, unstyled select primitives | Headless UI Combobox supports single select only. Listbox supports `multiple` but without search filtering. Combining both is more complex than extending the existing custom component. |
| `nuqs` | URL-synced state for filters | Useful for shareable report URLs, but not requested. Filter state resets when navigating away -- acceptable for an internal tool with ~10 users. Can be added later if needed without architecture changes. |
| `zustand` / `jotai` | Global state management | Filter state is local to the Detail tab component. No cross-component or cross-tab state sharing needed. React `useState` is the right tool. |
| `@tanstack/react-table` | Feature-rich table with built-in filtering, sorting, pagination | The existing `DataTable` component already handles sorting and pagination. Adding TanStack Table for filtering alone is overkill. Client-side `Array.filter()` before passing `data` to `DataTable` achieves the same result with zero new dependencies. |
| `lodash` / `remeda` | Utility functions for grouping, aggregation | `Array.reduce()`, `Map`, and `Object.values()` handle all aggregation. The existing drill-down tabs already use this pattern successfully. |
| `use-debounce` | Debounce filter changes | With ~10 employees and ~200 clients, filtering is instant. No debounce needed. Even with 1000 entries, `Array.filter()` on three conditions is sub-millisecond. |

**Confidence: HIGH** -- Each rejection based on codebase analysis and specific data scale (~10 employees, ~200 clients, ~30 topics).

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Test filter logic, aggregation functions, component rendering | Existing test infrastructure. New tests follow existing patterns in `ByClientTab.test.tsx`. |
| React Testing Library | Test multi-select interactions (open, search, select, deselect) | Already installed. Use `fireEvent` (not `userEvent` -- not installed, per CLAUDE.md). |

## Architecture: How Filters Drive Charts and Table

### Data Flow

```
ReportsContent (fetches data, manages date range)
  |
  +-- DetailTab (new)
        |-- filter state: selectedClientIds[], selectedEmployeeIds[], selectedTopicNames[]
        |
        |-- useMemo: filteredEntries = entries.filter(matchesAllActiveFilters)
        |
        |-- useMemo: byClient = aggregateByClient(filteredEntries)
        |-- useMemo: byEmployee = aggregateByEmployee(filteredEntries)
        |-- useMemo: byTopic = aggregateByTopic(filteredEntries)
        |
        |-- MultiSelect (clients)  -- populates from data.byClient
        |-- MultiSelect (employees) -- populates from data.byEmployee
        |-- MultiSelect (topics)   -- populates from unique topicNames in entries
        |
        |-- BarChart (hours by client)      <-- byClient
        |-- RevenueBarChart (rev by client) <-- byClient (admin only)
        |-- BarChart (hours by employee)    <-- byEmployee
        |-- RevenueBarChart (rev by employee) <-- byEmployee (admin only)
        |-- BarChart (hours by topic)       <-- byTopic
        |-- RevenueBarChart (rev by topic)  <-- byTopic (admin only)
        |
        |-- DataTable (filtered entries)    <-- filteredEntries
```

### Filter Logic

Filters are AND-combined (entries must match ALL active filters), but within each filter they are OR-combined (entry matches if it matches ANY selected value in that filter). When a filter has no selections, it is treated as "all" (no restriction).

```typescript
const filteredEntries = useMemo(() => {
  return entries.filter((entry) => {
    const matchesClient = selectedClientIds.length === 0
      || selectedClientIds.includes(entry.clientId);
    const matchesEmployee = selectedEmployeeIds.length === 0
      || selectedEmployeeIds.includes(entry.userId);
    const matchesTopic = selectedTopicNames.length === 0
      || selectedTopicNames.includes(entry.topicName);
    return matchesClient && matchesEmployee && matchesTopic;
  });
}, [entries, selectedClientIds, selectedEmployeeIds, selectedTopicNames]);
```

### Topic Aggregation Pattern

Topic aggregation for charts follows the same `Array.reduce()` pattern already used in `ByClientTab.tsx` (lines 102-115) and `ByEmployeeTab.tsx` (lines 113-126):

```typescript
const byTopic = useMemo(() => {
  const map = new Map<string, { name: string; value: number; revenue: number }>();
  for (const entry of filteredEntries) {
    const existing = map.get(entry.topicName);
    if (existing) {
      existing.value += entry.hours;
      // revenue calculation follows existing pattern from report-utils.ts
    } else {
      map.set(entry.topicName, { name: entry.topicName, value: entry.hours, revenue: 0 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}, [filteredEntries]);
```

**Revenue per topic** requires the client's hourly rate, which is available on `ReportEntry.clientType` and can be looked up from `data.byClient`. Entries for non-REGULAR clients or written-off entries produce zero revenue -- matching the existing `report-utils.ts` logic.

## MultiSelect Component Design

### Why Custom (Not a Library)

The existing `ClientSelect` component (202 lines) already implements:
- Dropdown open/close with animation (`animate-fade-up`)
- Search input with filtering
- Keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
- Scroll highlighted item into view
- Close on outside click (`useClickOutside` hook)
- Dark theme styling with design system CSS variables

Converting this to multi-select requires:
1. Change `value: string` to `value: string[]` (or `Set<string>`)
2. Add checkbox indicators next to each item
3. Show selected count badge on the trigger button (e.g., "3 selected")
4. Keep dropdown open after selection (don't close on item click)
5. Add "Clear all" button when selections exist

This is approximately 50-70 lines of changes to the existing pattern, versus 200+ lines of react-select theme customization to match the dark design system.

### Props Interface

```typescript
interface MultiSelectProps {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;       // e.g., "All Clients"
  searchPlaceholder: string; // e.g., "Search clients..."
  className?: string;
}
```

### Populating Filter Options from API Data

Filter options are derived from the already-fetched `ReportData`:

| Filter | Source | Extraction |
|--------|--------|------------|
| Clients | `data.byClient` | `data.byClient.map(c => ({ id: c.id, label: c.name }))` |
| Employees | `data.byEmployee` | `data.byEmployee.map(e => ({ id: e.id, label: e.name }))` |
| Topics | `data.entries` | `[...new Set(data.entries.map(e => e.topicName))].map(t => ({ id: t, label: t }))` |

No additional API call needed. Filter options update automatically when the date range changes (since `data` is re-fetched).

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-select` | 47KB gzipped. Requires extensive theme customization for the dark design system. Default styling clashes with `--bg-surface`, `--border-subtle`, `--accent-pink` variables. | Custom `MultiSelect` extending existing `ClientSelect` pattern |
| `@tanstack/react-table` | DataTable already handles sort + pagination. Adding TanStack Table for filtering adds 50KB+ and requires rewriting the table component. Filter logic is 5 lines of `Array.filter()`. | `Array.filter()` before passing data to existing `DataTable` |
| URL state sync (`nuqs`, `URLSearchParams`) | Not requested. Filter state resets on tab change -- acceptable behavior. URL sync adds complexity (serialization, hydration, browser history pollution) with minimal benefit for ~10 internal users. | React `useState` for filter arrays |
| `useReducer` for filter state | Three independent `useState` calls are simpler and more readable than a reducer with action types. No complex state transitions -- just add/remove IDs from arrays. | Three `useState<string[]>` calls |
| Server-side filtering (API params) | All entries are already fetched for the date range. Client-side filtering on ~1000 entries is instant. Server-side filtering would require API changes, add network latency per filter change, and complicate comparison period logic. | Client-side `useMemo` with `Array.filter()` |
| Virtualized dropdown lists | Largest list is ~200 clients. Search narrows this to <20 items. No performance benefit from virtualization at this scale. | Standard `overflow-y-auto` with `max-h-56` (existing pattern) |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Custom `MultiSelect` | `react-select` | When styling doesn't need to match a custom design system, or when you need advanced features (async loading, creatable options, grouped options). Not this project. |
| Client-side filtering | Server-side filter params | When datasets exceed ~10K entries and filtering causes visible UI lag. At ~200 clients x ~30 days = ~6000 entries max, client-side is fine. |
| `useState` arrays | URL state (`nuqs`) | When reports need shareable URLs with filter state preserved. Could be added later as an enhancement without architecture changes. |
| `useMemo` derived data | Separate state for filtered data | Never. Derived state should always be computed, not stored. Storing filtered data in state creates sync bugs. |
| AND-combined filters | OR-combined filters | AND is the standard expectation for dashboard filters ("show entries that match Client X AND Employee Y AND Topic Z"). OR-combination within a single filter ("Client X OR Client Y") is handled by `Array.includes()`. |

## Version Compatibility

No version concerns. All technologies are already installed and working together:

| Package | Version | Relevant API | Notes |
|---------|---------|--------------|-------|
| `react@19.2.1` | 19.2.1 | `useState`, `useMemo`, `useCallback` | Hooks API stable since React 16.8. No concerns. |
| `recharts@3.6.0` | 3.6.0 | `BarChart`, `Bar`, `Cell`, `ResponsiveContainer` | Existing chart components work unchanged. Pass different data, get different charts. |
| `typescript@5.x` | 5.x | Generic types for `MultiSelect<T>` | Standard TypeScript generics. |
| `tailwindcss@4.x` | 4.x | CSS variables for dark theme | Existing design system variables. No new Tailwind config needed. |

## Installation

```bash
# No new packages needed. Zero npm installs.
# All capabilities come from React 19 + existing components + custom code.
```

## Types to Add

The existing types in `@/types/reports.ts` already cover most needs. One small addition for the Detail tab:

```typescript
// In @/types/reports.ts -- extend ReportEntry if needed for topic revenue
// Already has: topicName, clientType, isWrittenOff, hours
// Revenue per entry can be computed from entry.hours * client.hourlyRate
// where client is looked up from data.byClient

// New type for topic chart data (if not using BarChartItem directly)
export interface TopicChartData {
  name: string;      // topicName
  value: number;     // total hours
  revenue: number;   // total revenue (admin only)
}
```

## Sources

- `app/src/components/ui/ClientSelect.tsx` -- Existing single-select with search, keyboard nav, click-outside (202 lines). Pattern to extend for multi-select. (HIGH confidence)
- `app/src/components/reports/ReportsContent.tsx` -- Existing filter/state management pattern using `useState` + `useMemo`. (HIGH confidence)
- `app/src/components/reports/ByClientTab.tsx` -- Existing `Array.reduce()` aggregation pattern for drill-down charts (lines 102-130). (HIGH confidence)
- `app/src/lib/report-utils.ts` -- Existing server-side aggregation showing data shapes and revenue calculation logic. (HIGH confidence)
- `app/src/types/reports.ts` -- Existing types: `ReportEntry` (has `topicName`, `clientType`, `isWrittenOff`), `ReportData`, `TopicAggregation`. (HIGH confidence)
- `app/package.json` -- Current dependencies verified: React 19.2.1, Recharts 3.6.0, no select or state management libraries. (HIGH confidence)

---
*Stack research for: v1.2 Reports Detail View (multi-select filters, chart-filter interactivity, topic aggregation)*
*Researched: 2026-02-25*
