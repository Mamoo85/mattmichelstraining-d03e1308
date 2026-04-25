import { test, expect, devices } from "@playwright/test";

/**
 * Mobile (iPhone 13) E2E coverage for the receipt status banner on the
 * checkout success pages. Drives the banner through its lifecycle by mocking
 * the `get-receipt-status` edge function at the network layer.
 *
 * States exercised:
 *   1. pending → paid → fulfilled
 *   2. pending → timeout (recovery UI with retry + Email/Text Matt)
 */

const SESSION_ID = "cs_test_synthetic1234567890";
const SUCCESS_URL = `/bundle-revenue-suite?status=success&session_id=${SESSION_ID}`;
const RECEIPT_FN = /\/functions\/v1\/get-receipt-status/;
const RESEND_FN = /\/functions\/v1\/resend-receipt/;

test.use({ ...devices["iPhone 13"] });

test.describe("Receipt banner — mobile", () => {
  test("transitions pending → paid → fulfilled", async ({ page }) => {
    let calls = 0;
    await page.route(RECEIPT_FN, async (route) => {
      calls += 1;
      // Sequence: first call pending, second paid, third+ fulfilled
      const status = calls === 1 ? "pending" : calls === 2 ? "paid" : "fulfilled";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status,
          productType: "bundle_revenue_suite",
          fulfilledAt: status === "fulfilled" ? new Date().toISOString() : null,
          email: "buyer@example.com",
        }),
      });
    });

    // Stub resend endpoint so the CheckEmailCard CTA is exercisable
    await page.route(RESEND_FN, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, sent_to: "buyer@example.com" }),
      });
    });

    await page.goto(SUCCESS_URL);

    // Pending state visible first
    await expect(page.getByTestId("receipt-banner-pending")).toBeVisible();

    // Eventually transitions to fulfilled (paid is transient)
    await expect(page.getByTestId("receipt-banner-fulfilled")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("receipt-banner-fulfilled")).toContainText(
      /Receipt ready/i
    );

    // Check-email card should also be present alongside the banner
    await expect(page.getByTestId("check-email-card")).toBeVisible();
  });

  test("shows recovery UI when polling times out", async ({ page }) => {
    // Always respond pending — forces the 60s window to elapse
    await page.route(RECEIPT_FN, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "pending" }),
      });
    });

    await page.goto(SUCCESS_URL);

    await expect(page.getByTestId("receipt-banner-pending")).toBeVisible();

    // Recovery UI appears once the 60s timeout fires.
    await expect(page.getByTestId("receipt-banner-timeout")).toBeVisible({
      timeout: 75_000,
    });

    const timeoutEl = page.getByTestId("receipt-banner-timeout");
    await expect(timeoutEl).toContainText(/Taking longer than usual/i);

    // Retry, Email Matt, and Text Matt actions all rendered
    await expect(page.getByTestId("receipt-banner-retry")).toBeVisible();
    await expect(timeoutEl.getByRole("link", { name: /Email Matt/i })).toBeVisible();
    await expect(timeoutEl.getByRole("link", { name: /Text \(313\) 992-1219/i })).toBeVisible();

    // Touch targets must satisfy the 44px minimum on mobile
    const retryBox = await page.getByTestId("receipt-banner-retry").boundingBox();
    expect(retryBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
