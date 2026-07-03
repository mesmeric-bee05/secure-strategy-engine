import { test, expect, type Page } from "@playwright/test";
import en from "../../src/lib/i18n/locales/en.json";
import sw from "../../src/lib/i18n/locales/sw.json";
import fr from "../../src/lib/i18n/locales/fr.json";
import ha from "../../src/lib/i18n/locales/ha.json";
import { switchLanguage, getHtmlLang, type LangCode } from "./_helpers/i18n";

/**
 * Fresh-locale coverage: switching the language must fully replace any
 * previously-rendered map / AI-explanation strings. Catches memoised or
 * component-cached translations that would otherwise leak stale text.
 */

const BUNDLES: Record<LangCode, Record<string, unknown>> = { en, sw, fr, ha };
const LOCALES: LangCode[] = ["en", "sw", "fr", "ha"];

/** Anchor keys that render visibly on the map + AI-explanation surfaces. */
const MAP_KEYS = ["map.legend", "map.filters", "map.distance"];
const AI_KEYS = ["ai.explanation_title", "ai.why_match", "ai.citations"];

function readKey(locale: LangCode, dotted: string): string | undefined {
  return dotted.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object" && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, BUNDLES[locale]) as string | undefined;
}

/** Strings in `active` that do NOT appear in ANY other locale (safe assertions). */
function uniqueStringsForActive(active: LangCode, keys: string[]): string[] {
  const activeStrings = keys
    .map((k) => readKey(active, k))
    .filter((v): v is string => typeof v === "string" && v.length >= 4);
  const others = LOCALES.filter((l) => l !== active).flatMap((l) =>
    keys.map((k) => readKey(l, k)).filter((v): v is string => typeof v === "string"),
  );
  return activeStrings.filter((s) => !others.includes(s));
}

function otherLocaleUniqueStrings(active: LangCode, keys: string[]): string[] {
  const activeStrings = new Set(
    keys.map((k) => readKey(active, k)).filter((v): v is string => typeof v === "string"),
  );
  const out: string[] = [];
  for (const other of LOCALES) {
    if (other === active) continue;
    for (const k of keys) {
      const s = readKey(other, k);
      if (typeof s === "string" && s.length >= 4 && !activeStrings.has(s)) {
        out.push(s);
      }
    }
  }
  return out;
}

async function assertBodyMatchesLocale(page: Page, active: LangCode, keys: string[]) {
  const body = await page.locator("body").innerText();
  // 1. Every unique-to-active string must appear at least once.
  for (const s of uniqueStringsForActive(active, keys)) {
    expect(body, `expected "${s}" (unique to ${active}) to appear in DOM`).toContain(s);
  }
  // 2. No unique-to-other string may leak.
  for (const stale of otherLocaleUniqueStrings(active, keys)) {
    expect(body, `stale string leaked from another locale: "${stale}"`).not.toContain(stale);
  }
}

test.describe("i18n freshness — no cached translations", () => {
  test("map labels fully reflect the active locale across a round-trip", async ({ page }) => {
    await page.goto("/opportunities/map");
    // Round-trip: en → sw → fr → ha → en → fr (each step re-asserts).
    const sequence: LangCode[] = ["en", "sw", "fr", "ha", "en", "fr"];
    for (const lang of sequence) {
      await switchLanguage(page, lang);
      expect(await getHtmlLang(page)).toBe(lang);
      await assertBodyMatchesLocale(page, lang, MAP_KEYS);
    }
  });

  test("AI explanation surface fully reflects the active locale across a round-trip", async ({
    page,
  }) => {
    // The readiness route hosts the MatchExplanation + CitationsPanel widgets.
    await page.goto("/readiness");
    const sequence: LangCode[] = ["en", "ha", "fr", "sw", "en"];
    for (const lang of sequence) {
      await switchLanguage(page, lang);
      expect(await getHtmlLang(page)).toBe(lang);
      await assertBodyMatchesLocale(page, lang, AI_KEYS);
    }
  });
});
