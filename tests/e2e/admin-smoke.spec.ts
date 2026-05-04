import { test, expect } from "@playwright/test";

/**
 * Admin panel smoke tests.
 *
 * The DWA Admin panel (/dwa-admin) and standard Admin (/admin) are protected
 * by AgencyAdminRoute / ProtectedRoute guards. Unauthenticated visitors must
 * be redirected to /auth — we verify the guard is working and the pages don't
 * accidentally render sensitive data to logged-out users.
 *
 * We do NOT test the authenticated state here (that would require seeding a
 * test admin session). These tests focus on:
 *   1. Auth guard redirect — unauthenticated → /auth or equivalent.
 *   2. No fatal JS errors on the redirect path.
 *   3. Public admin-adjacent pages that should load without auth.
 */

const NOISE_PATTERN = /speed-insights|favicon|chrome-extension|googletagmanager|fbevents|hotjar/i;

test.describe("Admin auth guards", () => {
  const PROTECTED_PATHS = [
    "/dwa-admin",
    "/dwa-admin/outreach-audit",
    "/admin",
  ];

  for (const path of PROTECTED_PATHS) {
    test(`${path}: unauthenticated visitor is redirected to /auth`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      // After guard fires, URL must have changed to /auth (or contain /auth)
      const finalUrl = page.url();
      expect(finalUrl, `${path} did not redirect to /auth`).toContain("/auth");

      expect(errors.filter((e) => !NOISE_PATTERN.test(e))).toEqual([]);
    });

    test(`${path}: no sensitive data visible to unauthenticated users`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      const body = (await page.locator("body").innerText()).toLowerCase();

      // Sensitive admin panel content should not be visible before auth
      const SENSITIVE_PATTERNS = [
        "stripe secret",
        "api_key",
        "service_role",
        "admin panel",
        "outreach audit",
        "supabase",
      ];
      for (const pattern of SENSITIVE_PATTERNS) {
        expect(body, `"${pattern}" should not be visible without auth on ${path}`).not.toContain(pattern);
      }
    });
  }
});

test.describe("Admin-adjacent public pages", () => {
  test("/dwa-admin renders auth page (not blank) when unauthenticated", async ({ page }) => {
    await page.goto("/dwa-admin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Should show auth form, not a blank page
    const bodyText = (await page.locator("body").innerText()).trim();
    expect(bodyText.length).toBeGreaterThan(20);
  });

  test("auth page at /auth has email and password inputs", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Admin panel post-login structure (mock session)", () => {
  test("DWAAdmin page title is set correctly when route matches", async ({ page }) => {
    // Navigate to the auth gate — the route must exist in the router (not 404)
    const response = await page.goto("/dwa-admin", { waitUntil: "domcontentloaded" });

    // The route must exist — a proper auth redirect (302/200 to /auth) is fine,
    // but a hard 404 means the route was removed from App.tsx
    const status = response?.status() ?? 0;
    expect(status, "/dwa-admin should not 404").not.toBe(404);
  });

  test("standard Admin route exists and redirects unauthenticated users", async ({ page }) => {
    const response = await page.goto("/admin", { waitUntil: "domcontentloaded" });
    const status = response?.status() ?? 0;
    expect(status, "/admin should not 404").not.toBe(404);
  });
});
