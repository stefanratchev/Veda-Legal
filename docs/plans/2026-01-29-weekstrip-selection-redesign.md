# WeekStrip Selection Redesign

## Problem

When a date is selected in the WeekStrip component, the solid pink fill (`bg-[var(--accent-pink)]`) overwhelms status indicators (submitted/overdue badges). The badges switch to semi-transparent dark colors when selected, making them hard to read and losing their semantic meaning.

## Solution

Replace the solid fill selection with a ring-based selection indicator, and change the "today" indicator from a ring to a colored date number. This creates balanced visual hierarchy where both selection state and status badges remain clearly visible.

## Design

### Selected State

**Before:**
- Solid pink background fill
- Dark text color
- Status badges washed out to semi-transparent dark

**After:**
- Thick pink ring (`ring-2 ring-[var(--accent-pink)]`)
- Subtle elevated background (`bg-[var(--bg-surface)]`)
- Normal text color
- Status badges retain original colors (green/red)

### Today Indicator

**Before:**
- Thin pink ring with offset (`ring-1 ring-[var(--accent-pink)] ring-offset-1`)

**After:**
- Date number rendered in pink (`text-[var(--accent-pink)]`)
- No ring (ring reserved for selection)

### Combined State (Today + Selected)

- Selection ring around the cell
- Pink date number inside

### Status Badges

Always retain semantic colors regardless of selection:
- Submitted: Green badge with checkmark
- Overdue: Red badge with clock (pulsing animation)

### Removed

- Entry dot indicator (small pink dot showing dates with time entries)
- `datesWithEntries` prop no longer needed

## Visual Hierarchy

1. **Status badges** (green/red) - Critical information, always visible
2. **Selection ring** (pink) - Current viewing context
3. **Today indicator** (pink date number) - Informational reference

## Implementation

### Files to Modify

- `app/src/components/timesheets/WeekStrip.tsx`

### Changes

1. **Selected state styling** (lines ~200-205, ~316-321):
   - Replace `bg-[var(--accent-pink)]` with `ring-2 ring-[var(--accent-pink)] bg-[var(--bg-surface)]`
   - Remove dark text colors for selected state

2. **Today indicator** (lines ~204, ~320):
   - Remove ring styling for today
   - Add pink text color to date number when `isToday`

3. **Status icon function** (lines ~29-78):
   - Remove `isSelected` parameter
   - Remove conditional color switching based on selection

4. **Remove entry dot**:
   - Delete `hasEntries` helper (line ~166)
   - Delete entry dot rendering (lines ~214-219, ~326-329)
   - Remove `datesWithEntries` from props interface and destructuring

5. **Update test file** if needed to reflect prop changes
