# Phase 6: Core Timesheet Workflow Tests - Research

**Researched:** 2026-02-25
**Domain:** Playwright e2e testing — Page Object Model, API data factories, timesheet workflow assertions
**Confidence:** HIGH

## Summary

Phase 6 builds directly on the Phase 5 infrastructure (Playwright 1.58.2, JWT auth bypass, test DB with seed data, TRUNCATE cleanup). The work is straightforward: create a Page Object Model for the timesheets page, an API data factory for test setup, and ~15 spec tests across 3 files covering entry CRUD, date navigation, and daily submission.

The key technical challenge is interacting with three custom dropdown components (ClientSelect, TopicCascadeSelect, DurationPicker) that use click-outside-to-close patterns, search inputs, and multi-step flows. The Page Object Model must encapsulate these interaction sequences to keep specs readable. DurationPicker renders its dropdown panel via `createPortal` to `document.body`, so locators must target the body-level portal rather than child elements of the trigger.

**Primary recommendation:** Build the Page Object Model with focused helper methods for each dropdown interaction (selectClient, selectTopicAndSubtopic, selectDuration), then an API factory using `page.request.post()` for efficient test data setup. Specs should use the API factory for all tests except the "create entry" tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 3 spec files grouped by workflow step:
  - `entry-crud.spec.ts` (~8 tests) -- create, edit, delete entries
  - `navigation.spec.ts` (~4 tests) -- WeekStrip day selection, prev/next week, Today button, persistence
  - `submission.spec.ts` (~3 tests) -- submit day, status indicator, auto-prompt at 8h threshold

### Claude's Discretion
- **Test setup strategy** -- When to use API factory (`createEntryViaAPI()`) vs full UI form interaction for test data setup. Recommendation: API factory for edit/delete/navigation/submission tests; UI form only for create-entry tests.
- **Coverage boundaries** -- Which edge cases fit within the ~15 test budget. Recommendation: all happy paths from REQ-13 through REQ-24, plus the cancel flows (REQ-16, REQ-18). Skip validation error paths (already covered by 965 Vitest unit tests).
- **Submission flow details** -- Assertion depth for REQ-23 (submit + status indicator) and REQ-24 (auto-prompt modal at 8h). Recommendation: verify modal appearance and status change, don't over-assert on modal content.
- **Page Object Model design** -- Method signatures, locator strategy, assertion encapsulation. Follow Playwright best practices.
- **Spec internal structure** -- Describe blocks, test naming conventions, helper extraction.
- **Test data values** -- Specific hours, descriptions, and client/topic selections used in tests. Use seed data from Phase 5 (`seed-data.ts` constants).

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-11 | TimesheetsPage Page Object Model: `createEntry()`, `editEntry()`, `deleteEntry()`, `navigateToDate()`, `submitDay()`, `getEntryRows()` | POM pattern with encapsulated dropdown interactions; see Architecture Patterns section |
| REQ-12 | API data factory: `createEntryViaAPI()` using `page.request.post('/api/timesheets')` | Playwright `page.request` API for direct HTTP calls; see Code Examples |
| REQ-13 | Create entry test: REGULAR client with subtopic (prefix behavior) | ClientSelect + TopicCascadeSelect (drill-down to subtopic) + DurationPicker interaction; prefix subtopic pre-fills description with trailing space |
| REQ-14 | Create entry test: INTERNAL client with topic-only (no subtopic) | TopicCascadeSelect selects topic directly (no subtopics, `subtopics.length === 0`); auto-fills description with topic name |
| REQ-15 | Edit entry test: change description, change hours | Click edit button (pencil icon) on EntryRow, modify inline EntryForm, click Save |
| REQ-16 | Edit entry test: cancel discards changes | Click edit, modify fields, click Cancel, verify original values preserved |
| REQ-17 | Delete entry test: confirm removes entry | Click delete button (trash icon), ConfirmModal appears, click "Delete", entry disappears |
| REQ-18 | Delete entry test: cancel preserves entry | Click delete, ConfirmModal appears, click "Cancel", entry still visible |
| REQ-19 | WeekStrip navigation: select specific day, verify entries reload | Click day button in WeekStrip, verify entries list updates |
| REQ-20 | WeekStrip navigation: prev/next week arrows shift the week | Click prev/next arrow buttons (title="Previous week"/"Next week"), verify day numbers change |
| REQ-21 | WeekStrip navigation: Today button returns to current day | Navigate away, click "Today" button, verify correct date selected |
| REQ-22 | WeekStrip persistence: entry created on day A persists when navigating away and back | Create entry on day A, navigate to day B, navigate back to day A, verify entry visible |
| REQ-23 | Submission flow: log 8+ hours via API factory, submit, verify status indicator | API factory creates entries totaling 8h, click "Submit Timesheet", verify "Timesheet Submitted" text with checkmark |
| REQ-24 | Submission auto-prompt: modal appears at 8h threshold | API factory creates ~7h of entries, create 1h+ entry via UI to cross 8h threshold, verify ConfirmModal appears |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | 1.58.2 | E2e test framework | Already installed in Phase 5; provides auto-waiting, locators, fixtures |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg | (already installed) | DB fixture pool | TRUNCATE cleanup before each test (Phase 5 fixture) |

