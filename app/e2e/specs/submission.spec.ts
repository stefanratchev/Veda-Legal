import { test, expect } from "../fixtures/test";
import { TimesheetsPage } from "../pages/timesheets.page";
import {
  createRegularEntry,
  createInternalEntry,
  getToday,
} from "../helpers/api-factory";
import { CLIENTS, TOPICS, SUBTOPICS } from "../helpers/seed-data";

test.describe("Daily Submission", () => {
  let timesheets: TimesheetsPage;

  test.beforeEach(async ({ page, db }) => {
    timesheets = new TimesheetsPage(page);
  });

  test("submits timesheet after 8+ hours", async ({ page, db }) => {
    // Create entries via API factory totaling 9 hours (safely above 8h threshold)
    await createRegularEntry(
      page,
      getToday(),
      4,
      "Morning client correspondence work"
    );
    await createRegularEntry(
      page,
      getToday(),
      3,
      "Afternoon contract review tasks"
    );
    await createInternalEntry(
      page,
      getToday(),
      2,
      "Internal team admin and sync"
    );

    // Navigate to timesheets page
    await timesheets.goto();

    // Verify at least one entry is visible
    await expect(
      page
        .getByRole("cell", { name: "Morning client correspondence work" })
        .first()
    ).toBeVisible();

    // Verify "Submit Timesheet" button is visible (appears when >= 8h and not yet submitted)
    const submitButton = page.getByRole("button", {
      name: /Submit Timesheet/,
    });
    await expect(submitButton).toBeVisible();

    // Click submit - this directly calls the POST (no ConfirmModal for manual submit)
    const submitResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/timesheets/submit") &&
        resp.request().method() === "POST"
    );
    await timesheets.clickSubmitTimesheet();
    await submitResponse;

    // Assert submission indicator is visible (scope to table for desktop view)
    await expect(
      page.getByRole("table").getByText("Timesheet Submitted")
    ).toBeVisible();
  });

  test("auto-prompt modal appears at 8h threshold", async ({ page, db }) => {
    // Create entries via API factory totaling 7 hours (just below threshold)
    await createRegularEntry(
      page,
      getToday(),
      4,
      "First block of client work"
    );
    await createRegularEntry(
      page,
      getToday(),
      3,
      "Second block of client work"
    );

    // Navigate to timesheets page (server returns totalHours=7)
    await timesheets.goto();

    // Verify entries loaded
    await expect(
      page
        .getByRole("cell", { name: "First block of client work" })
        .first()
    ).toBeVisible();

    // Create a 1.5h entry through the UI to cross the 8h threshold
    await timesheets.selectClient(CLIENTS.regular.name);
    await timesheets.selectTopicAndSubtopic(
      TOPICS.corporate.name,
      SUBTOPICS.correspondence.name
    );
    await timesheets.fillDescription(
      "Client correspondence: pushing over 8 hours"
    );
    await timesheets.selectDuration(1, 30);

    // Click Log and wait for POST response
    const postResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/timesheets") &&
        resp.request().method() === "POST" &&
        !resp.url().includes("/submit")
    );
    await timesheets.clickLog();
    await postResponse;

    // The submit prompt modal should auto-appear (totalHours crossed 8h)
    // Modal has title "Submit Timesheet?"
    await expect(page.getByText("Submit Timesheet?")).toBeVisible();

    // Dismiss the modal by clicking "Not yet"
    await timesheets.dismissSubmission();

    // Assert modal is gone
    await expect(page.getByText("Submit Timesheet?")).not.toBeVisible();
  });
});
