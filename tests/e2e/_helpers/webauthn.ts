import type { BrowserContext, Page } from "@playwright/test";

/**
 * Enables Chromium's virtual WebAuthn authenticator on the given page.
 * Returns an API for asserting on credentials and resetting state.
 *
 * Chrome DevTools Protocol: https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/
 */
export async function installVirtualAuthenticator(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  return {
    authenticatorId,
    async getCredentials() {
      const { credentials } = await cdp.send("WebAuthn.getCredentials", { authenticatorId });
      return credentials;
    },
    async clearCredentials() {
      await cdp.send("WebAuthn.clearCredentials", { authenticatorId });
    },
    async remove() {
      await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    },
  };
}
