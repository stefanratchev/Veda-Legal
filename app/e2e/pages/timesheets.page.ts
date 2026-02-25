import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Timesheets page.
 *
 * Encapsulates all dropdown interactions (ClientSelect, TopicCascadeSelect,
 * DurationPicker) and page navigation so spec files stay readable.
 *
 * Rules:
 * - Only Playwright locators: getByTestId, getByRole, getByText, getByTitle, getByPlaceholder
 * - Zero CSS class selectors
 * - Zero page.waitForTimeout() calls
 */
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

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async goto() {
    await this.page.goto("/timesheets");
    await expect(this.page).toHaveURL(/\/timesheets/);
  }

  /**
   * Click a day in the WeekStrip by its date number.
   * Uses exact matching scoped to week-strip. The .first() handles the rare
   * case where both the button's accessible text and inner span match.
   */
  async clickDay(dayNumber: number) {
    await this.weekStrip
      .getByText(String(dayNumber), { exact: true })
      .first()
      .click();
  }

  async clickPrevWeek() {
    await this.weekStrip.getByTitle("Previous week").first().click();
  }

  async clickNextWeek() {
    await this.weekStrip.getByTitle("Next week").first().click();
  }

  async clickToday() {
    await this.weekStrip.getByRole("button", { name: "Today" }).click();
  }

  /**
   * Returns a promise that resolves when the timesheets entries API responds.
   * Callers should set this up BEFORE the action that triggers the fetch:
   *
   * ```ts
   * const loaded = timesheets.waitForEntriesLoad();
   * await timesheets.clickDay(25);
   * await loaded;
   * ```
   */
  waitForEntriesLoad() {
    return this.page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/timesheets?date=") &&
        resp.status() === 200
    );
  }

  // ---------------------------------------------------------------------------
  // Dropdown interactions
  // ---------------------------------------------------------------------------

  /**
   * Open the ClientSelect dropdown and pick a client by visible name.
   * Scoped to the client-select container to avoid matching entry row text.
   */
  async selectClient(clientName: string) {
    await this.clientSelect.locator("button").first().click();
    await this.clientSelect.getByText(clientName).click();
  }

  /**
   * Select a topic that has subtopics (drill-down flow).
   * Handles both cases: topic select already auto-opened, or needs manual click.
   * Scoped to the topic-cascade-select container to avoid matching entry row text.
   */
  async selectTopicAndSubtopic(topicName: string, subtopicName: string) {
    // Wait for the topic dropdown to be open (auto-opens after client select via setTimeout).
    // If it doesn't auto-open, click the trigger to open it.
    await this.ensureTopicDropdownOpen();

    // Click the topic name to drill into subtopics (scoped to dropdown)
    await this.topicSelect.getByText(topicName).click();

    // Now in the subtopic list, click the subtopic (scoped to dropdown)
    await this.topicSelect.getByText(subtopicName).click();
  }

  /**
   * Select a topic that has no subtopics (direct selection for internal/management).
   * Scoped to the topic-cascade-select container to avoid matching entry row text.
   */
  async selectTopicOnly(topicName: string) {
    await this.ensureTopicDropdownOpen();

    // For topics with no subtopics, clicking selects directly (scoped to dropdown)
    await this.topicSelect.getByText(topicName).click();
  }

  /**
   * Ensure the topic dropdown is open, handling the auto-open race condition.
   * After client selection, EntryForm auto-opens the topic dropdown via setTimeout(0).
   * We wait briefly for the auto-open, then click the trigger if it didn't open.
   */
  private async ensureTopicDropdownOpen() {
    const searchInput = this.page.getByPlaceholder("Search topics...");

    // Wait up to 1 second for auto-open to happen
    try {
      await searchInput.waitFor({ state: "visible", timeout: 1000 });
      return; // dropdown is open
    } catch {
      // auto-open didn't happen, click trigger manually
    }

    await this.topicSelect.locator("button").first().click();
    await searchInput.waitFor({ state: "visible" });
  }

  /**
   * Open the DurationPicker and select hours then minutes.
   *
   * The DurationPicker portal renders at document.body level via createPortal,
   * so we locate the panel at page level using the tabindex=-1 div that receives
   * focus, which contains the "Select hours" heading.
   */
  async selectDuration(hours: number, minutes: number) {
    const hoursPanel = this.page.locator("[tabindex='-1']").filter({ hasText: "Select hours" });

    // Wait briefly for auto-open (DurationPicker auto-opens after topic/subtopic selection).
    // If it doesn't auto-open within 1s, click the trigger manually.
    try {
      await hoursPanel.waitFor({ state: "visible", timeout: 1000 });
    } catch {
      await this.durationPicker.locator("button").click();
      await hoursPanel.waitFor({ state: "visible" });
    }

    // Click the hour button within the panel
    await hoursPanel.getByRole("button", { name: String(hours), exact: true }).click();

    // After selecting hours, the panel switches to minutes step.
    // Re-locate the panel since "Select hours" text is replaced by "Select minutes".
    const minutesPanel = this.page.locator("[tabindex='-1']").filter({ hasText: "Select minutes" });
    await minutesPanel.waitFor({ state: "visible" });

    const minuteStr = minutes.toString().padStart(2, "0");
    await minutesPanel.getByRole("button", { name: minuteStr, exact: true }).click();
  }

  /**
   * Fill the description input, clearing any existing text.
   */
  async fillDescription(text: string) {
    await this.descriptionInput.fill(text);
  }

  // ---------------------------------------------------------------------------
  // Submit / Log / Save
  // ---------------------------------------------------------------------------

  /**
   * Click the Log button (create mode).
   * Uses getByRole to target the visible button only (mobile and desktop variants share data-testid).
   */
  async clickLog() {
    await this.page.getByRole("button", { name: "Log" }).click();
  }

  /**
   * Click the Save button (edit mode).
   * Uses getByRole to target the visible button only (mobile and desktop variants share data-testid).
   */
  async clickSave() {
    await this.page.getByRole("button", { name: "Save" }).click();
  }

  // ---------------------------------------------------------------------------
  // Entry interaction
  // ---------------------------------------------------------------------------

  /**
   * Return the locator for all entry rows in the table body.
   */
  getEntryRows() {
    return this.entriesTable.locator("tr");
  }

  /**
   * Return the count of entry rows currently displayed.
   */
  async getEntryCount(): Promise<number> {
    return this.getEntryRows().count();
  }

  /**
   * Click the edit (pencil) button on the nth entry row.
   * After clicking, the row transforms into an inline EntryForm.
   */
  async clickEditOnRow(rowIndex: number) {
    const row = this.entriesTable.locator("tr").nth(rowIndex);
    await row.getByTitle("Edit entry").click();
  }

  /**
   * Get the description input within the inline edit form (scoped to entries table).
   * In edit mode, the EntryForm renders inside <tbody>, so this avoids matching
   * the create form at the top of the page.
   */
  getEditDescriptionInput() {
    return this.entriesTable.getByPlaceholder("What did you work on?");
  }

  /**
   * Fill the description input in the inline edit form.
   */
  async fillEditDescription(text: string) {
    await this.getEditDescriptionInput().fill(text);
  }

  /**
   * Select duration in the inline edit form's DurationPicker.
   * The edit form has its own DurationPicker within the entries table.
   * The portal still renders at body level, so we use the same panel locator approach.
   */
  async selectEditDuration(hours: number, minutes: number) {
    // Click the DurationPicker button within the entries table (edit form)
    await this.entriesTable.getByTestId("duration-picker").locator("button").click();

    // Wait for the hours step panel (portal at body level)
    const hoursPanel = this.page.locator("[tabindex='-1']").filter({ hasText: "Select hours" });
    await hoursPanel.waitFor({ state: "visible" });

    await hoursPanel.getByRole("button", { name: String(hours), exact: true }).click();

    const minutesPanel = this.page.locator("[tabindex='-1']").filter({ hasText: "Select minutes" });
    await minutesPanel.waitFor({ state: "visible" });

    const minuteStr = minutes.toString().padStart(2, "0");
    await minutesPanel.getByRole("button", { name: minuteStr, exact: true }).click();
  }

  /**
   * Click the delete (trash) button on the nth entry row.
   */
  async clickDeleteOnRow(rowIndex: number) {
    const row = this.entriesTable.locator("tr").nth(rowIndex);
    await row.getByTitle("Delete entry").click();
  }

  /**
   * Confirm deletion in the ConfirmModal.
   */
  async confirmDelete() {
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
  }

  /**
   * Cancel deletion in the ConfirmModal.
   */
  async cancelDelete() {
    await this.page.getByRole("button", { name: "Cancel" }).click();
  }

  /**
   * Cancel edit mode (click the Cancel button in EntryForm).
   */
  async clickCancel() {
    await this.page.getByRole("button", { name: "Cancel" }).click();
  }

  // ---------------------------------------------------------------------------
  // Submission
  // ---------------------------------------------------------------------------

  /**
   * Click the "Submit Timesheet" button.
   */
  async clickSubmitTimesheet() {
    await this.page
      .getByRole("button", { name: /Submit Timesheet/ })
      .click();
  }

  /**
   * Dismiss submission modal by clicking "Not yet".
   */
  async dismissSubmission() {
    await this.page.getByRole("button", { name: "Not yet" }).click();
  }
}