### Alternatives Considered
None -- Phase 5 established the stack. No new dependencies needed for Phase 6.

**Installation:**
No new packages needed. Phase 5 installed everything required.

## Architecture Patterns

### Recommended Project Structure
```
app/e2e/
├── fixtures/
│   ├── auth.ts          # JWT cookie injection (Phase 5)
│   ├── db.ts            # TRUNCATE cleanup fixture (Phase 5)
│   └── test.ts          # Composed test export (Phase 5)
├── helpers/
│   ├── global-setup.ts  # Reference data seeding (Phase 5)
│   ├── seed-data.ts     # Deterministic test data constants (Phase 5)
│   └── api-factory.ts   # NEW: createEntryViaAPI() helper
├── pages/
│   └── timesheets.page.ts  # NEW: Page Object Model
├── setup/
│   └── auth.setup.ts    # Auth storageState setup (Phase 5)
└── specs/
    ├── smoke.spec.ts        # Phase 5 smoke test
    ├── entry-crud.spec.ts   # NEW: Create, edit, delete entries
    ├── navigation.spec.ts   # NEW: WeekStrip navigation tests
    └── submission.spec.ts   # NEW: Daily submission tests
```

### Pattern 1: Page Object Model (POM) for TimesheetsPage

**What:** A class encapsulating all timesheets page locators and interaction methods. Each method handles the full UI interaction sequence (open dropdown, search/select, close).

**When to use:** Every spec test imports the POM. Methods return Locators or handle assertions internally.

