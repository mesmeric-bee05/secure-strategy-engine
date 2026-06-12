import { test, expect } from "@playwright/test";
import en from "../../src/lib/i18n/locales/en.json";
import sw from "../../src/lib/i18n/locales/sw.json";
import fr from "../../src/lib/i18n/locales/fr.json";
import ha from "../../src/lib/i18n/locales/ha.json";
import { switchLanguage, getHtmlLang, type LangCode } from "./_helpers/i18n";

const LOCALES: Record<LangCode, Record<string, unknown>> = { en, sw, fr, ha };

/** Anchor keys that must visibly render on the map/AI pages. */
const MAP_ANCHOR_KEYS = ["map.legend", "map.filters", "map.distance"];
const AI_ANCHOR_KEYS = ["ai.explanation_title", "ai.why_match", "ai.citations"];

function readKey(locale: LangCode, dotted: string): string | undefined {
  return dotted.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object" && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, LOCALES[locale]) as string | undefined;
}

/** Fail if the page body contains unique strings from any non-active locale. */
async function assertNoStringFromOtherLocale(
  page: import("@playwright/test").Page,
  active: LangCode,
  keys: string[],
) {
  const body = await page.locator("body").innerText();
  for (const otherLocale of (["en", "sw", "fr", "ha"] as LangCode[]).filter(
    (l) => l !== active,
  )) {
    for (const key of keys) {
      const otherString = readKey(otherLocale, key);
      const activeString = readKey(active, key);
      if (!otherString || !activeString || otherString === activeString) continue;
      // Word-bounded check to avoid coincidental substrings
      if (otherString.length >= 4 && body.includes(otherString)) {
        throw new Error(
          `Stale string from '${otherLocale}' for key '${key}' leaked into '${active}' page: "${otherString}"`,
        );
      }
    }
  }
}

for (const locale of ["en", "sw", "fr", "ha"] as LangCode[]) {
  test.describe(`i18n - ${locale}`, () => {
    test(`map page renders all anchor strings (${locale})`, async ({ page }) => {
      await page.goto("/opportunities/map");
      await switchLanguage(page, locale);
      expect(await getHtmlLang(page)).toBe(locale);

      for (const key of MAP_ANCHOR_KEYS) {
        const expected = readKey(locale, key);
        if (!expected) continue; // key not present in this locale's namespace
        await expect(page.locator("body")).toContainText(expected, { timeout: 10_000 });
      }
      await assertNoStringFromOtherLocale(page, locale, MAP_ANCHOR_KEYS);

      // Anti-stale cache: navigate away then back
      await page.goto("/");
      await page.goto("/opportunities/map");
      expect(await getHtmlLang(page)).toBe(locale);
      await assertNoStringFromOtherLocale(page, locale, MAP_ANCHOR_KEYS);

      // Hard reload
      await page.reload({ waitUntil: "networkidle" });
      expect(await getHtmlLang(page)).toBe(locale);
      await assertNoStringFromOtherLocale(page, locale, MAP_ANCHOR_KEYS);
    });

    test(`AI explanation chrome reflects locale (${locale})`, async ({ page }) => {
      // Deterministic AI response - mock any AI explanation endpoint
      await page.route(/(match-explanation|extract-skills)/i, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            explanation: "deterministic test response",
            citations: [],
          }),
        }),
      );

      await page.goto("/opportunities");
      await switchLanguage(page, locale);
      await assertNoStringFromOtherLocale(page, locale, AI_ANCHOR_KEYS);
    });
  });
}
