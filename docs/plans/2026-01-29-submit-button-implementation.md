# Submit Button Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate submit action into EntriesList footer with progress feedback, replacing the standalone SubmitButton component.

**Architecture:** Add optional submit-related props to EntriesList, update footer to show progress ("Xh Ym to go") or submit button based on hours logged, remove standalone SubmitButton component.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest

---

### Task 1: Add Submit UI Tests to EntriesList

**Files:**
- Modify: `app/src/components/timesheets/EntriesList.test.tsx`

**Step 1: Add test for "to go" progress display**

Add this test block after the "Daily Total" describe block (around line 229):

```typescript
describe("Submit Functionality", () => {
  const submitProps = {
    totalHours: 6.5,
    isSubmitted: false,
    isLoading: false,
    onSubmit: vi.fn(),
  };

  beforeEach(() => {
    submitProps.onSubmit = vi.fn();
  });

  it("shows remaining hours when under 8 hours", () => {
    render(<EntriesList {...defaultProps} {...submitProps} totalHours={6.5} />);

    // 8 - 6.5 = 1.5 hours = "1h 30m to go"
    expect(screen.getAllByText(/1h 30m to go/)).toHaveLength(2); // mobile + desktop
  });

  it("shows submit button when 8+ hours logged", () => {
    render(<EntriesList {...defaultProps} {...submitProps} totalHours={8.5} />);

    const submitButtons = screen.getAllByText("Submit Timesheet →");
    expect(submitButtons).toHaveLength(2); // mobile + desktop
  });

  it("calls onSubmit when submit button is clicked", () => {
    render(<EntriesList {...defaultProps} {...submitProps} totalHours={8.5} />);

    const submitButtons = screen.getAllByText("Submit Timesheet →");
    fireEvent.click(submitButtons[0]);

    expect(submitProps.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows submitted state after submission", () => {
    render(<EntriesList {...defaultProps} {...submitProps} totalHours={8.5} isSubmitted />);

    expect(screen.getAllByText(/Timesheet Submitted/)).toHaveLength(2);
    expect(screen.queryByText("Submit Timesheet →")).not.toBeInTheDocument();
  });

  it("disables submit button when loading", () => {
    render(<EntriesList {...defaultProps} {...submitProps} totalHours={8.5} isLoading />);

    const submitButtons = screen.getAllByRole("button", { name: /Submit Timesheet/ });
    submitButtons.forEach(btn => {
      expect(btn).toBeDisabled();
    });
  });

  it("does not show submit UI when props are not provided", () => {
    render(<EntriesList {...defaultProps} />);

    expect(screen.queryByText(/to go/)).not.toBeInTheDocument();
    expect(screen.queryByText("Submit Timesheet →")).not.toBeInTheDocument();
  });

  it("does not show submit UI in readOnly mode", () => {
    render(<EntriesList {...defaultProps} {...submitProps} totalHours={8.5} readOnly />);

    expect(screen.queryByText("Submit Timesheet →")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd app && npm run test -- EntriesList --run`

Expected: FAIL - tests fail because submit props and UI don't exist yet

**Step 3: Commit failing tests**

```bash
git add app/src/components/timesheets/EntriesList.test.tsx
git commit -m "test: add failing tests for submit UI in EntriesList footer"
```

---

### Task 2: Add Submit Props to EntriesList Interface

**Files:**
- Modify: `app/src/components/timesheets/EntriesList.tsx:10-18`

**Step 1: Update interface with new optional props**

Replace the interface (lines 10-18) with:

```typescript
interface EntriesListProps {
  entries: TimeEntry[];
  isLoadingEntries: boolean;
  onDeleteEntry?: (entryId: string) => void;
  onUpdateEntry?: (updatedEntry: TimeEntry, revocationData?: { submissionRevoked: boolean; remainingHours: number }) => void;
  readOnly?: boolean;
  clients?: ClientWithType[];
  topics?: Topic[];
  // Submit functionality (optional - only shown when provided and not readOnly)
  totalHours?: number;
  isSubmitted?: boolean;
  isLoading?: boolean;
  onSubmit?: () => void;
}
```

