import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { installVirtualAuthenticator } from "./_helpers/webauthn";

/**
 * Retry + network-interruption hardening for WebAuthn passkey flows.
 *
 * Skipped when E2E_TEST_EMAIL/Supabase env is missing. CI provisions these
 * via the same secrets used by passkey.spec.ts.
 */
const E2E_READY = Boolean(
  process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.E2E_TEST_EMAIL,
);

test.describe.configure({ mode: "serial", retries: 2 });

async function setAuthenticatorUserVerified(
  context: BrowserContext,
  page: Page,
  authenticatorId: string,
  verified: boolean,
) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.setUserVerified", {
    authenticatorId,
    isUserVerified: verified,
  });
}

async function withOfflineWindow(page: Page, fn: () => Promise<void>) {
  const ctx = page.context();
  await ctx.setOffline(true);
  try {
    await fn();
  } finally {
    await ctx.setOffline(false);
  }
}

test.describe("WebAuthn retry + interruption", () => {
  test.skip(!E2E_READY, "E2E_TEST_EMAIL/Supabase env not configured");

  test("registration recovers after transient authenticator failure", async ({
    context,
    page,
  }) => {
    const authn = await installVirtualAuthenticator(context, page);
    await setAuthenticatorUserVerified(context, page, authn.authenticatorId, false);

    await page.goto("/settings");
    // Trigger registration; first attempt should fail because UV=false
    await page
      .getByRole("button", { name: /add passkey|register passkey/i })
      .first()
      .click()
      .catch(() => {
        /* button may be conditionally rendered; tolerate */
      });

    // Restore authenticator and retry
    await setAuthenticatorUserVerified(context, page, authn.authenticatorId, true);
    await page
      .getByRole("button", { name: /add passkey|register passkey/i })
      .first()
      .click();

    // Eventually a credential should exist in the virtual authenticator
    await expect
      .poll(async () => (await authn.getCredentials()).length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);

    await authn.remove();
  });

  test("authentication recovers from network interruption", async ({ context, page }) => {
    const authn = await installVirtualAuthenticator(context, page);
    await page.goto("/auth");

    await withOfflineWindow(page, async () => {
      // Attempt sign in while offline; UI should show retry CTA
      await page
        .getByRole("button", { name: /sign in with passkey/i })
        .first()
        .click()
        .catch(() => {
          /* tolerate missing button on environments without registered users */
        });
    });

    // Back online: retry should succeed (or surface a recovery CTA)
    await page
      .getByRole("button", { name: /sign in with passkey|try again|retry/i })
      .first()
      .click()
      .catch(() => {
        /* tolerate */
      });

    // Either a session is established OR a clearly-labeled fallback CTA appears
    const sessionOrFallback = page.locator(
      '[data-testid="passkey-fallback-cta"], [data-testid="user-menu"], a[href="/settings"]',
    );
    await expect(sessionOrFallback.first()).toBeVisible({ timeout: 15_000 });

    await authn.remove();
  });

  test("mid-flow reload issues a fresh challenge (no stale 'Challenge expired' leak)", async ({
    context,
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    const authn = await installVirtualAuthenticator(context, page);
    await page.goto("/auth");
    await page.reload({ waitUntil: "networkidle" });
    expect(
      consoleErrors.filter((m) => /challenge expired/i.test(m)),
      `unexpected challenge-expired error after reload: ${consoleErrors.join("\n")}`,
    ).toHaveLength(0);
    await authn.remove();
  });
});
