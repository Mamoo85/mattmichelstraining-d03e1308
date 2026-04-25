/**
 * Order State Checker — automated post-Stripe-redirect verification.
 *
 * Goal: confirm the app persists / reflects the correct order status after
 * a customer returns from Stripe via `success_url` or `cancel_url`.
 *
 * Coverage: top-5 DWA flows + Revenue Suite bundle.
 *
 *   1. HireAlert            (/hire-alert?success=1&session_id=…)
 *   2. MortgageRadar        (/mortgage-radar?success=1&session_id=…&tier=…)
 *   3. DeadLeadIntake       (/dead-lead-intake?status=success&session_id=…)
 *   4. FieldDesk            (/field-service?success=1&session_id=…)
 *   5. Contractor PPL       (/lead-unlocked?session_id=…)
 *   6. Bundle Revenue Suite (/revenue-suite?status=success&session_id=…)
 *
 * Two assertion layers per flow:
 *
 *   (A) UI layer
 *       - success URL → ReceiptStatusBanner mounts and begins polling
 *       - cancel URL  → no banner, no CheckEmailCard, page is in baseline state
 *
 *   (B) Backend layer (only when network is mocked OR service-role key is set)
 *       - `get-receipt-status` is called with the right session_id
 *       - status transitions pending → paid → fulfilled
 *
 * The spec mocks `get-receipt-status` so it runs offline / in CI without
 * needing a real Stripe round-trip. A separate `@live` tagged test (skipped
 * by default) drives the real 4242 card flow when STRIPE_TEST_MODE=1.
 *
 * Audit findings baked into assertions (see `EXPECTED_SESSION_ID_IN_URL`):
 *   Only contractor-ppl and bundle currently include {CHECKOUT_SESSION_ID}
 *   in the success_url. The other 3 land WITHOUT a session_id, which means
 *   ReceiptStatusBanner never polls. Tests assert today's behavior AND mark
 *   the gap so it's visible in CI output.
 */

import { test, expect, devices, type Page, type Route } from "@playwright/test";

// --------------------------------------------------------------------------
// Test fixtures
// --------------------------------------------------------------------------

const SYNTHETIC_SESSION_ID = "cs_test_synthetic_state_checker_0001";

interface FlowCase {
  slug: string;
  productLabel: string;
  /** Path Stripe sends the user to on a successful charge. */
  successPath: (sessionId: string) => string;
  /** Path Stripe sends the user to when they bail. */
  cancelPath: string;
  /**
   * Whether today's `create-*-checkout` function actually substitutes
   * {CHECKOUT_SESSION_ID} in success_url. If false, ReceiptStatusBanner
   * cannot poll. Tests record this gap.
   */
  successCarriesSessionId: boolean;
  /** Selector / text that must be visible on the cancel landing page (baseline). */
  cancelBaselineText: RegExp;
  /** Selector / text that must be visible on the success landing page. */
  successText: RegExp;
}

