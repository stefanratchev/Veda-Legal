# Phase 9: Filter Component - Research

**Researched:** 2026-02-25
**Domain:** Reusable multi-select filter UI component (React, client-side)
**Confidence:** HIGH

## Summary

Phase 9 builds a reusable `MultiSelectFilter` component and a `FilterBar` wrapper that composes three instances (Clients, Employees, Topics). This is a pure client-side UI component with no new dependencies -- it follows existing patterns from `ClientSelect` (search, dropdown, keyboard nav, click-outside) and adapts them for multi-select with checkboxes.

The codebase already has all the building blocks: `useClickOutside` hook, `animate-fade-up` animation, design system CSS variables, and a well-tested `ClientSelect` component that serves as the exact structural template. The key difference from `ClientSelect` is multi-select behavior: dropdown stays open after selection, uses checkboxes instead of highlight-based selection, and manages a `Set<string>` instead of a single value.

**Primary recommendation:** Build `MultiSelectFilter` as a generic component in `components/ui/`, modeled directly on `ClientSelect` structure. Build `FilterBar` as a composed wrapper in `components/reports/` that manages state for three filter dimensions and exposes a single `onChange` callback for the parent. No new npm packages needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Horizontal row of three filter dropdowns: Clients | Employees | Topics
- Compact trigger buttons showing label + selection count badge (e.g., "Clients (3)")
- "Clear all" link at the right end of the filter bar, only visible when any filter is active
- Filter bar component wraps the three MultiSelectFilter instances -- exported as a composed unit for Phase 10
- Follow existing `ClientSelect` pattern: trigger button opens a dropdown panel with search input at top
- Checkboxes next to each option (not highlight-based selection like ClientSelect's single-select)
- Search input auto-focused on open, case-insensitive substring matching
- Max height ~280px with overflow scroll, consistent with existing `max-h-56` pattern
- "No results" message when search yields nothing
- Close on click-outside (reuse `useClickOutside` hook) and Escape key
- Dropdown stays open after selecting/deselecting (multi-select UX)
- Count badge on the trigger button: coral pink background with count number
- No individual pill badges per selection -- trigger stays compact
- When filters are active, trigger button gets a subtle accent border
- No "Select all" / "Deselect all" inside dropdown
- Keyboard: Arrow keys navigate, Space toggles checkbox, Escape closes
- Click outside dismisses dropdown and preserves selections
- Generic component: `MultiSelectFilter<T>` accepting `options: { id: string; label: string }[]`, `selected: Set<string>`, `onChange: (selected: Set<string>) => void`, `label: string`
- Filter bar is a separate wrapper component that composes three MultiSelectFilter instances

### Claude's Discretion
- Exact spacing, padding, and font sizes (follow existing component conventions)
- Animation for dropdown open/close (likely `animate-fade-up` per design system rule)
- Whether to group clients by type (REGULAR/INTERNAL/MANAGEMENT) in the dropdown
- Internal component structure and state management approach

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILT-01 | User can filter by multiple clients using a searchable multi-select dropdown | MultiSelectFilter component with search input, checkbox options, Set<string> state management. Options derived from unique clients in ReportEntry[] data. |
| FILT-02 | User can filter by multiple employees using a searchable multi-select dropdown | Same MultiSelectFilter component, different options list. Options derived from unique employees in ReportEntry[] data. |
| FILT-03 | User can filter by multiple topics using a searchable multi-select dropdown | Same MultiSelectFilter component. Topics use topicName as both id and label (matching `filterEntries` from Phase 8 which uses `topicNames: Set<string>`). |
| FILT-04 | User can clear an individual filter or all filters at once | Individual clear: pass empty Set via onChange on each MultiSelectFilter. Global clear: FilterBar "Clear all" link resets all three Sets to empty. |
| FILT-05 | User sees active filter indicators showing which filters are applied | Count badge on trigger button with coral pink background. Accent border on active filter triggers. "Clear all" link visibility serves as a global indicator. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.1 | Component framework | Already installed, project standard |
| TypeScript | ^5 | Type safety | Already installed, project standard |
| Tailwind CSS | v4 | Styling | Already installed, project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useClickOutside` | N/A (local hook) | Close dropdown on outside click | Already exists at `@/hooks/useClickOutside` |
| Vitest | ^4.0.16 | Unit testing | Already installed, project standard |
| @testing-library/react | ^16.3.1 | Component testing | Already installed, project standard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom MultiSelectFilter | Headless UI (Listbox) | Would add a dependency for a simple component; project decision is no new packages |
| Custom MultiSelectFilter | React Select / downshift | Overkill for ~200 items max; project decision is no new packages |
| `Set<string>` state | Array state | Set provides O(1) has/add/delete and aligns with Phase 8 `filterEntries` API signature |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
app/src/
├── components/
│   ├── ui/
│   │   ├── MultiSelectFilter.tsx        # Generic reusable component
│   │   └── MultiSelectFilter.test.tsx   # Unit tests
│   └── reports/
│       ├── FilterBar.tsx                # Composed filter bar (3 instances)
│       └── FilterBar.test.tsx           # Integration tests
```

### Pattern 1: Controlled Multi-Select with Set State
**What:** MultiSelectFilter is fully controlled -- parent owns the `selected: Set<string>` and passes `onChange`. Component is stateless for selection; only manages internal state for `isOpen`, `search`, and `highlightedIndex`.
**When to use:** Always. This matches the existing `ClientSelect` pattern where parent owns value.
**Example:**
```typescript
// Source: Existing ClientSelect pattern in codebase
interface MultiSelectFilterProps {
  options: { id: string; label: string }[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  label: string;
  placeholder?: string;
}

// Toggle handler uses functional Set construction (no mutation)
const handleToggle = useCallback((id: string) => {
  onChange(prev => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });
}, [onChange]);
```

**Important note on Set state:** React cannot detect Set mutation. The `onChange` callback must always pass a **new Set instance** (not mutate the existing one). This is critical for React to trigger re-renders. The parent component should use `useState<Set<string>>` and create new Sets on each update.

### Pattern 2: FilterBar as Composed Wrapper
**What:** FilterBar manages three `Set<string>` states and composes three MultiSelectFilter instances. Exposes a single interface for the parent (Detail tab in Phase 10).
**When to use:** Phase 10 integration.
**Example:**
```typescript
// FilterBar state shape
interface FilterState {
  clientIds: Set<string>;
  employeeIds: Set<string>;
  topicNames: Set<string>;
}

// FilterBar props
interface FilterBarProps {
  clients: { id: string; label: string }[];
  employees: { id: string; label: string }[];
  topics: { id: string; label: string }[];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}
```

### Pattern 3: Keyboard Navigation (Arrow + Space)
**What:** Arrow keys navigate the option list, Space toggles checkbox, Escape closes dropdown. This differs from ClientSelect where Enter selects and closes.
**When to use:** All keyboard interaction within the dropdown.
**Key difference from ClientSelect:** In multi-select, Space toggles without closing. Enter could optionally close the dropdown (or be ignored). Escape closes and preserves selections.
**Example:**
```typescript
// Source: Adapted from existing ClientSelect keyboard handler
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Escape") {
    setIsOpen(false);
    setSearch("");
    setHighlightedIndex(0);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    setHighlightedIndex((prev) =>
      prev < filteredOptions.length - 1 ? prev + 1 : prev
    );
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
  } else if (e.key === " ") {
    e.preventDefault(); // Prevent page scroll
    if (filteredOptions[highlightedIndex]) {
      handleToggle(filteredOptions[highlightedIndex].id);
    }
  }
};
```

### Pattern 4: Topic Options Use topicName as ID
**What:** The Phase 8 `filterEntries` function uses `topicNames: Set<string>` (not topic IDs). Topics in `ReportEntry` only have `topicName`, not a separate `topicId`. So the MultiSelectFilter for topics must use `topicName` as both `id` and `label` in its options.
**When to use:** When deriving topic options from report data.
**Example:**
```typescript
// Derive topic options from entries
const topicOptions = useMemo(() => {
  const names = new Set(entries.map(e => e.topicName));
  return Array.from(names)
    .sort()
    .map(name => ({ id: name, label: name }));
}, [entries]);
```

### Anti-Patterns to Avoid
- **Mutating Set state:** Never do `selected.add(id)` and pass the same Set reference. React will not re-render. Always create `new Set(selected)`.
- **Derived state in useState:** Do not store `filteredOptions` in state. Compute it with `useMemo` from `options` and `search`.
- **Closing dropdown on each selection:** This is a multi-select. The dropdown must stay open. Only close on click-outside or Escape.
- **Using `&&` for count badge rendering:** `{count && <Badge />}` renders `0` when count is 0. Use `{count > 0 ? <Badge /> : null}` per project Vercel React skill (`rendering-conditional-render`).
- **Recreating callbacks that depend on selected Set:** Use the functional update pattern. The `onChange` prop from parent should handle the Set update logic; the component just calls `onChange(newSet)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Click-outside detection | Custom event listener | `useClickOutside` hook from `@/hooks/useClickOutside` | Already tested, handles edge cases (enabled flag, cleanup) |
| Dropdown animation | Custom CSS | `animate-fade-up` class from `globals.css` | Already defined, consistent with design system |
| Scroll into view | Custom scroll logic | `scrollIntoView({ block: "nearest" })` | Browser native, already used in ClientSelect |
| Case-insensitive search | Custom regex | `str.toLowerCase().includes(search.toLowerCase())` | Simple substring match, same as ClientSelect |

**Key insight:** This entire component is an adaptation of the existing `ClientSelect`. The structural template already exists -- the task is to modify selection semantics (single to multi) and visual indicators (highlight to checkbox + badge), not to build from scratch.

## Common Pitfalls

### Pitfall 1: Set Equality for React State
**What goes wrong:** Parent does `setFilter(prevSet)` where `prevSet` is mutated in-place. React skips re-render because Object.is(prevSet, prevSet) is true.
**Why it happens:** JavaScript Sets are mutable; `set.add()` returns the same reference.
**How to avoid:** Always create new Set: `const next = new Set(prev); next.add(id); setSelected(next);`
**Warning signs:** UI doesn't update after clicking checkbox, but console log shows correct values.

### Pitfall 2: Space Key Scrolls Page
**What goes wrong:** Pressing Space to toggle a checkbox also scrolls the page down.
**Why it happens:** Space is the browser's default scroll action.
**How to avoid:** Call `e.preventDefault()` in the keydown handler for Space.
**Warning signs:** Page jumps when user presses Space to select an option.

### Pitfall 3: Search Input Loses Focus
**What goes wrong:** After clicking a checkbox option, the search input loses focus and keyboard navigation breaks.
**Why it happens:** Clicking the checkbox/option button moves focus to that button element.
**How to avoid:** After each toggle, refocus the search input. Use `searchInputRef.current?.focus()` in the toggle handler. Alternatively, use `onMouseDown` with `e.preventDefault()` on option items to prevent focus shift (this is the cleaner approach).
**Warning signs:** User types to search, clicks an option, then can't continue typing without re-clicking the input.

### Pitfall 4: Stale Closure in Toggle Handler
**What goes wrong:** Toggle handler captures a stale `selected` Set from a previous render.
**Why it happens:** `useCallback` with `[selected]` dependency, but selected changes frequently.
**How to avoid:** Since MultiSelectFilter is controlled (parent owns state), the component doesn't need to reference `selected` in its toggle handler. It receives `selected` as a prop and constructs a new Set: `const next = new Set(selected); next.toggle(id); onChange(next);`. No stale closure risk because `selected` is read from current props, not closed-over state.
**Warning signs:** Toggling item A, then B, causes A to untoggle.

### Pitfall 5: Dropdown Positioning Off-Screen
**What goes wrong:** For filter triggers near the right edge, the dropdown might extend beyond the viewport.
**Why it happens:** Absolute positioning with `left-0` on the dropdown.
**How to avoid:** FilterBar is a horizontal row at the top of the Detail tab -- dropdowns for earlier items (Clients, Employees) open leftward safely. The Topics dropdown (rightmost) should use `right-0` instead of `left-0`, or the FilterBar should have sufficient padding. This is a minor styling concern to verify during implementation.
**Warning signs:** Horizontal scrollbar appears when rightmost dropdown opens.

## Code Examples

Verified patterns from codebase sources:

### Trigger Button with Count Badge
```typescript
// Source: Design decision from CONTEXT.md + existing button patterns in ClientSelect
<button
  type="button"
  onClick={() => setIsOpen(!isOpen)}
  className={`
    px-3 py-2 rounded text-[13px] font-medium
    bg-[var(--bg-surface)]
    text-[var(--text-secondary)]
    transition-all duration-200
    flex items-center gap-2
    ${selected.size > 0
      ? "border border-[var(--border-accent)]"
      : "border border-[var(--border-subtle)]"
    }
  `}
>
  <span>{label}</span>
  {selected.size > 0 ? (
    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--accent-pink)] text-[var(--bg-deep)]">
      {selected.size}
    </span>
  ) : null}
  <svg className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
  </svg>
