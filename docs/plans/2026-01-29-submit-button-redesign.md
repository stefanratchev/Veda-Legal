# Submit Button Redesign

## Problem

The current submit button has several issues:
- Uses strong green color (`--success`) which clashes with the coral pink brand
- Full-width button feels oversized for a confirmation action
- Visually disconnected from the daily total it relates to
- Doesn't clearly communicate how many more hours are needed

## Solution

Integrate the submit action into the EntriesList footer row, replacing the standalone button with a compact, contextually connected UI that shows progress toward the 8-hour threshold.

## Design

### Layout

The footer row changes from centered text to a flex layout with daily total on the left and submit status on the right.

**When under 8 hours:**
```
┌─────────────────────────────────────────────────┐
│  Daily Total: 6h 45m               1h 15m to go │
└─────────────────────────────────────────────────┘
```

**When 8+ hours (can submit):**
```
┌─────────────────────────────────────────────────┐
│  Daily Total: 8h 30m        [Submit Timesheet →]│
└─────────────────────────────────────────────────┘
```

**After submission:**
```
┌─────────────────────────────────────────────────┐
│  Daily Total: 8h 30m       ✓ Timesheet Submitted│
└─────────────────────────────────────────────────┘
```

### Styling

**"X to go" hint:**
- `text-[var(--text-muted)]`
- Non-interactive, informational only

**"Submit Timesheet →" button:**
- Background: `bg-[var(--accent-pink-glow)]`
- Text: `text-[var(--accent-pink)]`
- Border: `border border-[var(--border-accent)]`
- Hover: `hover:bg-[var(--accent-pink)] hover:text-[var(--bg-deep)]`
- Padding: `px-3 py-1.5`
- Font: `text-[13px] font-medium`

Matches the "Today" button in WeekStrip for brand consistency.

**"✓ Timesheet Submitted" status:**
- Text: `text-[var(--success)]`
- No background, just checkmark icon and text
- Green is appropriate as a semantic status indicator

### Time Formatting

Use existing `formatHours` utility for consistent "Xh Ym" display throughout.

## Implementation

### Files to Modify

1. **`EntriesList.tsx`**
   - Add props: `totalHours`, `isSubmitted`, `isLoading`, `onSubmit`
   - Update mobile footer (lines 74-78) to flex layout with submit UI
   - Update desktop footer (lines 116-125) to flex layout with submit UI
   - Calculate remaining hours: `Math.max(0, 8 - totalHours)`

2. **`TimesheetsContent.tsx`**
   - Remove `<SubmitButton />` import and usage
   - Pass new props to `<EntriesList />`: `totalHours`, `isSubmitted`, `isLoading`, `onSubmit={handleTimesheetSubmit}`

3. **`SubmitButton.tsx`**
   - Delete file (no longer needed)

### Props Interface Change

```typescript
interface EntriesListProps {
  entries: TimeEntry[];
  isLoadingEntries: boolean;
  onDeleteEntry?: (entryId: string) => void;
  onUpdateEntry?: (updatedEntry: TimeEntry, revocationData?: { ... }) => void;
  readOnly?: boolean;
  clients?: ClientWithType[];
  topics?: Topic[];
  // New props for submit functionality
  totalHours?: number;
  isSubmitted?: boolean;
  isLoading?: boolean;
  onSubmit?: () => void;
}
```

All new props are optional to maintain backward compatibility for read-only usage (e.g., team timesheets view).
