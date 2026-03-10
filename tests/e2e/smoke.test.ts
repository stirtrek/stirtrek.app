import { test, expect } from "@playwright/test";

test.describe("Marketing pages", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/conference/i);
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("body")).toContainText("Essential");
  });
});

test.describe("Event pages", () => {
  test("schedule page loads for default event", async ({ page }) => {
    const response = await page.goto("/stirtrek/schedule");
    // Should resolve to a valid page (200) or redirect to login
    expect(response?.status()).toBeLessThan(500);
  });

  test("speakers page loads", async ({ page }) => {
    const response = await page.goto("/stirtrek/speakers");
    expect(response?.status()).toBeLessThan(500);
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/stirtrek/login");
    await expect(page.locator("body")).toContainText(/sign in|log in|email/i);
  });
});
