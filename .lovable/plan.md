## Goal

Add reliable automated test coverage for two critical surfaces:
1. **i18n** — all four locales (en, sw, fr, ha) load, key parity holds, and the React layer renders translated strings + reacts to language changes.
2. **WebAuthn passkeys** — registration, authentication (happy path), and recovery/fallback flows behave correctly under both success and failure conditions.

Tests run in the existing Vitest + jsdom setup (`vitest.config.ts`, `vitest.setup.ts`) and in the GitHub Actions workflow already wired at `.github/workflows/tests.yml`.

---

## Scope

### 1. i18n tests — `src/lib/i18n/__tests__/`

**`locales.test.ts`** (pure, no React)
- Import all four JSON locales directly.
- Assert each locale is non-empty and parses as an object.
- Compute the full set of dotted key paths from `en.json` (source of truth) and assert `sw`, `fr`, `ha` contain the **exact same key set** — no missing keys, no extra keys. Fail with a readable diff listing offending keys per locale.
- Assert no translation value is an empty string or still equal to the English value for a sample of user-visible keys (e.g. `nav.*`, `passkeys.*`, `map.*`) — catches "forgot to translate".
- Assert `SUPPORTED_LANGUAGES` codes match the locale files present.

**`i18n.runtime.test.tsx`** (React)
- Render a tiny probe component using `useTranslation()` inside the existing `I18nProvider`.
- For each supported language: call `i18n.changeLanguage(code)`, assert the probe renders the expected translated string for a stable key (e.g. `nav.settings`), and assert `document.documentElement.lang` is updated by `I18nProvider`.
- Assert fallback: requesting an unknown language falls back to `en`.
- Assert interpolation works (`ai.promptLocale` with `{{language}}`).

**`LanguageSwitcher.test.tsx`**
- Render `LanguageSwitcher`, simulate selecting each language, assert `i18n.language` updates and the chosen label is reflected in the DOM.

### 2. WebAuthn passkey tests

WebAuthn cannot be exercised end-to-end in jsdom (no real authenticator). We split coverage into three layers — unit, server-function, and a mocked browser flow — which together verify every branch users hit in production.

**a. Server-function unit tests — `src/lib/passkeys/__tests__/passkeys.functions.test.ts`**

Mock `@simplewebauthn/server` and `supabaseAdmin` (the auth-middleware-injected client) to test our wrapper logic in isolation:

- `startPasskeyRegistration`
  - Rejects invalid `origin` (zod regex).
  - Calls `generateRegistrationOptions` with the right `rpID`/`rpName` derived from origin.
  - Passes existing credentials as `excludeCredentials`.
  - Persists a `registration` row in `webauthn_challenges`.
- `finishPasskeyRegistration`
  - Throws "Challenge expired" when no challenge row / past `expires_at`.
  - Throws on `verifyRegistrationResponse` failure (`verified: false`).
  - On success: inserts a `passkeys` row with base64 public key, counter, transports, `backed_up`, and deletes the consumed challenge.
- `listPasskeys` / `deletePasskey`
  - Scopes queries to `context.userId`; `delete` enforces both `id` and `user_id` filters (no IDOR).
- `startPasskeyAuthentication`
  - Returns identical option shape whether or not the email exists (no user-enumeration leak: assert `allowCredentials` is `[]` for unknown emails, options object still returned).
  - Persists an `authentication` challenge keyed by email.
- `finishPasskeyAuthentication`
  - "Challenge expired" when row missing/stale.
  - "Unknown passkey" when credential id not found.
  - "Passkey signature did not verify" when verification fails.
  - On success: updates counter + `last_used_at`, deletes the challenge, calls `auth.admin.generateLink({ type: 'magiclink' })`, and returns `{ actionLink }`.
  - Throws when `generateLink` fails (recovery path — caller sees readable error, no silent session mint).

**b. UI flow tests — `src/components/__tests__/PasskeyManager.test.tsx`**

Mock `@simplewebauthn/browser` (`startRegistration`, `startAuthentication`) and the server functions exposed via `useServerFn`. Cover:

- **Registration happy path**: click "Add a passkey" → calls `startPasskeyRegistration`, then `startRegistration` (browser), then `finishPasskeyRegistration`, then refreshes the list and shows the new device label.
- **Registration error path**: simulate `startRegistration` throwing (user-cancelled / not allowed) → toast.error shown, no row added, button re-enabled.
- **List + delete**: renders existing passkeys from `listPasskeys`, delete button calls `deletePasskey` and the row disappears.
- **`PasskeySignInButton` happy path**: enter email → `startPasskeyAuthentication` → `startAuthentication` → `finishPasskeyAuthentication` returns `actionLink` → assert `window.location.href` is set to that link (via a `window.location` setter mock).
- **Sign-in error path**: server throws "Unknown passkey" → toast.error shown, no redirect.
- **Recovery / fallback messaging**: assert the component renders the `passkeys.fallbackPassword`, `passkeys.fallbackMagicLink`, and `passkeys.recovery` strings — guarantees the documented recovery paths (password + email magic link) remain visible if all passkeys are lost.

**c. Recovery integration test — `src/lib/passkeys/__tests__/recovery.test.ts`**

Pure unit test that documents and locks in the recovery contract:
- When a user has zero passkeys, `listPasskeys` returns `{ passkeys: [] }` and the UI surfaces the "no passkeys" + recovery copy (covered in PasskeyManager test above; this test asserts the data contract).
- When `finishPasskeyAuthentication`'s `generateLink` errors, the function throws — confirming the client must surface the error and the user can fall back to password / Supabase `resetPasswordForEmail` (the actual reset flow lives in Supabase Auth and is not re-tested).

### 3. Shared test plumbing

- Add `vi.mock` factories for `@/integrations/supabase/client.server` and `@/integrations/supabase/auth-middleware` reused across server-fn tests (in `src/test/mocks/supabase.ts`).
- Add a `renderWithI18n` helper in `src/test/utils.tsx` that mounts components inside `I18nProvider` and resets language between tests.
- Ensure `vitest.setup.ts` initializes i18n once and resets to `en` in an `afterEach`.

### 4. CI

- Confirm `.github/workflows/tests.yml` runs `bunx vitest run` (or equivalent); add coverage thresholds only if already configured — otherwise leave as-is to avoid scope creep.

---

## Out of scope (explicit)

- No changes to production i18n, passkey, or auth code — tests must pass against the current implementation. If a genuine bug is uncovered while writing tests, surface it back with a follow-up plan rather than silently editing prod code.
- No Neo4j / edge-function tests.
- No real WebAuthn hardware/virtual-authenticator harness (e.g. `@simplewebauthn/server`'s test virtual authenticator). Can be added in a later phase if you want end-to-end signature verification against real key material.

---

## Deliverables checklist

- [ ] `src/lib/i18n/__tests__/locales.test.ts`
- [ ] `src/lib/i18n/__tests__/i18n.runtime.test.tsx`
- [ ] `src/components/__tests__/LanguageSwitcher.test.tsx`
- [ ] `src/lib/passkeys/__tests__/passkeys.functions.test.ts`
- [ ] `src/lib/passkeys/__tests__/recovery.test.ts`
- [ ] `src/components/__tests__/PasskeyManager.test.tsx`
- [ ] `src/test/mocks/supabase.ts`, `src/test/utils.tsx`
- [ ] All tests green under `bunx vitest run`

Confirm to proceed and I'll implement these in build mode.