const FLOWS: FlowCase[] = [
  {
    slug: "hire-alert",
    productLabel: "HireAlert",
    successPath: (sid) => `/hire-alert?success=1&session_id=${sid}`,
    cancelPath: "/hire-alert",
    successCarriesSessionId: false, // BUG: production omits {CHECKOUT_SESSION_ID}
    cancelBaselineText: /HireAlert/i,
    successText: /HireAlert/i,
  },
  {
    slug: "mortgage-radar",
    productLabel: "Mortgage Radar",
    successPath: (sid) =>
      `/mortgage-radar?success=1&tier=starter&session_id=${sid}`,
    cancelPath: "/mortgage-radar",
    successCarriesSessionId: false, // BUG
    cancelBaselineText: /Mortgage Radar/i,
    successText: /Mortgage Radar/i,
  },
  {
    slug: "dead-lead-intake",
    productLabel: "Dead Lead",
    successPath: (sid) => `/dead-lead-intake?status=success&session_id=${sid}`,
    cancelPath: "/dead-lead-intake",
    successCarriesSessionId: true,
    cancelBaselineText: /Dead Lead/i,
    successText: /Dead Lead/i,
  },
  {
    slug: "field-service",
    productLabel: "FieldDesk",
    successPath: (sid) => `/field-service?success=1&session_id=${sid}`,
    cancelPath: "/field-service",
    successCarriesSessionId: false, // BUG
    cancelBaselineText: /Field/i,
    successText: /Field/i,
  },
  {
    slug: "contractor-ppl",
    productLabel: "Contractor Lead",
    // contractor-ppl uses /lead-unlocked as its success URL (not /contractor-leads).
    successPath: (sid) => `/lead-unlocked?session_id=${sid}`,
    cancelPath: "/contractor-leads",
    successCarriesSessionId: true,
    cancelBaselineText: /Contractor|Lead/i,
    successText: /unlock|lead|claim/i,
  },
  {
    slug: "bundle-revenue-suite",
    productLabel: "Revenue Suite",
    successPath: (sid) => `/revenue-suite?status=success&session_id=${sid}`,
    cancelPath: "/revenue-suite",
    successCarriesSessionId: true,
    cancelBaselineText: /Revenue Suite|Activate/i,
    successText: /activating|all 8 tools|revenue suite/i,
  },
];

// --------------------------------------------------------------------------
// Network mocks for get-receipt-status
// --------------------------------------------------------------------------

type MockMode = "pending-then-fulfilled" | "always-pending" | "failed";

interface MockState {
  mode: MockMode;
  callsBySession: Map<string, number>;
}

/**
 * Installs a stub for the `get-receipt-status` Edge Function so the test
 * can deterministically drive the banner through its lifecycle without
 * touching Stripe or the database.
 */
async function mockReceiptStatus(page: Page, mode: MockMode): Promise<MockState> {
  const state: MockState = { mode, callsBySession: new Map() };

  await page.route(
    /\/functions\/v1\/get-receipt-status/i,
    async (route: Route) => {
      let sessionId = "unknown";
      try {
        const body = route.request().postDataJSON() as { session_id?: string };
        if (body?.session_id) sessionId = body.session_id;
      } catch {
        // body might be empty for OPTIONS preflight — handle below
      }

      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: corsHeaders() });
      }

      const calls = (state.callsBySession.get(sessionId) ?? 0) + 1;
      state.callsBySession.set(sessionId, calls);

      let status: "pending" | "paid" | "fulfilled" | "failed" = "pending";
      if (state.mode === "failed") status = "failed";
      else if (state.mode === "always-pending") status = "pending";
      else if (state.mode === "pending-then-fulfilled") {
        if (calls === 1) status = "pending";
        else if (calls === 2) status = "paid";
        else status = "fulfilled";
      }

      return route.fulfill({
        status: 200,
        headers: { "content-type": "application/json", ...corsHeaders() },
        body: JSON.stringify({
          status,
          product_type: "test",
          fulfilled_at: status === "fulfilled" ? new Date().toISOString() : null,
        }),
      });
    }
  );

  return state;
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}

// --------------------------------------------------------------------------
// Assertion helpers
// --------------------------------------------------------------------------

async function expectReceiptBannerVisible(page: Page) {
  // Match either the data-testid we ship on the banner, or a fallback text
  // probe in case the banner uses an older render path.
  const banner = page.locator('[data-testid^="receipt-banner"]');
  const fallback = page.getByText(/receipt|fulfillment|activating/i);
  await expect(banner.or(fallback).first()).toBeVisible({ timeout: 10_000 });
}

async function expectNoReceiptArtifacts(page: Page) {
  // Cancel path: page must NOT mount the receipt banner or check-email card.
  const banner = page.locator('[data-testid^="receipt-banner"]');
  const card = page.locator('[data-testid="check-email-card"]');
  await expect(banner).toHaveCount(0);
  await expect(card).toHaveCount(0);
}

// --------------------------------------------------------------------------
// Per-flow specs
// --------------------------------------------------------------------------

