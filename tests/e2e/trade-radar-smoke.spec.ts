import { test, expect } from "@playwright/test";

/**
 * Smoke tests for all 11 Trade Radar vertical landing pages.
 *
 * Strategy:
 *   1. Each public landing page must load (non-4xx HTTP status).
 *   2. The page must render meaningful content (non-empty body).
 *   3. The primary CTA ("Start", "Get Started", "Try Free", "Subscribe", etc.)
 *      must be visible — if it's gone the signup funnel is broken.
 *   4. No fatal console errors (third-party noise filtered out).
 *
 * We do NOT click through to Stripe — just verifying the landing pages
 * are intact and the CTA is reachable.
 */

interface RadarPage {
  slug: string;
  path: string;
  /** Text visible somewhere on the page that identifies the vertical */
  identifierText: string | RegExp;
}

const RADAR_PAGES: RadarPage[] = [
  { slug: "roofing-radar",      path: "/roofing-radar",       identifierText: /roof/i },
  { slug: "hvac-radar",         path: "/hvac-radar",          identifierText: /hvac|heating|cooling/i },
  { slug: "electrical-radar",   path: "/electrical-radar",    identifierText: /electric/i },
  { slug: "pest-control-radar", path: "/pest-control-radar",  identifierText: /pest/i },
  { slug: "gutters-radar",      path: "/gutters-radar",       identifierText: /gutter/i },
  { slug: "buyer-radar",        path: "/buyer-radar",         identifierText: /buyer|mortgage/i },
];

const NOISE_PATTERN = /speed-insights|favicon|chrome-extension|googletagmanager|fbevents|hotjar/i;

test.describe("Trade Radar landing pages", () => {
  for (const page of RADAR_PAGES) {
    test(`${page.slug}: loads without fatal errors`, async ({ page: pw }) => {
      const errors: string[] = [];
      pw.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      pw.on("console", (msg) => {
        if (msg.type() === "error" && !NOISE_PATTERN.test(msg.text())) {
          errors.push(msg.text());
        }
      });

      const response = await pw.goto(page.path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 0, `${page.path} returned non-2xx`).toBeLessThan(400);

      await pw.waitForTimeout(1500);
      const bodyText = (await pw.locator("body").innerText()).trim();
      expect(bodyText.length, `${page.path} rendered an empty body`).toBeGreaterThan(20);

      expect(
        errors.filter((e) => !NOISE_PATTERN.test(e)),
        `Fatal errors on ${page.path}`,
      ).toEqual([]);
    });

    test(`${page.slug}: vertical identifier text is visible`, async ({ page: pw }) => {
      await pw.goto(page.path, { waitUntil: "domcontentloaded" });
      await pw.waitForTimeout(1500);
      const identifier = pw.getByText(page.identifierText).first();
      await expect(identifier).toBeVisible({ timeout: 10_000 });
    });

    test(`${page.slug}: primary CTA is visible and enabled`, async ({ page: pw }) => {
      await pw.goto(page.path, { waitUntil: "domcontentloaded" });
      await pw.waitForTimeout(2000);

      const cta = pw
        .getByRole("button", { name: /start|get started|subscribe|try free|learn more|sign up/i })
        .or(pw.getByRole("link", { name: /start|get started|subscribe|try free|learn more/i }))
        .first();

      // CTA must exist somewhere on the page
      await expect(cta).toBeVisible({ timeout: 10_000 });
      // Must not be disabled
      await expect(cta).not.toBeDisabled();
    });
  }
});

test.describe("Trade Radar demo pages", () => {
  const DEMO_PATHS = [
    "/roofing-radar/demo",
    "/hvac-radar/demo",
    "/electrical-radar/demo",
    "/pest-control-radar/demo",
    "/gutters-radar/demo",
  ];

  for (const path of DEMO_PATHS) {
    test(`${path}: loads without fatal errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (msg) => {
        if (msg.type() === "error" && !NOISE_PATTERN.test(msg.text())) {
          errors.push(msg.text());
        }
      });

      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 0, `${path} returned non-2xx`).toBeLessThan(400);

      await page.waitForTimeout(1500);
      const bodyText = (await page.locator("body").innerText()).trim();
      expect(bodyText.length, `${path} rendered an empty body`).toBeGreaterThan(20);

      expect(errors.filter((e) => !NOISE_PATTERN.test(e))).toEqual([]);
    });
  }
});
