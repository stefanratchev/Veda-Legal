import { test, expect } from "../fixtures/test";
import { TimesheetsPage } from "../pages/timesheets.page";
import { createRegularEntry, getToday } from "../helpers/api-factory";

test.describe("WeekStrip Navigation", () => {
  let timesheets: TimesheetsPage;

  test.beforeEach(async ({ page, db }) => {
    timesheets = new TimesheetsPage(page);
  });

  test("selects a specific day and entries reload", async ({ page, db }) => {
    // Create an entry via API for today
    await createRegularEntry(page, getToday(), 1, "Entry for today's date");

    // Navigate to the timesheets page
    await timesheets.goto();

    // Assert entry is visible (use getByRole('cell') to target desktop table only)
    await expect(
      page.getByRole("cell", { name: "Entry for today's date" }).first()
    ).toBeVisible();

    // Compute a different day within the same week
    const today = new Date();
    const todayDayOfMonth = today.getDate();
    // Shift to a different day: if today is Monday (0), go to Tuesday; otherwise go back one day
    const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
    const otherOffset = dayOfWeek === 0 ? 1 : -1; // Monday -> Tuesday, else go back
    const otherDate = new Date(today);
    otherDate.setDate(todayDayOfMonth + otherOffset);
    const otherDayOfMonth = otherDate.getDate();

    // Set up waitForResponse BEFORE clicking the other day
    const loadPromise = timesheets.waitForEntriesLoad();
    await timesheets.clickDay(otherDayOfMonth);
    await loadPromise;

    // Today's entry should NOT be visible on the other day
    await expect(
      page.getByRole("cell", { name: "Entry for today's date" })
    ).toHaveCount(0);

    // Navigate back to today
    const reloadPromise = timesheets.waitForEntriesLoad();
    await timesheets.clickDay(todayDayOfMonth);
    await reloadPromise;

    // Entry should be visible again
    await expect(
      page.getByRole("cell", { name: "Entry for today's date" }).first()
    ).toBeVisible();
  });

  test("prev/next week arrows shift the week", async ({ page, db }) => {
    await timesheets.goto();

    // Compute the current week's Monday date
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    const mondayDate = monday.getDate();

    // Verify current Monday's date is in the WeekStrip (use first() to avoid strict mode)
    await expect(
      timesheets.weekStrip
        .getByText(String(mondayDate), { exact: true })
        .first()
    ).toBeVisible();

    // Click next week
    const nextWeekLoad = timesheets.waitForEntriesLoad();
    await timesheets.clickNextWeek();
    await nextWeekLoad;

    // Next week's Monday should be 7 days later
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    const nextMondayDate = nextMonday.getDate();

    await expect(
      timesheets.weekStrip
        .getByText(String(nextMondayDate), { exact: true })
        .first()
    ).toBeVisible();

    // Click prev week to go back
    const prevWeekLoad = timesheets.waitForEntriesLoad();
    await timesheets.clickPrevWeek();
    await prevWeekLoad;

    // Original Monday should be visible again
    await expect(
      timesheets.weekStrip
        .getByText(String(mondayDate), { exact: true })
        .first()
    ).toBeVisible();
  });

  test("Today button returns to current day", async ({ page, db }) => {
    await timesheets.goto();

    const today = new Date();
    const todayDayOfMonth = today.getDate();

    // Navigate to a different week
    const nextWeekLoad = timesheets.waitForEntriesLoad();
    await timesheets.clickNextWeek();
    await nextWeekLoad;

    // Click Today button to return
    const todayLoad = timesheets.waitForEntriesLoad();
    await timesheets.clickToday();
    await todayLoad;

    // Today's date number should be visible in the strip
    await expect(
      timesheets.weekStrip
        .getByText(String(todayDayOfMonth), { exact: true })
        .first()
    ).toBeVisible();
  });

  test("entry persists when navigating away and back", async ({ page, db }) => {
    // Create entry via API for today
    await createRegularEntry(
      page,
      getToday(),
      2,
      "Persistent entry check for e2e"
    );

    // Navigate to page and verify entry visible
    await timesheets.goto();
    await expect(
      page
        .getByRole("cell", { name: "Persistent entry check for e2e" })
        .first()
    ).toBeVisible();

    // Navigate to a different day
    const today = new Date();
    const todayDayOfMonth = today.getDate();
    const dayOfWeek = (today.getDay() + 6) % 7;
    const otherOffset = dayOfWeek === 0 ? 1 : -1;
    const otherDate = new Date(today);
    otherDate.setDate(todayDayOfMonth + otherOffset);
    const otherDayOfMonth = otherDate.getDate();

    const loadOther = timesheets.waitForEntriesLoad();
    await timesheets.clickDay(otherDayOfMonth);
    await loadOther;

    // Entry should not be visible on different day
    await expect(
      page.getByRole("cell", { name: "Persistent entry check for e2e" })
    ).toHaveCount(0);

    // Navigate back to today
    const loadBack = timesheets.waitForEntriesLoad();
    await timesheets.clickDay(todayDayOfMonth);
    await loadBack;

    // Entry should be visible again -- persisted correctly
    await expect(
      page
        .getByRole("cell", { name: "Persistent entry check for e2e" })
        .first()
    ).toBeVisible();
  });
});