**Step 2: Update component destructuring**

Replace the destructuring (lines 20-28) with:

```typescript
export function EntriesList({
  entries,
  isLoadingEntries,
  onDeleteEntry,
  onUpdateEntry,
  readOnly = false,
  clients = [],
  topics = [],
  totalHours,
  isSubmitted = false,
  isLoading = false,
  onSubmit,
}: EntriesListProps) {
```

**Step 3: Run tests**

Run: `cd app && npm run test -- EntriesList --run`

Expected: Still FAIL - props exist but UI doesn't render yet

**Step 4: Commit**

```bash
git add app/src/components/timesheets/EntriesList.tsx
git commit -m "feat: add submit props to EntriesList interface"
```

---

### Task 3: Implement Submit UI in Footer

**Files:**
- Modify: `app/src/components/timesheets/EntriesList.tsx`

**Step 1: Add helper constants and computed values**

Add after the `dailyTotal` useMemo (around line 33):

```typescript
const MIN_HOURS = 8;
const canSubmit = totalHours !== undefined && totalHours >= MIN_HOURS;
const hoursToGo = totalHours !== undefined ? Math.max(0, MIN_HOURS - totalHours) : 0;
const showSubmitUI = totalHours !== undefined && onSubmit && !readOnly;
```

**Step 2: Create SubmitStatus component inside the file**

Add this helper component before the `EntriesList` export (around line 29, after imports):

```typescript
function SubmitStatus({
  canSubmit,
  hoursToGo,
  isSubmitted,
  isLoading,
  onSubmit,
}: {
  canSubmit: boolean;
  hoursToGo: number;
  isSubmitted: boolean;
  isLoading: boolean;
  onSubmit: () => void;
}) {
  if (isSubmitted) {
    return (
      <span className="flex items-center gap-1.5 text-[var(--success)]">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-[13px] font-medium">Timesheet Submitted</span>
      </span>
    );
  }

  if (canSubmit) {
    return (
      <button
        onClick={onSubmit}
        disabled={isLoading}
        className="px-3 py-1.5 rounded text-[13px] font-medium text-[var(--accent-pink)] bg-[var(--accent-pink-glow)] border border-[var(--border-accent)] hover:bg-[var(--accent-pink)] hover:text-[var(--bg-deep)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Submitting..." : "Submit Timesheet →"}
      </button>
    );
  }

  return (
    <span className="text-[13px] text-[var(--text-muted)]">
      {formatHours(hoursToGo)} to go
    </span>
  );
}
```

**Step 3: Update mobile footer (lines 74-78)**

Replace:
```typescript
{/* Daily Total */}
<div className="pt-2 text-center border-t border-[var(--border-subtle)]">
  <span className="text-[13px] font-medium text-[var(--text-secondary)]">Daily Total: </span>
  <span className="text-base text-[var(--accent-pink)]">{formatHours(dailyTotal)}</span>
</div>
```

With:
```typescript
{/* Daily Total + Submit */}
<div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
  <div>
    <span className="text-[13px] font-medium text-[var(--text-secondary)]">Daily Total: </span>
    <span className="text-base text-[var(--accent-pink)]">{formatHours(dailyTotal)}</span>
  </div>
  {showSubmitUI && (
    <SubmitStatus
      canSubmit={canSubmit}
      hoursToGo={hoursToGo}
      isSubmitted={isSubmitted}
      isLoading={isLoading}
      onSubmit={onSubmit!}
    />
  )}
</div>
```

**Step 4: Update desktop footer (lines 116-125)**

Replace:
```typescript
<tfoot>
  <tr className="bg-[var(--bg-surface)]">
    <td colSpan={readOnly ? 4 : 5} className="px-4 py-3 text-center">
      <span className="text-[13px] font-medium text-[var(--text-secondary)]">Daily Total: </span>
      <span className="text-base text-[var(--accent-pink)]">
        {formatHours(dailyTotal)}
      </span>
    </td>
  </tr>
</tfoot>
```

