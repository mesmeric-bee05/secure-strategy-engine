import { test, expect } from "@playwright/test";
import { switchLanguage, type LangCode } from "./_helpers/i18n";

/**
 * Visual regression across locales × pages × viewports.
 *
 * Baselines live in tests/e2e/__screenshots__/. To (re)generate:
 *   bunx playwright test tests/e2e/visual.spec.ts --update-snapshots
 *
 * Volatile regions should be tagged `data-volatile` in the UI to be masked.
 */
const LOCALES: LangCode[] = ["en", "sw", "fr", "ha"];
const PAGES = [
  "/",
  "/opportunities",
  "/opportunities/map",
  "/skills",
  "/trust-graph",
  "/settings",
  "/security",
  "/readiness",
];
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
];

const FREEZE_CSS = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`;

for (const locale of LOCALES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`visual ${locale} ${viewport.name}`, () => {
      test.use({ viewport });

      for (const path of PAGES) {
        test(`${path} (${locale} ${viewport.name})`, async ({ page }) => {
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.addInitScript(`(() => {
            const style = document.createElement('style');
            style.textContent = ${JSON.stringify(FREEZE_CSS)};
            document.head.appendChild(style);
          })();`);
          await page.goto(path, { waitUntil: "networkidle" });
          // Best-effort locale switch (no-op on auth-gated pages)
          await switchLanguage(page, locale).catch(() => {});
          await page.evaluate(() => document.fonts?.ready);
          await expect(page).toHaveScreenshot(
            `${path.replace(/\W+/g, "_") || "root"}-${locale}-${viewport.name}.png`,
            {
              fullPage: true,
              maxDiffPixelRatio: 0.02,
              mask: [page.locator("[data-volatile]")],
              animations: "disabled",
            },
          );
        });
      }
    });
  }
}
