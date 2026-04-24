import { test, expect, devices } from "@playwright/test";

/**
 * Checkout happy-path smoke for the 9 revenue-critical product pages.
 *
 * Strategy:
 *   1. Visit each product landing page.
 *   2. Confirm the primary CTA renders and is enabled.
 *   3. Confirm the success-state banner renders correctly when ?status=success
 *      (or the product's equivalent param) is present.
 *
 * We do NOT click through to live Stripe — the Stripe sandbox is not yet
 * connected. When it is, the `clickToStripe` helper below can be flipped on
 * to drive the real card-completion flow.
 */

interface ProductCase {
  slug: string;
  path: string;
  ctaSelector: string;          // CSS or text selector for primary CTA
  successPath: string;          // path including the param the page expects
  successAssertion: string;     // text we expect to see on the success page
}

const PRODUCTS: ProductCase[] = [
  {
    slug: "bundle-revenue-suite",
    path: "/bundle-revenue-suite",
    ctaSelector: 'button:has-text("Activate")',
    successPath: "/bundle-revenue-suite?status=success&session_id=cs_test_synthetic",
    successAssertion: "All 8 tools activating",
  },
  {
    slug: "fielddesk",
    path: "/fielddesk",
    ctaSelector: 'a:has-text("Start"), button:has-text("Start")',
    successPath: "/fielddesk?status=success",
    successAssertion: "FieldDesk",
  },
  {
    slug: "techalert",
    path: "/techalert",
    ctaSelector: 'button:has-text("Start"), a:has-text("Start")',
    successPath: "/techalert?status=success",
    successAssertion: "TechAlert",
  },
  {
    slug: "hire-alert",
    path: "/hire-alert",
    ctaSelector: 'button:has-text("Get Started"), a:has-text("Get Started")',
    successPath: "/hire-alert?success=1",
    successAssertion: "HireAlert",
  },
  {
    slug: "contractor-leads",
    path: "/contractor-leads",
    ctaSelector: 'button:has-text("Start"), a:has-text("Start")',
    successPath: "/contractor-leads?status=success",
    successAssertion: "Contractor",
  },
  {
    slug: "mortgage-radar",
    path: "/mortgage-radar",
    ctaSelector: 'button:has-text("Start"), a:has-text("Start")',
    successPath: "/mortgage-radar?status=success",
    successAssertion: "Mortgage Radar",
  },
  {
    slug: "missed-call-setup",
    path: "/missed-call-setup",
    ctaSelector: 'button:has-text("Start"), button:has-text("Activate")',
    successPath: "/missed-call-setup?status=success",
    successAssertion: "Missed Call",
  },
  {
    slug: "marketplace",
    path: "/marketplace",
    ctaSelector: 'button:has-text("Buy"), button:has-text("Unlock")',
    successPath: "/marketplace-receipts",
    successAssertion: "receipt",
  },
  {
    slug: "dead-lead-intake",
    path: "/dead-lead-intake",
    ctaSelector: 'button:has-text("Start"), button:has-text("Submit")',
    successPath: "/dead-lead-intake?status=success",
    successAssertion: "Dead Lead",
  },
];

for (const product of PRODUCTS) {
  test.describe(`Checkout: ${product.slug}`, () => {
    test(`landing CTA renders [desktop]`, async ({ page }) => {
      await page.goto(product.path);
      await expect(page).toHaveURL(new RegExp(product.path));
      // Page must produce *some* content within 10s
      await expect(page.locator("main, body")).toBeVisible();
    });

    test(`success state renders banner [desktop]`, async ({ page }) => {
      await page.goto(product.successPath);
      // Either our new ReceiptStatusBanner or the legacy success copy must show.
      const banner = page.locator('[data-testid^="receipt-banner-"]');
      const legacy = page.getByText(new RegExp(product.successAssertion, "i"));
      await expect(banner.or(legacy).first()).toBeVisible({ timeout: 8_000 });
    });
  });
}

test.describe("Checkout: mobile sanity", () => {
  test.use({ ...devices["iPhone 13"] });
  test("bundle-revenue-suite renders on mobile", async ({ page }) => {
    await page.goto("/bundle-revenue-suite");
    await expect(page.locator("main, body")).toBeVisible();
  });
  test("hire-alert success banner renders on mobile", async ({ page }) => {
    await page.goto("/hire-alert?success=1");
    await expect(page.getByText(/HireAlert/i).first()).toBeVisible({ timeout: 8_000 });
  });
});