</button>
```

### Checkbox Option Item
```typescript
// Source: Adapted from ClientSelect option pattern
<button
  type="button"
  onMouseDown={(e) => {
    e.preventDefault(); // Prevent focus shift from search input
    handleToggle(option.id);
  }}
  onMouseEnter={() => setHighlightedIndex(index)}
  className={`
    w-full px-3 py-2 text-left text-[13px]
    transition-colors flex items-center gap-2.5
    ${index === highlightedIndex ? "bg-[var(--bg-surface)]" : ""}
  `}
>
  {/* Checkbox indicator */}
  <span className={`
    w-4 h-4 rounded-sm border flex-shrink-0 flex items-center justify-center
    ${isChecked
      ? "bg-[var(--accent-pink)] border-[var(--accent-pink)]"
      : "border-[var(--text-muted)]"
    }
  `}>
    {isChecked ? (
      <svg className="w-3 h-3 text-[var(--bg-deep)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
      </svg>
    ) : null}
  </span>
  <span className="text-[var(--text-primary)] truncate">{option.label}</span>
</button>
```

### FilterBar Clear All
```typescript
// Source: CONTEXT.md decision - "Clear all" link at right end
{hasActiveFilters ? (
  <button
    type="button"
    onClick={handleClearAll}
    className="text-[13px] text-[var(--accent-pink)] hover:text-[var(--accent-pink-dim)] transition-colors"
  >
    Clear all
  </button>
) : null}
```

### Deriving Options from Report Data
```typescript
// Source: ReportEntry type from types/reports.ts
// Client options: unique by clientId
const clientOptions = useMemo(() => {
  const map = new Map<string, string>();
  for (const entry of entries) {
    if (!map.has(entry.clientId)) {
      map.set(entry.clientId, entry.clientName);
    }
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}, [entries]);

// Employee options: unique by userId
const employeeOptions = useMemo(() => {
  const map = new Map<string, string>();
  for (const entry of entries) {
    if (!map.has(entry.userId)) {
      map.set(entry.userId, entry.userName);
    }
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}, [entries]);

// Topic options: topicName is both id and label
const topicOptions = useMemo(() => {
  const names = new Set(entries.map(e => e.topicName));
  return Array.from(names)
    .sort()
    .map(name => ({ id: name, label: name }));
}, [entries]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Array for multi-select state | Set<string> for O(1) lookups | Modern JS | Cleaner has/add/delete, matches Phase 8 filterEntries API |
| `onChange(e.target.checked)` on native checkbox | Custom checkbox with button + SVG | Current design trend | Full style control, consistent with dark theme |
| `onClick` for option toggle | `onMouseDown` with `preventDefault` | UX pattern | Prevents focus loss from search input |

**Deprecated/outdated:**
- None relevant. This is a standard React controlled component pattern with no library dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.16 + @testing-library/react ^16.3.1 |
| Config file | `app/vitest.config.ts` |
| Quick run command | `npm run test -- MultiSelectFilter --run` |
| Full suite command | `npm run test -- --run` |
| Estimated runtime | ~5 seconds for component tests |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILT-01 | Multi-select dropdown with search for clients | unit | `npm run test -- MultiSelectFilter --run` | No -- Wave 0 gap |
| FILT-02 | Multi-select dropdown with search for employees | unit | `npm run test -- MultiSelectFilter --run` | No -- Wave 0 gap (same component, different props) |
| FILT-03 | Multi-select dropdown with search for topics | unit | `npm run test -- MultiSelectFilter --run` | No -- Wave 0 gap (same component, different props) |
| FILT-04 | Clear individual filter or all filters | unit | `npm run test -- FilterBar --run` | No -- Wave 0 gap |
| FILT-05 | Active filter indicators (count badge, accent border) | unit | `npm run test -- MultiSelectFilter --run` | No -- Wave 0 gap |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `npm run test -- --run`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~5 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `app/src/components/ui/MultiSelectFilter.test.tsx` -- covers FILT-01, FILT-02, FILT-03, FILT-05
- [ ] `app/src/components/reports/FilterBar.test.tsx` -- covers FILT-04

*(Test infrastructure already exists: Vitest, jsdom, @testing-library/react, setup.ts)*

### Test Patterns from Existing Codebase
The `ClientSelect.test.tsx` is the reference template. Key patterns to replicate:
- Mock `useClickOutside` via `vi.mock("@/hooks/useClickOutside")`
- Mock `scrollIntoView` via `Element.prototype.scrollIntoView = vi.fn()`
- Use `fireEvent.click` / `fireEvent.change` / `fireEvent.keyDown` (not userEvent -- not installed)
- Test groups: Rendering, Dropdown Behavior, Filtering, Selection, Keyboard Navigation, Empty State

## Open Questions

1. **Client grouping in dropdown**
   - What we know: ClientSelect shows INTERNAL/MANAGEMENT badges but does not group. CONTEXT.md leaves grouping to Claude's discretion.
   - What's unclear: Whether visual grouping (headers like "Regular", "Internal") adds value for ~200 clients.
   - Recommendation: Skip grouping. The search functionality handles discoverability. If needed later, it can be added without API changes since `clientType` is available on `ReportEntry`.

2. **Option list derivation timing**
   - What we know: Options will be derived from `ReportEntry[]` data in Phase 10. In Phase 9, the component is tested in isolation with mock options.
   - What's unclear: Whether option derivation logic lives in FilterBar or is passed from the parent.
   - Recommendation: FilterBar accepts pre-computed option arrays as props. The parent (Detail tab) derives options from entries. This keeps FilterBar reusable and testable.

## Sources

### Primary (HIGH confidence)
- `app/src/components/ui/ClientSelect.tsx` -- structural template for dropdown behavior
- `app/src/components/ui/ClientSelect.test.tsx` -- test patterns for dropdown component
- `app/src/hooks/useClickOutside.ts` -- click-outside hook API
- `app/src/lib/report-detail-utils.ts` -- filterEntries API signature (Set<string> parameters)
- `app/src/types/reports.ts` -- ReportEntry type definition
- `app/src/app/globals.css` -- CSS variables, animate-fade-up definition
- `.agents/skills/vercel-react-best-practices/rules/rendering-conditional-render.md` -- conditional render pattern
- `.agents/skills/vercel-react-best-practices/rules/rerender-functional-setstate.md` -- functional setState pattern

### Secondary (MEDIUM confidence)
- CONTEXT.md user decisions -- locked design and behavior choices

### Tertiary (LOW confidence)
- None. All findings are from codebase sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all libraries already in project
- Architecture: HIGH -- directly adapting existing ClientSelect pattern with well-defined modifications
- Pitfalls: HIGH -- common React state management issues, verified against codebase patterns

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable -- no library changes expected)
