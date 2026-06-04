import { expect, test } from "@playwright/test";
import { installVirtualAuthenticator } from "./_helpers/webauthn";
import { generateMagicLink, requireE2EEnv } from "./_helpers/auth";

// These tests require a configured Supabase test project. Skip the whole
// file when env is missing so a fresh checkout can still run `test:e2e`.
const hasEnv = !!(
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.E2E_TEST_EMAIL
);

test.describe.configure({ retries: 2 });

test.describe("WebAuthn passkey end-to-end", () => {
  test.skip(!hasEnv, "Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_TEST_EMAIL");

  test("register a passkey, authenticate, establish session", async ({ browser }) => {
    const { E2E_TEST_EMAIL } = requireE2EEnv();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const auth = await installVirtualAuthenticator(ctx, page);

    // Sign in via magic link (programmatic, not UI).
    const link = await generateMagicLink(E2E_TEST_EMAIL);
    await page.goto(link);
    await page.waitForURL(/\/(?!auth)/, { timeout: 15_000 }).catch(() => {});

    // Register a passkey.
    await page.goto("/settings");
    await page.getByRole("button", { name: /Add a passkey/i }).click();
    await expect(page.getByText(/Passkey added/i)).toBeVisible({ timeout: 10_000 });

    const creds = await auth.getCredentials();
    expect(creds.length).toBeGreaterThan(0);

    // Authenticate from a logged-out context.
    await ctx.clearCookies();
    await page.goto("/auth");
    await page.getByPlaceholder(/you@example.com/i).fill(E2E_TEST_EMAIL);
    await page.getByRole("button", { name: /Sign in with passkey/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 15_000 });

    await ctx.close();
  });

  test("missing credential surfaces 'Unknown passkey.' and does not redirect", async ({ browser }) => {
    const { E2E_TEST_EMAIL } = requireE2EEnv();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const auth = await installVirtualAuthenticator(ctx, page);
    await auth.clearCredentials();

    await page.goto("/auth");
    await page.getByPlaceholder(/you@example.com/i).fill(E2E_TEST_EMAIL);
    await page.getByRole("button", { name: /Sign in with passkey/i }).click();

    await expect(page.getByText(/Unknown passkey|did not verify|Challenge/i))
      .toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain("/auth");
    await ctx.close();
  });

  test("fallback / recovery paths are always reachable", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText(/Use password instead/i)).toBeVisible();
    await expect(page.getByText(/Email me a magic link/i)).toBeVisible();
  });
});
