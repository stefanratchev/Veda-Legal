import { test, expect } from "../fixtures/test";
import { TimesheetsPage } from "../pages/timesheets.page";
import { createRegularEntry, getToday } from "../helpers/api-factory";
import { CLIENTS, TOPICS, SUBTOPICS } from "../helpers/seed-data";

test.describe("Entry CRUD", () => {
  let timesheets: TimesheetsPage;

  test.beforeEach(async ({ page, db }) => {
    timesheets = new TimesheetsPage(page);
    await timesheets.goto();
  });

  test("creates entry for REGULAR client with prefix subtopic", async ({
    page,
  }) => {
    await timesheets.selectClient(CLIENTS.regular.name);
    await timesheets.selectTopicAndSubtopic(
      TOPICS.corporate.name,
      SUBTOPICS.correspondence.name
    );

    // Prefix subtopic should pre-fill description with trailing space
    await expect(timesheets.descriptionInput).toHaveValue(
      `${SUBTOPICS.correspondence.name} `
    );

    // Fill description with valid text (>= 10 chars total)
    await timesheets.fillDescription(
      "Client correspondence: regarding new contract terms"
    );
    await timesheets.selectDuration(2, 0);

    // Set up response wait BEFORE clicking Log
    const responsePromise = page.waitForResponse("**/api/timesheets");
    await timesheets.clickLog();
    await responsePromise;

    // Dismiss submit prompt modal if it appears (auto-prompt at threshold)
    const submitPrompt = page.getByText("Submit Timesheet?");
    if (await submitPrompt.isVisible().catch(() => false)) {
      await timesheets.dismissSubmission();
    }

    // Assert the entry appears in the desktop table
    await expect(
      timesheets.entriesTable.getByText("regarding new contract terms")
    ).toBeVisible();
    await expect(timesheets.getEntryRows()).toHaveCount(1);
  });

  test("creates entry for INTERNAL client with topic-only", async ({
    page,
  }) => {
    await timesheets.selectClient(CLIENTS.internal.name);
    await timesheets.selectTopicOnly(TOPICS.firmAdmin.name);

    // Fill description with valid text (>= 10 chars)
    await timesheets.fillDescription(
      "Firm Administration - weekly team sync meeting"
    );
    await timesheets.selectDuration(1, 30);

    // Set up response wait BEFORE clicking Log
    const responsePromise = page.waitForResponse("**/api/timesheets");
    await timesheets.clickLog();
    await responsePromise;

    // Dismiss submit prompt modal if it appears
    const submitPrompt = page.getByText("Submit Timesheet?");
    if (await submitPrompt.isVisible().catch(() => false)) {
      await timesheets.dismissSubmission();
    }

    // Assert the entry appears in the desktop table
    await expect(
      timesheets.entriesTable.getByText(
        "Firm Administration - weekly team sync meeting"
      )
    ).toBeVisible();
    await expect(timesheets.getEntryRows()).toHaveCount(1);
  });

  test.describe("Edit entry", () => {
    test.beforeEach(async ({ page }) => {
      // Create a test entry via API factory
      const today = getToday();
      await createRegularEntry(page, today, 2, "Original description text");
      // Reload page to see the entry
      await timesheets.goto();
    });

    test("edits entry description and hours", async ({ page }) => {
      // Verify the entry is visible
      await expect(
        timesheets.entriesTable.getByText("Original description text")
      ).toBeVisible();

      // Click edit on the first entry row
      await timesheets.clickEditOnRow(0);

      // Wait for the inline edit form to appear (scoped to entries table)
      await expect(timesheets.getEditDescriptionInput()).toBeVisible();

      // Clear and fill description with new text (scoped to edit form)
      await timesheets.fillEditDescription(
        "Updated description for edit test"
      );

      // Change duration from 2:00 to 3:30 (scoped to edit form)
      await timesheets.selectEditDuration(3, 30);

      // Set up PATCH response wait BEFORE clicking Save
      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/timesheets/") &&
          resp.request().method() === "PATCH"
      );
      await timesheets.clickSave();
      await responsePromise;

      // Assert new description is visible
      await expect(
        timesheets.entriesTable.getByText(
          "Updated description for edit test"
        )
      ).toBeVisible();
      // Assert old description is gone
      await expect(
        timesheets.entriesTable.getByText("Original description text")
      ).not.toBeVisible();
    });

    test("cancel edit discards changes", async ({ page }) => {
      // Verify the entry is visible
      await expect(
        timesheets.entriesTable.getByText("Original description text")
      ).toBeVisible();

      // Click edit on the first entry row
      await timesheets.clickEditOnRow(0);

      // Wait for the inline edit form (scoped to entries table)
      await expect(timesheets.getEditDescriptionInput()).toBeVisible();

      // Fill description with different text (scoped to edit form)
      await timesheets.fillEditDescription("This should not be saved");

      // Click Cancel to discard changes
      await timesheets.clickCancel();

      // Assert original description is still visible
      await expect(
        timesheets.entriesTable.getByText("Original description text")
      ).toBeVisible();
      // Assert the unsaved text is NOT visible
      await expect(
        page.getByText("This should not be saved")
      ).not.toBeVisible();
    });
  });

  test.describe("Delete entry", () => {
    test.beforeEach(async ({ page }) => {
      // Create a test entry via API factory
      const today = getToday();
      await createRegularEntry(page, today, 2, "Original description text");
      // Reload page to see the entry
      await timesheets.goto();
    });

    test("confirm delete removes entry", async ({ page }) => {
      // Verify entry visible and count is 1
      await expect(
        timesheets.entriesTable.getByText("Original description text")
      ).toBeVisible();
      await expect(timesheets.getEntryRows()).toHaveCount(1);

      // Click delete on the first entry row
      await timesheets.clickDeleteOnRow(0);

      // Wait for ConfirmModal to appear
      await expect(page.getByText("Delete Entry")).toBeVisible();

      // Set up DELETE response wait BEFORE confirming
      // DELETE goes to /api/timesheets?id=... (query param, not path segment)
      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/timesheets") &&
          resp.request().method() === "DELETE"
      );
      await timesheets.confirmDelete();
      await responsePromise;

      // Assert entry count is 0
      await expect(timesheets.getEntryRows()).toHaveCount(0);
    });

    test("cancel delete preserves entry", async ({ page }) => {
      // Verify entry visible and count is 1
      await expect(
        timesheets.entriesTable.getByText("Original description text")
      ).toBeVisible();
      await expect(timesheets.getEntryRows()).toHaveCount(1);

      // Click delete on the first entry row
      await timesheets.clickDeleteOnRow(0);

      // Wait for ConfirmModal to appear
      await expect(page.getByText("Delete Entry")).toBeVisible();

      // Click Cancel to dismiss
      await timesheets.cancelDelete();

      // Assert ConfirmModal is gone
      await expect(page.getByText("Delete Entry")).not.toBeVisible();

      // Assert entry is still visible and count is still 1
      await expect(
        timesheets.entriesTable.getByText("Original description text")
      ).toBeVisible();
      await expect(timesheets.getEntryRows()).toHaveCount(1);
    });
  });
});
