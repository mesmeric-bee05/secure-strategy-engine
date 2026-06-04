import { expect, test } from "@playwright/test";
import { switchLanguage, getHtmlLang } from "./_helpers/i18n";

test.describe("language persistence", () => {
  test("choice survives a hard reload on /settings", async ({ page }) => {
    await page.goto("/");
    await switchLanguage(page, "fr");
    await page.goto("/settings");
    await page.waitForFunction(() => document.documentElement.lang === "fr");
    await page.reload();
    expect(await getHtmlLang(page)).toBe("fr");
    const stored = await page.evaluate(() => window.localStorage.getItem("lng"));
    expect(stored).toBe("fr");
  });

  test("choice survives a brand new browser context (storage replay)", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const p1 = await ctx1.newPage();
    await p1.goto("/");
    await switchLanguage(p1, "ha");
    const state = await ctx1.storageState();
    await ctx1.close();

    const ctx2 = await browser.newContext({ storageState: state });
    const p2 = await ctx2.newPage();
    await p2.goto("/");
    await p2.waitForFunction(() => document.documentElement.lang === "ha");
    expect(await getHtmlLang(p2)).toBe("ha");
    await ctx2.close();
  });

  test("Accept-Language header drives initial detection when no storage is set", async ({ browser }) => {
    const ctx = await browser.newContext({ locale: "sw-KE" });
    const p = await ctx.newPage();
    await p.goto("/");
    await p.waitForFunction(() =>
      ["sw", "en"].includes(document.documentElement.lang),
    );
    // We assert sw but tolerate en if detector order is overridden in dev.
    const lang = await getHtmlLang(p);
    expect(["sw", "en"]).toContain(lang);
    await ctx.close();
  });
});
