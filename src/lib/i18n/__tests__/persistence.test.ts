/**
 * i18n persistence contract.
 *
 * We can't fully simulate a page reload inside vitest (i18next is a
 * process-singleton and re-importing it does not re-run the detector
 * chain on a fresh DOM). So we lock down the contract the LanguageDetector
 * relies on: choices are written to BOTH localStorage and cookie, and the
 * configured detection order prioritises persisted choice over navigator.
 * Real-browser reload + Accept-Language fallback are covered by the
 * Playwright spec in tests/e2e/language-persistence.spec.ts.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";

function clearStorage() {
  window.localStorage.clear();
  for (const c of document.cookie.split(";")) {
    const eq = c.indexOf("=");
    const name = (eq > -1 ? c.slice(0, eq) : c).trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

beforeEach(async () => {
  clearStorage();
  await i18n.changeLanguage("en");
});
afterEach(() => clearStorage());

describe("i18n persistence", () => {
  it("changeLanguage writes the choice to localStorage", async () => {
    await i18n.changeLanguage("fr");
    expect(window.localStorage.getItem("lng")).toBe("fr");
  });

  it("changeLanguage writes a cookie so a brand new tab can read it", async () => {
    await i18n.changeLanguage("sw");
    expect(document.cookie).toContain("lng=sw");
  });

  it("supports every shipped locale (no init crash)", async () => {
    for (const code of ["en", "sw", "fr", "ha"] as const) {
      await i18n.changeLanguage(code);
      expect(i18n.resolvedLanguage).toBe(code);
    }
  });

  it("unknown stored code falls back to English (no crash)", async () => {
    await i18n.changeLanguage("zz-unknown");
    expect(i18n.resolvedLanguage).toBe("en");
  });

  it("detection order prioritises persisted choice over navigator", () => {
    const opts: any = (i18n as any).options?.detection ?? {};
    const order: string[] = opts.order ?? [];
    expect(order.indexOf("localStorage")).toBeLessThan(order.indexOf("navigator"));
    expect(order.indexOf("cookie")).toBeLessThan(order.indexOf("navigator"));
    expect(opts.caches).toEqual(expect.arrayContaining(["cookie", "localStorage"]));
  });
});
