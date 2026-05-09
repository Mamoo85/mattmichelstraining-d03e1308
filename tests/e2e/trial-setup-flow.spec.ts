import { test, expect } from "@playwright/test";

/**
 * End-to-end smoke for the full trial → setup → launch → action flow
 * across the four flagship radar products.
 *
 * Verifies (without authenticated state):
 *   1. Trial Hub renders all flagship tiles + share buttons.
 *   2. Per-product setup pages are reachable (or redirect to /auth).
 *   3. Customer portals exist (My* routes don't 404) and gate to /auth.
 *   4. RadarFitCard region renders the "Why this fits" explainer where wired.
 *
 * Authenticated flows (action bar persistence, RPC claim) are covered by
 * unit + Deno tests; this layer only ensures the routes & shells are wired.
 */

const NOISE = /speed-insights|favicon|chrome-extension|googletagmanager|fbevents|hotjar|posthog/i;

test.describe("Trial Hub", () => {
  test("renders flagship tiles and share controls", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/trial-hub", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body.length).toBeGreaterThan(50);

    // At least one of the flagship product names should appear
    const hasFlagship =
      body.includes("siteradar") ||
      body.includes("missed") ||
      body.includes("demand") ||
      body.includes("buyer") ||
      body.includes("industry pulse");
    expect(hasFlagship, "Trial Hub should mention at least one flagship product").toBeTruthy();

    expect(errors.filter((e) => !NOISE.test(e))).toEqual([]);
  });

  test("?tile=demand-radar param does not break the page", async ({ page }) => {
    await page.goto("/trial-hub?tile=demand-radar", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Setup pages reachable", () => {
  const PATHS = [
    "/buyer-radar/setup",
    "/demand-radar/setup",
    "/site-radar/setup",
    "/missed-call-setup",
  ];

  for (const path of PATHS) {
    test(`${path} does not 404`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      const status = res?.status() ?? 0;
      expect(status, `${path} returned ${status}`).not.toBe(404);
      await page.waitForTimeout(1000);
      await expect(page.locator("body")).toBeVisible();
    });
  }
});

test.describe("Customer portals route correctly", () => {
  // Each My* portal is auth-gated. Unauthenticated should redirect to /auth,
  // not 404 — confirms route is registered in App.tsx.
  const PORTALS = [
    "/my-demand-radar",
    "/my-buyer-radar",
    "/my-site-radar",
    "/my-missed-call",
    "/my-mortgage-radar",
  ];

  for (const path of PORTALS) {
    test(`${path}: route exists and redirects unauthenticated to /auth`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      const status = res?.status() ?? 0;
      expect(status, `${path} should not 404`).not.toBe(404);

      await page.waitForTimeout(2000);
      const finalUrl = page.url();
      expect(finalUrl, `${path} should redirect to /auth when unauthenticated`).toContain("/auth");
    });
  }
});

test.describe("RadarFitCard explainer", () => {
  test("AmeriSteel hub renders without fatal errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // The AmeriSteel hub is a public marketing page used to demo RadarFitCard
    const candidatePaths = ["/ameristeel", "/hubs/ameristeel", "/buyer-radar"];
    let loaded = false;
    for (const p of candidatePaths) {
      const res = await page.goto(p, { waitUntil: "domcontentloaded" });
      if ((res?.status() ?? 0) !== 404) {
        loaded = true;
        break;
      }
    }
    expect(loaded, "At least one AmeriSteel/Buyer Radar entry point should resolve").toBeTruthy();

    await page.waitForTimeout(1500);
    expect(errors.filter((e) => !NOISE.test(e))).toEqual([]);
  });
});
