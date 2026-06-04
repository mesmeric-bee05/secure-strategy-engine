# Test hardening: i18n + WebAuthn E2E and contract tests

Goal: turn the existing Vitest coverage into a defense-in-depth test suite that fails CI when (a) a locale regresses, (b) the passkey flow breaks, or (c) a user's selected language fails to persist. Two layers:

1. **Vitest (fast, runs on every commit, gates the build)** — contract + integration tests with jsdom.
2. **Playwright (E2E, runs in CI separately)** — real browser, virtual WebAuthn authenticator, real `localStorage`, real route navigation.

No production code changes — tests only, plus minimal `data-testid` hooks where the DOM doesn't already expose stable selectors.

---

## 1. New tooling

- Add dev deps: `@playwright/test`, `@axe-core/playwright` (optional a11y check).
- `playwright.config.ts` at repo root: `webServer: { command: "bun run dev", port: 5173, reuseExistingServer: true }`, projects for `chromium` (only browser with WebAuthn virtual authenticator), retries=2, trace on first retry.
- `package.json` scripts:
  - `test:e2e` → `playwright test`
  - `test:i18n:strict` → `vitest run src/lib/i18n/__tests__/locales.strict.test.ts` (also wired into `test` so the build fails on key drift)
  - `pretest` → ensures the strict locale check runs first.
- `tests/e2e/` directory with helpers in `tests/e2e/_helpers/`.

---

## 2. Vitest additions (build-gating)

### 2a. `src/lib/i18n/__tests__/locales.strict.test.ts`
Hardens the existing key-parity test into a build gate:
- Snapshot the **canonical key set** = flattened keys of `en.json`. Any new key in `en` MUST appear in `sw`, `fr`, `ha` — fail with a per-locale list of missing keys.
- Reject empty strings, untrimmed strings, and values still equal to the English source for the curated "must-translate" set (already partly covered; widen to ~25 user-visible keys: nav, common, map, ai, passkeys, settings, errors, toasts).
- Verify every `{{placeholder}}` token in `en` survives in each other locale (count + names match).
- Verify each locale parses as valid JSON with no trailing commas (import will throw otherwise; explicit assertion adds a friendlier message).
- This file is included by default; failure here fails `bun run test` → fails the build.

### 2b. `src/lib/i18n/__tests__/persistence.test.ts` (jsdom)
- After `i18n.changeLanguage("fr")`, assert `localStorage.getItem("lng") === "fr"` and `document.cookie` contains `lng=fr`.
- Reset the `i18n` singleton (`vi.resetModules()`), re-import, and assert it boots into `fr` from `localStorage` — proves persistence across "reloads".
- Negative: clear storage, set `navigator.language = "ha-NG"`, re-import, assert it boots into `ha` (detector fallback chain).

### 2c. `src/components/__tests__/SettingsLanguage.test.tsx`
- Renders the `/settings` page tree (with `I18nProvider` + `LanguageSwitcher`), changes language to Hausa, asserts:
  - Settings heading re-renders in Hausa.
  - `PasskeyManager` strings (title, recovery copy) re-render in Hausa.
  - `localStorage.lng === "ha"`.

### 2d. `src/lib/passkeys/__tests__/recovery.test.ts`
Locks the recovery/fallback contract beyond what `passkeys.functions.test.ts` covers:
- `finishPasskeyAuthentication` with stale challenge → throws `"Challenge expired."` (not a generic message — UI relies on this exact string for fallback CTA).
- `finishPasskeyAuthentication` with unknown credential → throws `"Unknown passkey."` AND does NOT call `auth.admin.generateLink` (no session leak on enumeration).
- `startPasskeyAuthentication` with unknown email → returns options with `allowCredentials: []` (no enumeration) AND still inserts a challenge row (so timing matches the known-email path).
- `deletePasskey` with someone else's id (IDOR attempt) → both `id` and `user_id` `eq` filters are applied (regression guard against the existing finding).
- A contract snapshot of the public fallback strings consumed by `PasskeySignInButton` (`passkeys.fallbackPassword`, `passkeys.fallbackMagicLink`) — fails if either is removed from any locale.

---

## 3. Playwright E2E

Shared helpers in `tests/e2e/_helpers/`:
- `webauthn.ts` — wraps Chromium DevTools Protocol to enable a virtual authenticator:
  ```ts
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal",
               hasResidentKey: true, hasUserVerification: true,
               isUserVerified: true, automaticPresenceSimulation: true },
  });
  ```
  Exposes `resetAuthenticator()` and `getCredentials()` for assertions.
- `auth.ts` — programmatic Supabase sign-in via `supabase.auth.admin.generateLink` against the test project (uses env vars from `.env.test`, never production).
- `i18n.ts` — `switchLanguage(page, code)` clicks the `LanguageSwitcher` and waits for `document.documentElement.lang === code`.

