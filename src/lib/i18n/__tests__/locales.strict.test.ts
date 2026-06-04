/**
 * Build-gating contract test: any new English key MUST exist in every other
 * locale, no value may be empty, and {{interpolation}} placeholders must
 * survive translation. Failure here fails `bun run test` and therefore the
 * build / CI.
 */
import { describe, expect, it } from "vitest";
import en from "../locales/en.json";
import sw from "../locales/sw.json";
import fr from "../locales/fr.json";
import ha from "../locales/ha.json";
import { SUPPORTED_LANGUAGES } from "../index";

type Dict = Record<string, unknown>;

function flatten(obj: Dict, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Dict, path));
    } else {
      out[path] = String(v);
    }
  }
  return out;
}

function placeholders(s: string): string[] {
  return Array.from(s.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g))
    .map((m) => m[1])
    .sort();
}

const enFlat = flatten(en as Dict);
const others = { sw, fr, ha } as const;

// Keys whose translation MUST differ from English in every other locale.
// Curated user-visible surface area; extend when new shared UI ships.
const MUST_TRANSLATE = [
  "common.signIn",
  "common.signOut",
  "common.save",
  "common.cancel",
  "common.delete",
  "common.loading",
  "common.language",
  "nav.overview",
  "nav.skills",
  "nav.opportunities",
  "nav.map",
  "nav.readiness",
  "nav.security",
  "nav.settings",
  "map.title",
  "map.subtitle",
  "map.consentTitle",
  "map.consentAccept",
  "ai.extractTitle",
  "ai.explainTitle",
  "passkeys.title",
  "passkeys.subtitle",
  "passkeys.register",
  "passkeys.recovery",
];

describe("locale contract (build gate)", () => {
  it("SUPPORTED_LANGUAGES exposes exactly the locales we ship", () => {
    expect(SUPPORTED_LANGUAGES.map((l) => l.code).sort()).toEqual(
      ["en", "fr", "ha", "sw"],
    );
  });

  it("every English key exists in sw / fr / ha (no drift)", () => {
    const enKeys = Object.keys(enFlat).sort();
    for (const [code, dict] of Object.entries(others)) {
      const flat = flatten(dict as Dict);
      const missing = enKeys.filter((k) => !(k in flat));
      const extra = Object.keys(flat).filter((k) => !(k in enFlat));
      expect(
        { missing, extra },
        `${code}.json drift vs en.json`,
      ).toEqual({ missing: [], extra: [] });
    }
  });

  it("no empty / whitespace-only translations in any locale", () => {
    for (const [code, dict] of Object.entries({ en, ...others })) {
      const flat = flatten(dict as Dict);
      for (const [key, value] of Object.entries(flat)) {
        expect(typeof value, `${code}:${key}`).toBe("string");
        expect(value.trim().length, `${code}:${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("must-translate keys are actually translated (not English copy-paste)", () => {
    for (const [code, dict] of Object.entries(others)) {
      const flat = flatten(dict as Dict);
      for (const key of MUST_TRANSLATE) {
        expect(flat[key], `${code}:${key} present`).toBeDefined();
        expect(
          flat[key],
          `${code}:${key} should not equal en (likely untranslated)`,
        ).not.toBe(enFlat[key]);
      }
    }
  });

  it("interpolation placeholders survive translation (same names, same count)", () => {
    for (const [key, enVal] of Object.entries(enFlat)) {
      const enPh = placeholders(enVal);
      if (enPh.length === 0) continue;
      for (const [code, dict] of Object.entries(others)) {
        const flat = flatten(dict as Dict);
        const ph = placeholders(flat[key] ?? "");
        expect(ph, `${code}:${key} placeholders`).toEqual(enPh);
      }
    }
  });
});
