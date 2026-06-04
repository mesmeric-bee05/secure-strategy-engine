import type { Page } from "@playwright/test";

export type LangCode = "en" | "sw" | "fr" | "ha";

export async function switchLanguage(page: Page, code: LangCode) {
  const select = page.getByLabel(/Language/i).first();
  await select.selectOption(code);
  await page.waitForFunction(
    (c) => document.documentElement.lang === c,
    code,
    { timeout: 5_000 },
  );
}

export async function getHtmlLang(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.lang);
}