### 3a. `tests/e2e/i18n.spec.ts` — locale switching across pages
For each `code` in `["sw", "fr", "ha"]`:
- Visit `/`, `/opportunities`, `/opportunities/map`, `/skills`, `/settings`, `/trust-graph`.
- On each page, call `switchLanguage(page, code)` and assert:
  - `<html lang>` equals `code`.
  - A locale-specific anchor string (loaded from the same JSON used at runtime — no hardcoding) is visible.
  - **Anti-stale-cache assertion**: navigate away and back; assert the page still renders in `code` (no English flash). Use `page.waitForFunction` for `lang` rather than a fixed timeout.
  - For `/opportunities/map`: assert the MapLibre control labels / legend re-render in `code` (uses `data-testid="map-legend"`).
  - For AI components (`MatchExplanation`, prompt previews): assert the prompt-preview label uses `t("ai.promptLocale", { language })` and the rendered string contains the localized language name.
- Reload the page → assert language stays.
- Open a fresh `context` (clean storage), set `localStorage.lng = code` before navigation, assert the app boots into `code` without a flash to English. Then clear storage entirely and assert it falls back to `en`.

### 3b. `tests/e2e/passkey.spec.ts` — full WebAuthn flow
Uses the virtual authenticator helper. Marked `test.describe.configure({ retries: 2 })` per the user's "reliably across retries" requirement; flake-debug helper logs CDP credentials on failure.

1. **Registration** — sign in test user via magic-link helper, visit `/settings`, click "Add a passkey", assert toast `passkeys.registered`, assert a new row appears with the device label, assert `getCredentials()` returns exactly 1 credential.
2. **Authentication + session establishment** — sign out, visit `/auth`, enter the test email, click "Sign in with passkey", assert the page redirects to the action link, follow it, assert the user lands on `/` authenticated (cookie + `supabase.auth.getUser()` resolves to the test user). Repeat the test with `retries: 2` enabled to catch flakiness.
3. **Multiple passkeys** — register a second credential (reset+re-add the virtual authenticator), assert both rows render, delete one, assert only the other survives and the deleted one is gone from CDP credentials.
4. **Negative — expired challenge**: register, then `await page.clock.fastForward("10:00")` (or DB-level: mark `webauthn_challenges.expires_at` in the past via an admin helper), retry finish → expect the localized "Challenge expired" error toast and that no row was inserted.
5. **Negative — missing credential**: reset the virtual authenticator (deletes server-known credential client-side), attempt sign-in, expect `"Unknown passkey."` toast and that the page does NOT redirect.
6. **Fallback paths visible**: on `/auth`, assert "Use password instead" and "Email me a magic link" links are present and clickable in every locale.
7. **Recovery**: trigger password reset for the same email, assert the reset email link is generated (admin helper) and that visiting it lands on `/reset-password` — proves a passkey-less user can recover.

### 3c. `tests/e2e/language-persistence.spec.ts`
- Switch to `fr` on `/settings`, hard-reload, assert still `fr`.
- Close the context, open a new context with the same storage state (`storageState` file), navigate to `/`, assert still `fr`.
- Open a brand-new context with no storage, set `Accept-Language: ha`, navigate to `/`, assert detector picks `ha`.
- Verify the `lng` cookie is set with `SameSite=Lax` and not `HttpOnly` (so the detector can read it on the next visit).

---

## 4. CI wiring

`.github/workflows/tests.yml` (existing) gains two jobs:
- `unit` (current) — `bun run test` (now includes the strict locale gate).
- `e2e` — installs Playwright browsers (`bunx playwright install --with-deps chromium`), boots dev server, runs `bunx playwright test`, uploads HTML report + traces on failure. Runs only on PRs and main; uses a dedicated Supabase test project via repo secrets (never the production keys).

---

## 5. Out of scope

- No production code changes other than adding `data-testid` to the map legend and the AI prompt preview where there is no stable selector today.
- No changes to Neo4j or edge-function code.
- No real hardware authenticator — Chromium's virtual authenticator is the contract.
- No load/perf tests.

---

## File list (new)

- `playwright.config.ts`
- `tests/e2e/_helpers/{webauthn.ts,auth.ts,i18n.ts}`
- `tests/e2e/i18n.spec.ts`
- `tests/e2e/passkey.spec.ts`
- `tests/e2e/language-persistence.spec.ts`
- `src/lib/i18n/__tests__/locales.strict.test.ts`
- `src/lib/i18n/__tests__/persistence.test.ts`
- `src/components/__tests__/SettingsLanguage.test.tsx`
- `src/lib/passkeys/__tests__/recovery.test.ts`
- Edits: `package.json` (scripts + devDeps), `.github/workflows/tests.yml`, two small `data-testid` additions in `OpportunitiesMap.tsx` and `MatchExplanation.tsx`.
