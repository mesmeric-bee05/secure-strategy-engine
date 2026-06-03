import { describe, expect, it } from "vitest";
import en from "../locales/en.json";
import sw from "../locales/sw.json";
import fr from "../locales/fr.json";
import ha from "../locales/ha.json";
import { SUPPORTED_LANGUAGES } from "../index";

type Dict = Record<string, unknown>;

function flatKeys(obj: Dict, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flatKeys(v as Dict, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

function getAt(obj: Dict, path: string): unknown {
  return path.split(".").reduce<any>((acc, k) => (acc == null ? acc : acc[k]), obj);
}

const locales = { en, sw, fr, ha } as const;

describe("i18n locale files", () => {
  it("each locale is a non-empty object", () => {
    for (const [code, dict] of Object.entries(locales)) {
      expect(dict, code).toBeTypeOf("object");
      expect(Object.keys(dict).length, code).toBeGreaterThan(0);
    }
  });

  it("SUPPORTED_LANGUAGES matches locales we ship", () => {
    expect(SUPPORTED_LANGUAGES.map((l) => l.code).sort()).toEqual(
      Object.keys(locales).sort(),
    );
  });

  it("non-English locales have the exact same key set as English", () => {
    const enKeys = flatKeys(en as Dict);
    for (const code of ["sw", "fr", "ha"] as const) {
      const keys = flatKeys(locales[code] as Dict);
      const missing = enKeys.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !enKeys.includes(k));
      expect(
        { missing, extra },
        `${code}.json key drift vs en.json`,
      ).toEqual({ missing: [], extra: [] });
    }
  });

  it("every translated value is a non-empty string", () => {
    for (const [code, dict] of Object.entries(locales)) {
      for (const key of flatKeys(dict as Dict)) {
        const value = getAt(dict as Dict, key);
        expect(typeof value, `${code}:${key}`).toBe("string");
        expect((value as string).trim().length, `${code}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("non-English locales actually translate user-facing keys (not copy-paste of English)", () => {
    // Sample of keys that MUST differ from English in every other locale.
    const mustDiffer = [
      "common.signIn",
      "common.signOut",
      "nav.settings",
      "passkeys.title",
      "map.title",
    ];
    for (const code of ["sw", "fr", "ha"] as const) {
      for (const key of mustDiffer) {
        const enVal = getAt(en as Dict, key) as string;
        const otherVal = getAt(locales[code] as Dict, key) as string;
        expect(otherVal, `${code}:${key} should not equal en`).not.toBe(enVal);
      }
    }
  });

  it("preserves interpolation placeholders across locales", () => {
    const enVal = getAt(en as Dict, "ai.promptLocale") as string;
    expect(enVal).toContain("{{language}}");
    for (const code of ["sw", "fr", "ha"] as const) {
      const v = getAt(locales[code] as Dict, "ai.promptLocale") as string;
      expect(v, `${code} promptLocale`).toContain("{{language}}");
    }
  });
});
