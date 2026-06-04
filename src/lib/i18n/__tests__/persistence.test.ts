/**
 * i18n persistence: language choice survives reload (re-import) and falls
 * back through navigator when storage is empty.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function clearStorage() {
  window.localStorage.clear();
  // Clear all cookies for jsdom
  for (const c of document.cookie.split(";")) {
    const eq = c.indexOf("=");
    const name = (eq > -1 ? c.slice(0, eq) : c).trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

beforeEach(() => {
  clearStorage();
  vi.resetModules();
});

afterEach(() => {
  clearStorage();
});

describe("i18n persistence", () => {
  it("changeLanguage writes the choice to localStorage", async () => {
    const { default: i18n } = await import("@/lib/i18n");
    await i18n.changeLanguage("fr");
    expect(window.localStorage.getItem("lng")).toBe("fr");
  });

  it("a fresh import (simulated reload) restores the language from localStorage", async () => {
    window.localStorage.setItem("lng", "ha");
    const { default: i18n } = await import("@/lib/i18n");
    // detector runs during init; resolvedLanguage should pick up the stored choice
    await new Promise((r) => setTimeout(r, 0));
    expect(i18n.resolvedLanguage).toBe("ha");
  });

  it("falls back through navigator.language when no storage is set", async () => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      get: () => "sw-KE",
    });
    const { default: i18n } = await import("@/lib/i18n");
    await new Promise((r) => setTimeout(r, 0));
    expect(i18n.resolvedLanguage).toBe("sw");
  });

  it("falls back to English for an unknown stored code", async () => {
    window.localStorage.setItem("lng", "zz-unknown");
    const { default: i18n } = await import("@/lib/i18n");
    await new Promise((r) => setTimeout(r, 0));
    expect(i18n.resolvedLanguage).toBe("en");
  });
});
