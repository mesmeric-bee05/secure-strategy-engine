import { expect, test } from "@playwright/test";
import { switchLanguage, getHtmlLang } from "./_helpers/i18n";
import en from "../../src/lib/i18n/locales/en.json";
import sw from "../../src/lib/i18n/locales/sw.json";
import fr from "../../src/lib/i18n/locales/fr.json";
import ha from "../../src/lib/i18n/locales/ha.json";

const locales = { en, sw, fr, ha } as const;
const PUBLIC_ROUTES = ["/", "/opportunities", "/opportunities/map"];

test.describe("locale switching across pages", () => {
  for (const code of ["sw", "fr", "ha"] as const) {
    test(`switches every public page to ${code} and survives nav (no stale cache)`, async ({ page }) => {
      await page.goto("/");
      await switchLanguage(page, code);
      expect(await getHtmlLang(page)).toBe(code);

      for (const route of PUBLIC_ROUTES) {
        await page.goto(route);
        // The previous choice must survive navigation (no flash back to English).
        await page.waitForFunction(
          (c) => document.documentElement.lang === c,
          code,
        );
        expect(await getHtmlLang(page)).toBe(code);
      }

      // Reload preserves the choice.
      await page.reload();
      expect(await getHtmlLang(page)).toBe(code);

      // Anchor string from the same JSON the app loads at runtime — proves
      // the translated string actually rendered (not a hardcoded English copy).
      const anchor = (locales[code] as any).nav.opportunities as string;
      expect(anchor).not.toBe(en.nav.opportunities);
      await expect(page.getByText(anchor).first()).toBeVisible();
    });
  }

  test("clearing storage falls back to English", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    // Default fallback is en
    await page.waitForFunction(
      () => ["en", ""].includes(document.documentElement.lang),
    );
    const lang = await getHtmlLang(page);
    expect(["en", ""]).toContain(lang);
  });
});
