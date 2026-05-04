import { test, expect } from "@playwright/test";

/**
 * Extended checkout flow E2E tests.
 *
 * Covers TechAlert, FieldDesk, Mortgage Radar, and Trade Radar checkout paths:
 *   1. Landing page CTA is visible and not disabled.
 *   2. Success URL (post-Stripe redirect) shows a confirmation state.
 *   3. Cancel URL leaves the page in a clean baseline (no banner, no error).
 *
 * Does NOT drive real Stripe — uses synthetic session IDs to exercise the
 * post-redirect UI branches only.
 */

interface CheckoutCase {
  product: string;
  landingPath: string;
  ctaText: RegExp;
  successPath: string;
  successText: RegExp;
  cancelPath: string;
}

const CASES: CheckoutCase[] = [
  {
    product: "TechAlert",
    landingPath: "/hire-alert",
    ctaText: /get started|start|subscribe|try/i,
    successPath: "/talent-radar/dashboard",
    successText: /talent radar|techalert|dashboard/i,
    cancelPath: "/hire-alert",
  },
  {
    product: "FieldDesk",
    landingPath: "/fielddesk",
    ctaText: /start|get started|subscribe/i,
    successPath: "/field-service?success=1&session_id=cs_test_synthetic",
    successText: /fielddesk|field service|activating/i,
    cancelPath: "/fielddesk",
  },
  {
    product: "Mortgage Radar",
    landingPath: "/mortgage-radar",
    ctaText: /start|subscribe|get started|activate/i,
    successPath: "/mortgage-radar?success=1&session_id=cs_test_synthetic&tier=standard",
    successText: /mortgage radar|activating|receipt/i,
    cancelPath: "/mortgage-radar",
  },
  {
    product: "Roofing Radar (Trade)",
    landingPath: "/roofing-radar",
    ctaText: /start|subscribe|get started|activate|try/i,
    successPath: "/roofing-radar?status=success&session_id=cs_test_synthetic",
    successText: /roofing|radar|receipt|activating/i,
    cancelPath: "/roofing-radar",
  },
  {
    product: "Dead Lead Reactivation",
    landingPath: "/dead-lead-intake",
    ctaText: /start|upload|reactivate|get started/i,
    successPath: "/dead-lead-intake?status=success&session_id=cs_test_synthetic",
    successText: /dead lead|reactivat|receipt|activating/i,
    cancelPath: "/dead-lead-intake",
  },
  {
    product: "Missed-Call Catch",
    landingPath: "/missed-call",
    ctaText: /start|subscribe|get started|activate/i,
    successPath: "/missed-call?status=success&session_id=cs_test_synthetic",
    successText: /missed.?call|activating|receipt/i,
    cancelPath: "/missed-call",
  },
];

const NOISE = /speed-insights|favicon|chrome-extension|googletagmanager|fbevents|hotjar/i;

test.describe("Checkout landing page CTAs", () => {
  for (const c of CASES) {
    test(`${c.product}: landing page CTA is visible and enabled`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      await page.goto(c.landingPath, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      const cta = page
        .getByRole("button", { name: c.ctaText })
        .or(page.getByRole("link", { name: c.ctaText }))
        .first();

      await expect(cta).toBeVisible({ timeout: 12_000 });
      await expect(cta).not.toBeDisabled();

      expect(errors.filter((e) => !NOISE.test(e))).toEqual([]);
    });
  }
});

test.describe("Post-checkout success pages", () => {
  for (const c of CASES) {
    test(`${c.product}: success page renders confirmation content`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      await page.goto(c.successPath, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);

      // Page must not be blank
      const body = (await page.locator("body").innerText()).trim();
      expect(body.length, `${c.product} success page was blank`).toBeGreaterThan(20);

      // Product name or confirmation signal must appear somewhere
      const match = page.getByText(c.successText).first();
      await expect(match).toBeVisible({ timeout: 12_000 });

      expect(errors.filter((e) => !NOISE.test(e))).toEqual([]);
    });
  }
});

test.describe("Post-checkout cancel pages", () => {
  for (const c of CASES) {
    test(`${c.product}: cancel/landing page has no receipt banner`, async ({ page }) => {
      await page.goto(c.cancelPath, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      // Receipt/activation banner must NOT be present on the cancel path
      const banner = page.getByText(/activating|receipt confirmed|order processing/i).first();
      const bannerVisible = await banner.isVisible().catch(() => false);
      expect(bannerVisible, `${c.product} cancel page unexpectedly shows a receipt banner`).toBe(false);
    });
  }
});

test.describe("Checkout page SEO basics", () => {
  const SEO_PAGES = [
    { path: "/hire-alert",    expectedTitle: /techalert|hire alert|talent/i },
    { path: "/mortgage-radar", expectedTitle: /mortgage radar/i },
    { path: "/fielddesk",     expectedTitle: /fielddesk|field desk/i },
  ];

  for (const p of SEO_PAGES) {
    test(`${p.path}: page title contains product name`, async ({ page }) => {
      await page.goto(p.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      await expect(page).toHaveTitle(p.expectedTitle, { timeout: 8_000 });
    });
  }
});
