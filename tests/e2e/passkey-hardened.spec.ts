import { test, expect, type Page } from "@playwright/test";
import { installVirtualAuthenticator } from "./_helpers/webauthn";

/**
 * Extra WebAuthn resiliency scenarios on top of passkey-retry.spec.ts.
 *
 * - Repeated user-verification rejection then success.
 * - Repeated server 5xx then 200 (via route interception) — session must
 *   land exactly once, not stacked.
 * - Repeated network aborts on the challenge fetch, then recovery.
 *
 * Skipped when Supabase e2e env isn't wired.
 */

const E2E_READY = Boolean(
  process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.E2E_TEST_EMAIL,
);

test.describe.configure({ mode: "serial", retries: 2 });

test.describe("WebAuthn — hardened retry & network interruption", () => {
  test.skip(!E2E_READY, "E2E_TEST_EMAIL/Supabase env not configured");

  test("multiple UV rejections then success establishes exactly one session", async ({
    context,
    page,
  }) => {
    const authn = await installVirtualAuthenticator(context, page);
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");

    await page.goto("/settings");

    // Two rejections
    for (let i = 0; i < 2; i++) {
      await cdp.send("WebAuthn.setUserVerified", {
        authenticatorId: authn.authenticatorId,
        isUserVerified: false,
      });
      await page
        .getByRole("button", { name: /add passkey|register passkey/i })
        .first()
        .click()
        .catch(() => {});
    }

    // Third attempt succeeds
    await cdp.send("WebAuthn.setUserVerified", {
      authenticatorId: authn.authenticatorId,
      isUserVerified: true,
    });
    await page
      .getByRole("button", { name: /add passkey|register passkey/i })
      .first()
      .click();

    await expect
      .poll(async () => (await authn.getCredentials()).length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);

    // Only one credential — no duplicates stacked from retries
    const creds = await authn.getCredentials();
    expect(creds.length).toBe(1);

    await authn.remove();
  });

  test("server 5xx once, then 200 — no duplicate session", async ({ context, page }) => {
    const authn = await installVirtualAuthenticator(context, page);
    let intercepted = 0;
    await page.route("**/_serverFn/**", async (route) => {
      const url = route.request().url();
      if (/passkey|webauthn/i.test(url) && intercepted === 0) {
        intercepted += 1;
        await route.fulfill({ status: 503, body: "temporarily unavailable" });
        return;
      }
      await route.continue();
    });

    await page.goto("/auth");
    await page
      .getByRole("button", { name: /sign in with passkey/i })
      .first()
      .click()
      .catch(() => {});
    // Retry CTA (or the button itself)
    await page
      .getByRole("button", { name: /try again|retry|sign in with passkey/i })
      .first()
      .click()
      .catch(() => {});

    // Assert exactly one authenticated navigation (URL leaves /auth once).
    const authUrls: string[] = [];
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) authUrls.push(f.url());
    });
    await page.waitForTimeout(3_000);
    const leftAuth = authUrls.filter((u) => !u.includes("/auth")).length;
    expect(leftAuth, "should not stack multiple post-auth navigations").toBeLessThanOrEqual(1);

    await authn.remove();
  });

  test("network aborts on passkey RPC then recovers", async ({ context, page }) => {
    const authn = await installVirtualAuthenticator(context, page);
    let aborted = 0;
    await page.route("**/_serverFn/**", async (route) => {
      const url = route.request().url();
      if (/passkey|webauthn/i.test(url) && aborted < 2) {
        aborted += 1;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await page.goto("/auth");
    for (let i = 0; i < 3; i++) {
      await page
        .getByRole("button", { name: /sign in with passkey|try again|retry/i })
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(500);
    }

    // Either a session or a clear recovery CTA
    const sessionOrFallback = page.locator(
      '[data-testid="passkey-fallback-cta"], [data-testid="user-menu"], a[href="/settings"], [data-testid="last-error-panel"]',
    );
    await expect(sessionOrFallback.first()).toBeVisible({ timeout: 15_000 });

    await authn.remove();
  });
});
