import { test, expect } from "@playwright/test";

test.describe("Public pages smoke", () => {
  const PAGES = ["/", "/shop", "/mortgage-radar", "/contractor-marketplace"];

  for (const path of PAGES) {
    test(`${path} loads with no fatal console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const t = msg.text();
          // Skip third-party/extension noise
          if (/speed-insights|favicon|chrome-extension|googletagmanager|fbevents|hotjar/i.test(t)) return;
          errors.push(t);
        }
      });

      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 0, `${path} returned non-2xx`).toBeLessThan(400);

      // Page should render some content (not blank)
      await page.waitForTimeout(1500);
      const bodyText = (await page.locator("body").innerText()).trim();
      expect(bodyText.length, `${path} rendered an empty body`).toBeGreaterThan(20);

      expect(errors, `${path} had fatal errors:\n${errors.join("\n")}`).toEqual([]);
    });
  }
});