**Key design decisions:**
- The POM class takes `page: Page` in constructor
- Methods use `getByTestId()`, `getByRole()`, `getByText()`, `getByPlaceholder()` -- no CSS selectors
- DurationPicker renders via `createPortal` to `document.body`, so its dropdown panel must be located at `page` level (not within the trigger's parent)
- ClientSelect and TopicCascadeSelect dropdowns are children of their `data-testid` container
- Editing is inline (replaces table row with EntryForm), so edit methods interact with the form within the table

**Critical locator map:**

| UI Element | Locator Strategy | Notes |
|-----------|-----------------|-------|
| Client dropdown trigger | `page.getByTestId('client-select').locator('button').first()` | Inner button is the click target |
| Client option | `page.getByText(clientName)` within dropdown | After opening dropdown |
| Topic dropdown trigger | `page.getByTestId('topic-cascade-select').locator('button').first()` | Same pattern as ClientSelect |
| Topic option (drill-down) | `page.getByText(topicName)` within dropdown | Clicking drills into subtopics |
| Subtopic option | `page.getByText(subtopicName)` within dropdown | Appears after topic drill-down |
| Topic-only option (internal) | `page.getByText(topicName)` with "Internal" badge | Topics with `subtopics.length === 0` are selected directly |
| DurationPicker trigger | `page.getByTestId('duration-picker').locator('button')` | Opens hours grid |
| Hours grid button | `page.locator('text="Select hours"').locator('..').getByText(hourValue)` | Portal renders at body level |
| Minutes grid button | `page.getByText(minuteValue)` within portal | After hours selection |
| Description input | `page.getByPlaceholder('What did you work on?')` | Always visible in EntryForm |
| Submit/Log button | `page.getByTestId('submit-button')` | Text shows "Log" (create) or "Save" (edit) |
| Cancel button (edit) | `page.getByRole('button', { name: 'Cancel' })` | Only visible in edit mode |
| Entry card (mobile) | `page.getByTestId('entry-card')` | Mobile view |
| Entry row (desktop) | Table rows in entries list | Desktop view (default for Chromium) |
| Edit button | Row's edit SVG button (title="Edit entry") | Within last column |
| Delete button | Row's delete SVG button (title="Delete entry") | Within last column or EntryCard |
| ConfirmModal confirm | `page.getByRole('button', { name: 'Delete' })` or `{ name: 'Submit' }` | Dynamic label |
| ConfirmModal cancel | `page.getByRole('button', { name: 'Cancel' })` or `{ name: 'Not yet' }` | Dynamic label |
| WeekStrip prev | `page.getByTitle('Previous week')` | Arrow button |
| WeekStrip next | `page.getByTitle('Next week')` | Arrow button |
| Today button | `page.getByRole('button', { name: 'Today' })` | Fixed text |
| Day buttons | Buttons within `week-strip` showing date numbers | Day of month text |
| Submit Timesheet button | `page.getByRole('button', { name: /Submit Timesheet/ })` | In footer area |
| Submitted indicator | `page.getByText('Timesheet Submitted')` | Green checkmark text |
| Hours until submit | `page.getByText(/until submit/)` | Shows remaining hours |
| Submit prompt modal | ConfirmModal with "Submit Timesheet?" title | Auto-appears at 8h |
| Daily Total | Text containing formatted hours | In table footer |

### Pattern 2: API Data Factory

**What:** A helper function that creates time entries via the API route, bypassing UI interaction.

**When to use:** For all tests that need pre-existing entries (edit, delete, navigation, submission). Only the "create entry" tests should go through the full UI form.

**Implementation approach:**
```typescript
// e2e/helpers/api-factory.ts
import { Page } from "@playwright/test";

interface CreateEntryOptions {
  date: string;        // YYYY-MM-DD
  clientId: string;
  subtopicId?: string;
  topicId?: string;
  hours: number;
  description: string;
}

export async function createEntryViaAPI(
  page: Page,
  options: CreateEntryOptions
): Promise<{ id: string }> {
  const response = await page.request.post("/api/timesheets", {
    data: options,
  });
  const body = await response.json();
  return body;
}
```

`page.request` inherits the auth cookies from storageState, so no additional auth headers needed.

### Pattern 3: Dropdown Interaction Sequences

**ClientSelect interaction:**
1. Click trigger button inside `data-testid="client-select"`
2. Wait for dropdown to appear (search input visible)
3. Optionally type in search input (`getByPlaceholder('Search clients...')`)
4. Click the desired client option (`getByText(name)`)
5. Dropdown closes automatically

**TopicCascadeSelect -- REGULAR client (subtopic selection):**
1. Click trigger button inside `data-testid="topic-cascade-select"`
2. Click the topic name in the dropdown list (this drills into subtopics)
3. Click the desired subtopic in the subtopic list
4. Dropdown closes automatically
5. If subtopic `isPrefix === true`, description is pre-filled with `"<subtopic name> "`

**TopicCascadeSelect -- INTERNAL client (topic-only selection):**
1. Click trigger button
2. Click the topic name (topics with `subtopics.length === 0` are selected directly, no drill-down)
3. Dropdown closes automatically
4. Description is auto-filled with topic name

**DurationPicker interaction:**
1. Click trigger button inside `data-testid="duration-picker"`
2. Portal dropdown appears at body level with hours grid (1-9, 0)
3. Click desired hour number
4. Minutes step appears (0, 15, 30, 45)
5. Click desired minute value
6. Dropdown closes, duration updated

### Pattern 4: Entry Editing Flow

**Desktop view (Chromium default viewport):**
1. Entry displays as a table row in `<tbody>`
2. Click edit button (pencil icon, `title="Edit entry"`)
3. Row transforms into an inline `EntryForm` with `isEditMode=true`
4. Form shows Save/Cancel buttons (not Log)
5. Modify fields as needed
6. Click "Save" to persist, or "Cancel" to discard

**Important:** In edit mode, selecting a new topic/subtopic does NOT change the description (preserves existing). Only in create mode does topic selection auto-fill description.

### Pattern 5: Delete Confirmation Flow

1. Click delete button (trash icon, `title="Delete entry"`)
2. `ConfirmModal` appears with title "Delete Entry"
3. Message includes entry hours and client name
4. "Delete" button (destructive style) to confirm
5. "Cancel" button to dismiss
6. On confirm, entry removed from list
7. On cancel, entry preserved

### Anti-Patterns to Avoid
- **`page.waitForTimeout()`:** Never use arbitrary delays. Use Playwright's auto-waiting assertions (`toBeVisible()`, `toHaveCount()`) or `waitForResponse()`
- **CSS class selectors:** Use `getByTestId()`, `getByRole()`, `getByText()`, `getByTitle()`, `getByPlaceholder()` instead
- **Redundant assertions:** Don't assert React state -- assert visible UI outcomes
- **Over-specifying modal content:** Assert modal presence and key text, not exact message strings (they include dynamic data like hours and dates)
- **Hardcoding dates:** Use relative date navigation (today, prev week) rather than specific calendar dates

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test data cleanup | Manual DELETE queries | Phase 5's db fixture (TRUNCATE CASCADE) | Already built, handles all mutable tables |
| Authentication | Custom cookie handling | Phase 5's storageState auth bypass | Already built, proven with smoke test |
| Waiting for API responses | `page.waitForTimeout()` | `page.waitForResponse()` or auto-waiting assertions | Eliminates flakiness from arbitrary delays |
| Entry creation for test setup | Full UI form interaction in every test | `createEntryViaAPI()` with `page.request.post()` | 10x faster, less flaky, isolates test scope |

**Key insight:** Phase 5 already handles the hard infrastructure problems (auth, DB setup/cleanup, seed data). Phase 6 should leverage all of it and focus purely on UI interaction patterns.

## Common Pitfalls

### Pitfall 1: DurationPicker Portal Rendering
**What goes wrong:** Locators targeting DurationPicker dropdown fail because the dropdown renders via `createPortal` to `document.body`, not as a child of the trigger element.
**Why it happens:** `DurationPicker.tsx` uses `createPortal(dropdownPanel, document.body)` to escape overflow clipping.
**How to avoid:** Locate DurationPicker dropdown at the page level. Look for "Select hours" text or the hours grid buttons directly on the page, not within the `data-testid="duration-picker"` container.
**Warning signs:** `locator.click()` throws "element not found" when trying to click hour/minute buttons.

### Pitfall 2: Auto-Opening Dropdowns
**What goes wrong:** After selecting a client, the TopicCascadeSelect auto-opens (via `setTimeout(() => topicSelectRef.current?.open(), 0)`). After selecting a topic/subtopic, the DurationPicker auto-opens. After selecting duration, description input auto-focuses.
**Why it happens:** `EntryForm` chains focus flow: Client -> Topic -> Duration -> Description.
**How to avoid:** In the POM, interact with dropdowns in the natural order (client -> topic -> duration -> description). If interacting out of order, may need to close an auto-opened dropdown first.
**Warning signs:** Unexpected dropdown appearing during test, clicking the wrong element.

### Pitfall 3: Desktop vs Mobile Layout
**What goes wrong:** Tests fail because locators target elements that are hidden at the current viewport.
**Why it happens:** The entries list renders differently: `<div className="lg:hidden">` for mobile cards, `<div className="hidden lg:block">` for desktop table. Submit buttons also have mobile/desktop variants.
**How to avoid:** Tests run in Desktop Chrome viewport (1280x720 default). Use desktop locators (table rows, not cards). The desktop submit button is in the `hidden lg:flex` container.
**Warning signs:** `getByTestId('entry-card')` not visible (desktop hides cards), or edit button not found (mobile cards don't have inline edit).

### Pitfall 4: Submission Threshold vs Total Hours
**What goes wrong:** Submit button doesn't appear even after creating entries with 8+ hours.
**Why it happens:** The `totalHours` state comes from the API response (`GET /api/timesheets?date=...`), not from summing client-side entries. After creating via API factory, the page needs to reload entries to get the updated `totalHours`.
**How to avoid:** After using API factory to create entries, navigate to the page or reload to ensure `totalHours` is fetched from the server. Or create entries, then `page.reload()`.
**Warning signs:** "Submit Timesheet" button never appears despite having entries.

### Pitfall 5: Race Between Entry Creation and List Update
**What goes wrong:** Assertion runs before the entry appears in the entries list.
**Why it happens:** After `POST /api/timesheets`, the entry is added to state via `setEntries((prev) => [data, ...prev])`. The DOM update is asynchronous.
**How to avoid:** Use `await expect(page.getByText(description)).toBeVisible()` which auto-waits up to the default timeout. For entry count assertions, use `await expect(page.locator('tbody tr')).toHaveCount(expectedCount)`.
**Warning signs:** Intermittent test failures on entry visibility assertions.

### Pitfall 6: Date-Dependent Test Fragility
**What goes wrong:** Tests that depend on "today" break when run at midnight or across date boundaries.
**Why it happens:** `selectedDate` defaults to `new Date()` which includes time. The API uses date strings (`YYYY-MM-DD`).
**How to avoid:** For date-dependent tests, work relative to "today" using the Today button. For API factory calls, compute today's date string: `new Date().toISOString().split('T')[0]`.
**Warning signs:** Tests pass locally but fail in CI (different timezone or time of day).

### Pitfall 7: WeekStrip Day Selection Without Visible Entries Response
**What goes wrong:** Clicking a day in WeekStrip triggers entry fetch, but test asserts before fetch completes.
**Why it happens:** Day selection triggers `fetchEntries(selectedDate)` which is async.
**How to avoid:** After clicking a day, use `page.waitForResponse('**/api/timesheets?date=*')` to wait for the API response before asserting entry state.
**Warning signs:** Entries from previous day still showing after day selection.

## Code Examples

### API Factory Implementation
```typescript
// e2e/helpers/api-factory.ts
import { Page } from "@playwright/test";
import { CLIENTS, TOPICS, SUBTOPICS, TEST_USER } from "./seed-data";

interface CreateEntryOptions {
  date: string;
  clientId: string;
  subtopicId?: string | null;
  topicId?: string | null;
  hours: number;
  description: string;
}

export async function createEntryViaAPI(
  page: Page,
  options: CreateEntryOptions
): Promise<{ id: string; hours: number; description: string }> {
  const response = await page.request.post("/api/timesheets", {
    data: {
      date: options.date,
      clientId: options.clientId,
      subtopicId: options.subtopicId ?? null,
      topicId: options.topicId ?? null,
      hours: options.hours,
      description: options.description,
    },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

// Convenience for creating a regular entry
export async function createRegularEntry(
  page: Page,
  date: string,
  hours: number = 1,
  description: string = "Test entry description"
) {
  return createEntryViaAPI(page, {
    date,
    clientId: CLIENTS.regular.id,
    subtopicId: SUBTOPICS.correspondence.id,
    hours,
    description,
  });
}

// Convenience for creating an internal entry
export async function createInternalEntry(
  page: Page,
  date: string,
  hours: number = 1,
  description: string = "Internal admin work"
) {
  return createEntryViaAPI(page, {
    date,
    clientId: CLIENTS.internal.id,
    topicId: TOPICS.firmAdmin.id,
    hours,
    description,
  });
}
```

### Page Object Model Skeleton
```typescript
// e2e/pages/timesheets.page.ts
import { Page, Locator, expect } from "@playwright/test";

export class TimesheetsPage {
  readonly page: Page;
  readonly clientSelect: Locator;
  readonly topicSelect: Locator;
  readonly durationPicker: Locator;
  readonly descriptionInput: Locator;
  readonly submitButton: Locator;
  readonly weekStrip: Locator;
  readonly entriesTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.clientSelect = page.getByTestId("client-select");
    this.topicSelect = page.getByTestId("topic-cascade-select");
    this.durationPicker = page.getByTestId("duration-picker");
    this.descriptionInput = page.getByPlaceholder("What did you work on?");
    this.submitButton = page.getByTestId("submit-button");
    this.weekStrip = page.getByTestId("week-strip");
    this.entriesTable = page.locator("tbody");
  }

  async goto() {
    await this.page.goto("/timesheets");
    await expect(this.page).toHaveURL(/\/timesheets/);
  }

  async selectClient(clientName: string) {
    await this.clientSelect.locator("button").first().click();
    await this.page.getByText(clientName).click();
  }

  async selectTopicAndSubtopic(topicName: string, subtopicName: string) {
    // Wait for auto-opened topic select or click trigger
    await this.topicSelect.locator("button").first().click();
    await this.page.getByText(topicName).click(); // drill into subtopics
    await this.page.getByText(subtopicName).click();
  }

  async selectTopicOnly(topicName: string) {
    // For internal/management topics (no subtopics)
    await this.topicSelect.locator("button").first().click();
    await this.page.getByText(topicName).click(); // selects directly
  }

  async selectDuration(hours: number, minutes: number) {
    await this.durationPicker.locator("button").click();
    // Portal renders at body level
    await this.page.getByText("Select hours").waitFor();
    // Click hour button - need to be specific to the grid
    await this.page.locator(`button:has-text("${hours}")`).click();
    // Click minute button
    const minuteStr = minutes.toString().padStart(2, "0");
    await this.page.locator(`button:has-text("${minuteStr}")`).click();
  }

  async fillDescription(text: string) {
    await this.descriptionInput.fill(text);
  }

  async clickLog() {
    await this.submitButton.click();
  }

  async createEntry(params: {
    clientName: string;
    topicName?: string;
    subtopicName?: string;
    hours: number;
    minutes: number;
    description: string;
  }) {
    await this.selectClient(params.clientName);
    if (params.subtopicName) {
      await this.selectTopicAndSubtopic(params.topicName!, params.subtopicName);
    } else {
      await this.selectTopicOnly(params.topicName!);
    }
    await this.selectDuration(params.hours, params.minutes);
    await this.fillDescription(params.description);
    await this.clickLog();
  }

  async getEntryRows() {
    return this.entriesTable.locator("tr");
  }

  // Navigation
  async clickDay(dayNumber: number) {
    await this.weekStrip.getByText(String(dayNumber), { exact: true }).click();
  }

  async clickPrevWeek() {
    await this.page.getByTitle("Previous week").click();
  }

  async clickNextWeek() {
    await this.page.getByTitle("Next week").click();
  }

  async clickToday() {
    await this.page.getByRole("button", { name: "Today" }).click();
  }

  // Edit/Delete
  async clickEditOnRow(rowIndex: number) {
    const row = this.entriesTable.locator("tr").nth(rowIndex);
    await row.getByTitle("Edit entry").click();
  }

  async clickDeleteOnRow(rowIndex: number) {
    const row = this.entriesTable.locator("tr").nth(rowIndex);
    await row.getByTitle("Delete entry").click();
  }

  async confirmDelete() {
    await this.page.getByRole("button", { name: "Delete" }).click();
  }

  async cancelDelete() {
    await this.page.getByRole("button", { name: "Cancel" }).click();
  }

  // Submission
  async clickSubmitTimesheet() {
    await this.page.getByRole("button", { name: /Submit Timesheet/ }).click();
  }

  async isSubmitted(): Promise<boolean> {
    return this.page.getByText("Timesheet Submitted").isVisible();
  }
}
```

### Entry CRUD Spec Pattern
```typescript
// e2e/specs/entry-crud.spec.ts
import { test, expect } from "../fixtures/test";
import { TimesheetsPage } from "../pages/timesheets.page";
import { createRegularEntry } from "../helpers/api-factory";
import { CLIENTS, TOPICS, SUBTOPICS } from "../helpers/seed-data";

test.describe("Entry CRUD", () => {
  let timesheets: TimesheetsPage;

  test.beforeEach(async ({ page, db }) => {
    timesheets = new TimesheetsPage(page);
    await timesheets.goto();
  });

  test("creates a REGULAR entry with prefix subtopic", async ({ page }) => {
    await timesheets.selectClient(CLIENTS.regular.name);
    await timesheets.selectTopicAndSubtopic(
      TOPICS.corporate.name,
      SUBTOPICS.correspondence.name
    );
    // Prefix subtopic auto-fills description
    await expect(timesheets.descriptionInput).toHaveValue(
      `${SUBTOPICS.correspondence.name} `
    );
    await timesheets.fillDescription(
      `${SUBTOPICS.correspondence.name} regarding new contract`
    );
    await timesheets.selectDuration(2, 0);
    await timesheets.clickLog();

    // Verify entry appears
    await expect(page.getByText("regarding new contract")).toBeVisible();
  });
});
```

### Waiting for API Response Pattern
```typescript
// After navigating to a different day, wait for entries to load
async function navigateAndWait(page: Page, timesheets: TimesheetsPage, dayNumber: number) {
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/timesheets?date=") && resp.status() === 200
  );
  await timesheets.clickDay(dayNumber);
  await responsePromise;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `page.click(cssSelector)` | `page.getByRole()`, `page.getByTestId()` | Playwright 1.27+ | More resilient locators, less brittle tests |
| `page.waitForTimeout(ms)` | Auto-waiting assertions | Playwright 1.0+ | Eliminates flakiness, faster tests |
| Helper functions | Page Object Model class | Established pattern | Better encapsulation, IDE autocomplete |
| Direct DB setup in test | `page.request.post()` API factory | Playwright 1.16+ | Uses real auth cookies, validates API contract |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | @playwright/test 1.58.2 |
| Config file | `app/playwright.config.ts` |
| Quick run command | `cd app && npx playwright test --grep "entry-crud"` |
| Full suite command | `cd app && npm run test:e2e` |
| Estimated runtime | ~30-60 seconds (serial, Chromium-only) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-11 | Page Object Model with all methods | e2e (structural) | Verified by all specs using the POM | No -- Wave 0 gap |
| REQ-12 | API data factory via `page.request.post()` | e2e (structural) | Verified by tests using `createEntryViaAPI()` | No -- Wave 0 gap |
| REQ-13 | Create REGULAR entry with prefix subtopic | e2e | `npx playwright test entry-crud --grep "REGULAR"` | No -- Wave 0 gap |
| REQ-14 | Create INTERNAL entry (topic-only) | e2e | `npx playwright test entry-crud --grep "INTERNAL"` | No -- Wave 0 gap |
| REQ-15 | Edit entry: change description + hours | e2e | `npx playwright test entry-crud --grep "edit.*change"` | No -- Wave 0 gap |
| REQ-16 | Edit entry: cancel discards | e2e | `npx playwright test entry-crud --grep "cancel.*edit"` | No -- Wave 0 gap |
| REQ-17 | Delete entry: confirm removes | e2e | `npx playwright test entry-crud --grep "delete.*confirm"` | No -- Wave 0 gap |
| REQ-18 | Delete entry: cancel preserves | e2e | `npx playwright test entry-crud --grep "cancel.*delete"` | No -- Wave 0 gap |
| REQ-19 | WeekStrip: select day | e2e | `npx playwright test navigation --grep "select.*day"` | No -- Wave 0 gap |
| REQ-20 | WeekStrip: prev/next week | e2e | `npx playwright test navigation --grep "prev.*next"` | No -- Wave 0 gap |
| REQ-21 | WeekStrip: Today button | e2e | `npx playwright test navigation --grep "Today"` | No -- Wave 0 gap |
| REQ-22 | WeekStrip: entry persistence | e2e | `npx playwright test navigation --grep "persist"` | No -- Wave 0 gap |
| REQ-23 | Submit day + status indicator | e2e | `npx playwright test submission --grep "submit.*status"` | No -- Wave 0 gap |
| REQ-24 | Auto-prompt modal at 8h | e2e | `npx playwright test submission --grep "auto-prompt\|modal"` | No -- Wave 0 gap |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `cd app && npm run test:e2e`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~30-60 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `e2e/pages/timesheets.page.ts` -- Page Object Model (covers REQ-11)
- [ ] `e2e/helpers/api-factory.ts` -- API data factory (covers REQ-12)
- [ ] `e2e/specs/entry-crud.spec.ts` -- Entry CRUD tests (covers REQ-13 through REQ-18)
- [ ] `e2e/specs/navigation.spec.ts` -- WeekStrip navigation tests (covers REQ-19 through REQ-22)
- [ ] `e2e/specs/submission.spec.ts` -- Submission flow tests (covers REQ-23, REQ-24)

## Open Questions

1. **DurationPicker portal locator precision**
   - What we know: DurationPicker renders its dropdown via `createPortal` to `document.body`. Hours are shown in a 3x3+1 grid with numbers 1-9 and 0.
   - What's unclear: Exact locator needed to distinguish hour "2" button from other "2" text on the page (e.g., entry hours display).
   - Recommendation: Use the "Select hours" heading text as anchor, then locate buttons within the same portal container. May need `page.locator('[tabindex="-1"]').getByText('2')` or similar scoped approach. This will need to be validated during implementation.

2. **WeekStrip day button locator specificity**
   - What we know: Day buttons show the date number (e.g., "25") as text content. The WeekStrip also shows abbreviated day names ("MON", "TUE", etc.).
   - What's unclear: Whether `getByText("25")` is unique enough within the week strip, given day numbers from calendar popup could also match.
   - Recommendation: Scope day selection to within `getByTestId("week-strip")` and use `{ exact: true }` to avoid partial matches. Calendar popup should be closed by default.

3. **Submission auto-prompt timing (REQ-24)**
   - What we know: The submit prompt modal appears when `totalHours >= MIN_SUBMISSION_HOURS && !isSubmitted` after creating an entry. The `totalHours` is tracked client-side by adding `totalHoursForEntry` to the running total.
   - What's unclear: Whether creating entries via API factory and then one via UI will correctly trigger the prompt, since API factory entries don't update the client-side `totalHours` state.
   - Recommendation: For REQ-24, create ~7h of entries via API factory, then `page.goto('/timesheets')` or `page.reload()` to fetch server-side `totalHours`, then create a 1h+ entry via UI. The server response for GET includes `totalHours`, and adding the new entry's hours client-side should cross the 8h threshold.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All source files read directly from `/Users/stefan/projects/veda-legal-timesheets/app/`
- Phase 5 infrastructure: `05-01-SUMMARY.md`, `05-02-SUMMARY.md`, `05-VERIFICATION.md`
- Playwright config: `app/playwright.config.ts` (v1.58.2)
- Seed data: `app/e2e/helpers/seed-data.ts` (deterministic IDs)
- Component source: `EntryForm.tsx`, `EntryCard.tsx`, `EntryRow.tsx`, `WeekStrip.tsx`, `EntriesList.tsx`, `TimesheetsContent.tsx`, `ClientSelect.tsx`, `TopicCascadeSelect.tsx`, `DurationPicker.tsx`, `ConfirmModal.tsx`
- API routes: `app/src/app/api/timesheets/route.ts`, `[id]/route.ts`, `submit/route.ts`

### Secondary (MEDIUM confidence)
- Playwright Page Object Model pattern: standard community pattern, verified against Playwright 1.58 API
- `page.request` API for data factories: verified in Playwright docs -- `page.request` inherits cookies from browser context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages, all Phase 5 infrastructure proven
- Architecture: HIGH -- POM pattern well-established, all component source code analyzed for locator strategies
- Pitfalls: HIGH -- identified from direct analysis of component source (portals, auto-opening, mobile/desktop layout)

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable -- Playwright API, existing codebase)
