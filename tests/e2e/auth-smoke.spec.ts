import { test, expect } from "@playwright/test";

test.describe("Auth flow smoke", () => {
  test("auth page renders email + password fields", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/auth", { waitUntil: "domcontentloaded" });

    // Email + password inputs must exist
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await expect(passwordInput).toBeVisible();

    // No fatal page errors
    expect(errors.filter((e) => !/speed-insights|favicon|chrome-extension/i.test(e))).toEqual([]);
  });

  test("dashboard route redirects unauthenticated users to /auth", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    // Either redirected to /auth or a 'sign in' CTA visible
    await page.waitForTimeout(2000);
    const url = page.url();
    const hasAuthRedirect = url.includes("/auth") || (await page.getByText(/sign\s*in|log\s*in/i).first().isVisible().catch(() => false));
    expect(hasAuthRedirect).toBeTruthy();
  });
});
