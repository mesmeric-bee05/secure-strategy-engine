/**
 * i18n persistence: language choice survives reload (re-init) and detector
 * order falls back through navigator when storage is empty.
 *
 * i18next is a process-singleton, so "reload" is simulated by re-running
 * the LanguageDetector against fresh storage state and asserting the
 * detected code, rather than re-importing the singleton.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import LanguageDetector from "i18next-browser-languagedetector";
import i18n, { SUPPORTED_LANGUAGES } from "@/lib/i18n";

function clearStorage() {
  window.localStorage.clear();
  for (const c of document.cookie.split(";")) {
    const eq = c.indexOf("=");
    const name = (eq > -1 ? c.slice(0, eq) : c).trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

function freshDetector() {
  const services: any = {
    languageUtils: {
      formatLanguageCode: (c: string) => c,
      isSupportedCode: (c: string) =>
        SUPPORTED_LANGUAGES.map((l) => l.code).includes(c as any),
      getLanguagePartFromCode: (c: string) => c.split("-")[0],
    },
  };
  const detector = new (LanguageDetector as any)();
  detector.init(services, {
    order: ["querystring", "cookie", "localStorage", "navigator"],
    lookupQuerystring: "lng",
    lookupCookie: "lng",
    lookupLocalStorage: "lng",
    caches: ["cookie", "localStorage"],
  });
  return detector;
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

  it("detector restores the language from localStorage on a fresh init", () => {
    window.localStorage.setItem("lng", "ha");
    const detected = freshDetector().detect();
    const code = Array.isArray(detected) ? detected[0] : detected;
    expect(code).toBe("ha");
  });

  it("detector falls back through navigator.language when no storage is set", () => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      get: () => "sw-KE",
    });
    const detected = freshDetector().detect();
    const codes = Array.isArray(detected) ? detected : [detected];
    expect(codes.some((c) => String(c).startsWith("sw"))).toBe(true);
  });

  it("unknown stored code does not crash i18n (falls back to en)", async () => {
    await i18n.changeLanguage("zz-unknown");
    // resolvedLanguage is the chain's first supported match
    expect(i18n.resolvedLanguage).toBe("en");
  });
});
