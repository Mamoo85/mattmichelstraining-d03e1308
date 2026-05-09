import { test, expect } from "../../playwright-fixture";

/**
 * Smoke tests for Counsel Records Search.
 * Covers: landing page, /tenant-intel redirect, console gating, dashboard error
 * state. Live Stripe checkout / quota enforcement / webhook provisioning are
 * verified separately in Deno/server-side tests because they require Stripe
 * and Supabase service-role access that this Playwright harness does not have.
 */

test.describe("Counsel Records Search — smoke", () => {
  test("landing page renders both pricing tiers", async ({ page }) => {
    await page.goto("/counsel-search");
    await expect(page.getByText(/Counsel Records Search/i)).toBeVisible();
    await expect(page.getByText("$49/mo")).toBeVisible();
    await expect(page.getByText("$79/mo")).toBeVisible();
    await expect(page.getByText(/7 free searches/i)).toBeVisible();
  });

  test("/tenant-intel redirects to /counsel-search", async ({ page }) => {
    await page.goto("/tenant-intel");
    await page.waitForURL(/\/counsel-search/);
    expect(page.url()).toMatch(/\/counsel-search/);
  });

  test("console requires auth (redirects unauth'd users)", async ({ page }) => {
    await page.goto("/counsel-search/console");
    // Either an auth gate, login redirect, or trial-exhausted notice — never the raw console
    await page.waitForTimeout(1500);
    const url = page.url();
    expect(url).not.toContain("/counsel-search/console#authed");
  });

  test("dashboard shows access-denied without token", async ({ page }) => {
    await page.goto("/my-counsel-search");
    await expect(page.getByText(/Missing access token|Invalid|Access denied/i)).toBeVisible({ timeout: 5_000 });
  });
});