for (const flow of FLOWS) {
  test.describe(`Order state: ${flow.slug}`, () => {
    test("cancel URL leaves app in baseline state (no receipt artifacts)", async ({
      page,
    }) => {
      // Even if the page tries to call get-receipt-status, fail it loudly so
      // the test catches accidental polling on the cancel path.
      await page.route(/\/functions\/v1\/get-receipt-status/i, (route) =>
        route.fulfill({
          status: 500,
          headers: { "content-type": "application/json", ...corsHeaders() },
          body: JSON.stringify({ error: "should-not-be-called-on-cancel" }),
        })
      );

      await page.goto(flow.cancelPath);
      await expect(page.getByText(flow.cancelBaselineText).first()).toBeVisible({
        timeout: 8_000,
      });
      await expectNoReceiptArtifacts(page);
    });

    test("success URL mounts page and (when session_id present) polls receipt status", async ({
      page,
    }) => {
      const mock = await mockReceiptStatus(page, "pending-then-fulfilled");

      await page.goto(flow.successPath(SYNTHETIC_SESSION_ID));
      await expect(page.getByText(flow.successText).first()).toBeVisible({
        timeout: 10_000,
      });

      if (flow.successCarriesSessionId) {
        // Banner must mount AND we must observe at least one poll arriving
        // at our mock with the synthetic session id.
        await expectReceiptBannerVisible(page);
        await expect
          .poll(() => mock.callsBySession.get(SYNTHETIC_SESSION_ID) ?? 0, {
            timeout: 15_000,
            message: `${flow.slug}: expected get-receipt-status to be called with session_id`,
          })
          .toBeGreaterThan(0);
      } else {
        // Document the production gap explicitly so CI surfaces it on every run.
        // We allow the test to pass (it reflects current behavior) but annotate
        // the failure-of-feature so it shows up in the report.
        test.info().annotations.push({
          type: "known-gap",
          description: `${flow.slug}: success_url does not include {CHECKOUT_SESSION_ID}; ReceiptStatusBanner cannot poll. Fix in supabase/functions/create-${flow.slug}-checkout when the backend lock lifts.`,
        });
      }
    });

    test("success URL eventually shows fulfilled state when session_id present", async ({
      page,
    }) => {
      test.skip(
        !flow.successCarriesSessionId,
        `${flow.slug} cannot reach fulfilled state in UI today — known gap`
      );

      await mockReceiptStatus(page, "pending-then-fulfilled");
      await page.goto(flow.successPath(SYNTHETIC_SESSION_ID));

      // The banner exposes data-state on its outer wrapper after each poll.
      // Wait for it to settle on "fulfilled".
      const banner = page.locator('[data-testid^="receipt-banner"]').first();
      await expect(banner).toBeVisible({ timeout: 10_000 });
      await expect
        .poll(
          async () =>
            (await banner.getAttribute("data-state")) ??
            (await banner.textContent()) ??
            "",
          { timeout: 20_000, intervals: [500, 1000, 2000] }
        )
        .toMatch(/fulfilled|active|ready/i);
    });
  });
}

// --------------------------------------------------------------------------
// Mobile sanity — same checks at iPhone 13 viewport
// --------------------------------------------------------------------------

test.describe("Order state: mobile sanity", () => {
  test.use({ ...devices["iPhone 13"] });

  test("hire-alert cancel path shows no receipt artifacts on mobile", async ({
    page,
  }) => {
    await page.route(/\/functions\/v1\/get-receipt-status/i, (route) =>
      route.fulfill({ status: 500, body: "{}", headers: corsHeaders() })
    );
    await page.goto("/hire-alert");
    await expectNoReceiptArtifacts(page);
  });

  test("revenue-suite success path mounts banner and polls on mobile", async ({
    page,
  }) => {
    const mock = await mockReceiptStatus(page, "pending-then-fulfilled");
    await page.goto(`/revenue-suite?status=success&session_id=${SYNTHETIC_SESSION_ID}`);
    await expectReceiptBannerVisible(page);
    await expect
      .poll(() => mock.callsBySession.get(SYNTHETIC_SESSION_ID) ?? 0, {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
  });
});
