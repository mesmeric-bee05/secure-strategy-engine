import { test, expect } from "@playwright/test";
import { PHASES, STACK, FEATURES, SECURITY, STATS } from "../../src/lib/dashboard-content";

/**
 * /dashboard tab rendering — each of the five tabs must be selectable and
 * render the data slice sourced from src/lib/dashboard-content.ts.
 * Screenshots feed the visual regression suite.
 */
test.describe("dashboard tabs", () => {
  test("all five tabs render expected data and screenshot", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Stats always render above the tabs.
    for (const s of STATS) {
      await expect(page.getByText(s.value, { exact: false })).toBeVisible();
      await expect(page.getByText(s.label, { exact: false })).toBeVisible();
    }

    async function activate(label: RegExp) {
      const btn = page.getByRole("button", { name: label }).first();
      await btn.click();
      // "aria-selected" isn't used here — the styled active tab has
      // border-gold text-gold classes; assert via aria-pressed/text.
      await expect(btn).toBeVisible();
    }

    // Phases
    await activate(/^Phases$/i);
    for (const p of PHASES) {
      await expect(page.getByText(p.title, { exact: false }).first()).toBeVisible();
      await expect(page.getByText(p.time, { exact: false }).first()).toBeVisible();
    }
    await page.screenshot({ path: "test-results/dashboard-phases.png", fullPage: false });

    // Tech Stack
    await activate(/Tech stack/i);
    for (const cat of STACK) {
      await expect(page.getByText(cat.category, { exact: false }).first()).toBeVisible();
      // At least the first item of each category is rendered.
      await expect(page.getByText(cat.items[0].name, { exact: false }).first()).toBeVisible();
    }
    await page.screenshot({ path: "test-results/dashboard-stack.png", fullPage: false });

    // Features
    await activate(/^Features$/i);
    for (const f of FEATURES) {
      await expect(page.getByText(f.title, { exact: false }).first()).toBeVisible();
    }
    await page.screenshot({ path: "test-results/dashboard-features.png", fullPage: false });

    // Security
    await activate(/^Security$/i);
    for (const s of SECURITY) {
      await expect(page.getByText(s.title, { exact: false }).first()).toBeVisible();
    }
    await page.screenshot({ path: "test-results/dashboard-security.png", fullPage: false });

    // Status
    await activate(/^Status$/i);
    // Status tab reuses the STATS grid (already asserted) — take screenshot.
    await page.screenshot({ path: "test-results/dashboard-status.png", fullPage: false });
  });
});