With:
```typescript
<tfoot>
  <tr className="bg-[var(--bg-surface)]">
    <td colSpan={readOnly ? 4 : 5} className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">Daily Total: </span>
          <span className="text-base text-[var(--accent-pink)]">
            {formatHours(dailyTotal)}
          </span>
        </div>
        {showSubmitUI && (
          <SubmitStatus
            canSubmit={canSubmit}
            hoursToGo={hoursToGo}
            isSubmitted={isSubmitted}
            isLoading={isLoading}
            onSubmit={onSubmit!}
          />
        )}
      </div>
    </td>
  </tr>
</tfoot>
```

**Step 5: Run tests to verify they pass**

Run: `cd app && npm run test -- EntriesList --run`

Expected: PASS - all tests should pass now

**Step 6: Commit**

```bash
git add app/src/components/timesheets/EntriesList.tsx
git commit -m "feat: implement submit UI in EntriesList footer"
```

---

### Task 4: Update TimesheetsContent to Use New Props

**Files:**
- Modify: `app/src/components/timesheets/TimesheetsContent.tsx`

**Step 1: Remove SubmitButton import**

Remove this line (around line 10):
```typescript
import { SubmitButton } from "./SubmitButton";
```

**Step 2: Add submit props to EntriesList**

Find the EntriesList usage (around lines 398-406) and replace:
```typescript
{/* Entries List */}
<EntriesList
  entries={entries}
  isLoadingEntries={isLoadingEntries}
  onDeleteEntry={deleteEntry}
  onUpdateEntry={updateEntry}
  clients={clients}
  topics={topics}
/>
```

With:
```typescript
{/* Entries List */}
<EntriesList
  entries={entries}
  isLoadingEntries={isLoadingEntries}
  onDeleteEntry={deleteEntry}
  onUpdateEntry={updateEntry}
  clients={clients}
  topics={topics}
  totalHours={totalHours}
  isSubmitted={isSubmitted}
  isLoading={isLoading}
  onSubmit={handleTimesheetSubmit}
/>
```

**Step 3: Remove standalone SubmitButton usage**

Delete these lines (around lines 408-414):
```typescript
{/* Submit Button */}
<SubmitButton
  totalHours={totalHours}
  isSubmitted={isSubmitted}
  isLoading={isLoading}
  onSubmit={handleTimesheetSubmit}
/>
```

**Step 4: Run tests**

Run: `cd app && npm run test -- --run`

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add app/src/components/timesheets/TimesheetsContent.tsx
git commit -m "feat: pass submit props to EntriesList, remove SubmitButton usage"
```

---

### Task 5: Delete SubmitButton Component

**Files:**
- Delete: `app/src/components/timesheets/SubmitButton.tsx`

**Step 1: Delete the file**

```bash
rm app/src/components/timesheets/SubmitButton.tsx
```

**Step 2: Run all tests to verify nothing breaks**

Run: `cd app && npm run test -- --run`

Expected: PASS - all tests pass

**Step 3: Run build to verify no import errors**

Run: `cd app && npm run build`

Expected: Build succeeds

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused SubmitButton component"
```

---

### Task 6: Final Verification

**Step 1: Run full test suite**

Run: `cd app && npm run test -- --run`

Expected: All tests pass

**Step 2: Run lint**

Run: `cd app && npm run lint`

Expected: No new errors

**Step 3: Run build**

Run: `cd app && npm run build`

Expected: Build succeeds

**Step 4: Manual testing checklist**

- [ ] With < 8 hours: footer shows "Xh Ym to go" in muted text
- [ ] With 8+ hours: footer shows coral pink "Submit Timesheet →" button
- [ ] Button hover state transitions to filled pink
- [ ] Clicking button triggers submission
- [ ] While submitting: button shows "Submitting..." and is disabled
- [ ] After submission: shows green "✓ Timesheet Submitted"
- [ ] Works on both mobile and desktop views
- [ ] Team timesheets (readOnly) don't show submit UI
