import { test, expect } from "../fixtures/test";

test.describe("Smoke Test", () => {
  test("loads timesheets page without redirect to /login", async ({ page, db }) => {
    await page.goto("/timesheets");

    // Should NOT be redirected to /login — proves JWT auth bypass works
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/timesheets/);

    // Key UI components should be visible — proves data-testid attributes work
    // Scope to main content area to avoid matching any duplicates from responsive rendering
    const main = page.getByRole("main");
    await expect(main.getByTestId("client-select")).toBeVisible();
    await expect(main.getByTestId("topic-cascade-select")).toBeVisible();
    await expect(main.getByTestId("duration-picker")).toBeVisible();
    await expect(main.getByTestId("week-strip")).toBeVisible();
  });

  test("dropdowns contain seed data", async ({ page, db }) => {
    await page.goto("/timesheets");

    // Open client dropdown by clicking the trigger button inside client-select
    const main = page.getByRole("main");
    await main.getByTestId("client-select").locator("button").first().click();

    // Verify seed client is present — proves test database seeding works
    await expect(
      page.getByRole("option", { name: "Balkanova Industries" }).or(
        main.getByTestId("client-select").getByText("Balkanova Industries")
      )
    ).toBeVisible();
  });
});
