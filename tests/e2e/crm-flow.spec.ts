import { test, expect } from "@playwright/test";

test.describe("CRM flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.route(
      /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg)/i,
      (route) => route.fulfill({ status: 200, body: "{}" }),
    );
  });

  test("CRM inbox page renders", async ({ page }) => {
    await page.goto("/crm/inbox");
    await expect(page.locator("body")).toBeVisible();
  });

  test("CRM customers page renders", async ({ page }) => {
    await page.goto("/crm/customers");
    await expect(page.locator("body")).toBeVisible();
  });

  test("CRM pipeline page renders", async ({ page }) => {
    await page.goto("/crm/pipeline");
    await expect(page.locator("body")).toBeVisible();
  });

  test("CRM tasks page renders", async ({ page }) => {
    await page.goto("/crm/tasks");
    await expect(page.locator("body")).toBeVisible();
  });

  test("CRM reports page renders", async ({ page }) => {
    await page.goto("/crm/reports");
    await expect(page.locator("body")).toBeVisible();
  });

  test("CRM orders page renders", async ({ page }) => {
    await page.goto("/crm/orders");
    await expect(page.locator("body")).toBeVisible();
  });

  test("CRM chats page renders", async ({ page }) => {
    await page.goto("/crm/chats");
    await expect(page.locator("body")).toBeVisible();
  });

  test("CRM users page renders", async ({ page }) => {
    await page.goto("/crm/users");
    await expect(page.locator("body")).toBeVisible();
  });
});
