# Security, Test, and CI Hardening Plan

Work is split into 8 tracks. Each track is independently shippable; tracks 1–4 are test/CI only, 5–8 touch backend/security.

---

## 1. E2E locale assertions for map + AI (no stale strings)

**File:** `tests/e2e/i18n-map-ai.spec.ts`

For each locale (`en`, `sw`, `fr`, `ha`):
- Visit `/opportunities/map`, switch locale, assert:
  - `<html lang>` matches.
  - Visible legend/filter/marker-popup labels equal locale anchor strings (loaded from `src/lib/i18n/locales/<locale>.json` at test time — no hard-coded strings).
  - Open a marker popup, confirm dynamic labels (e.g. "Distance", "Skills match") use new locale.
- Visit a page that renders the AI match-explanation panel; trigger an explanation (mock the AI server fn via Playwright `page.route` to return a deterministic structured response), confirm static chrome (headings, "Why this match", citation footer) is translated.
- **Anti-stale-cache assertions**: navigate away → back, hard-reload (`page.reload()`), and `page.goto` with `waitUntil: "networkidle"`; re-assert all anchor strings. Fail if any English fallback leaks.
- Use a helper `assertNoStringFromOtherLocale(page, currentLocale)` that scans `body.innerText` for known unique substrings from the other 3 locales and fails on match.

---

## 2. WebAuthn retry + network-interruption E2E

**File:** `tests/e2e/passkey-retry.spec.ts`

Extend `tests/e2e/_helpers/webauthn.ts` with `simulateAuthenticatorFailure()` (CDP `WebAuthn.setUserVerified=false`, then re-enable) and `withOfflineWindow(page, fn)`.

Scenarios (Playwright `test.describe.serial`, `retries: 2`):
1. Registration with one transient authenticator failure → retry succeeds, session established (assert Supabase `getSession()` returns a user).
2. Authentication with `page.context().setOffline(true)` during `navigator.credentials.get()` finish step → restore network → retry → session established.
3. Three consecutive auth failures → UI surfaces fallback CTA (`data-testid="passkey-fallback-cta"`) and recovery email link path is reachable.
4. Mid-flow tab reload during challenge → fresh challenge issued, no "Challenge expired" leak in console.
5. Run scenarios 1–3 in a `for (i = 0; i < 5; i++)` loop in CI nightly job to detect flake.

---

## 3. Visual regression across locales

**Tooling:** Playwright built-in `toHaveScreenshot()` (no extra dep).

**File:** `tests/e2e/visual.spec.ts`

Matrix: locales `[en, sw, fr, ha]` × pages `[/, /opportunities, /opportunities/map, /skills, /trust-graph, /settings, /security, /readiness]` × viewports `[mobile 390×844, desktop 1280×800]`.

For each cell:
- `await page.evaluate(() => document.fonts.ready)` and disable animations via `prefers-reduced-motion` emulation + a `*{animation:none!important;transition:none!important}` injected style.
- Mask volatile regions: timestamps, map tile canvas, AI streaming areas — pass `mask: [page.locator('[data-volatile]')]`.
- Baseline snapshots stored in `tests/e2e/__screenshots__/`; commit baselines from CI on first run via workflow_dispatch input `update_snapshots=true`.
- Pixel diff threshold: `maxDiffPixelRatio: 0.02`.

Output uploaded as a CI artifact (see Track 4).

---

## 4. CI reports + artifacts

**File:** `.github/workflows/tests.yml`

- Playwright: `reporter: [['html', { outputFolder: 'playwright-report' }], ['list'], ['github']]` in `playwright.config.ts`.
- Vitest: add `--reporter=default --reporter=html --outputFile=vitest-report/index.html` to the unit/i18n-strict scripts in `package.json`.
- New CI steps (always run, even on failure):
  ```
  - uses: actions/upload-artifact@v4
    if: always()
    with:
      name: playwright-report-${{ matrix.shard }}
      path: playwright-report
      retention-days: 14
  - uses: actions/upload-artifact@v4
    if: always()
    with:
      name: visual-diffs
      path: test-results
  - uses: actions/upload-artifact@v4
    if: always()
    with:
      name: vitest-report
      path: vitest-report
  ```
- PR comment with report download link via `dawidd6/action-download-artifact` summary step.

---

## 5. Move `pgvector` out of `public` schema

Migration `move_pgvector_to_extensions_schema.sql`:

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER EXTENSION vector SET SCHEMA extensions;
-- Postgres search_path for API roles so unqualified vector ops keep working
ALTER ROLE anon         SET search_path = public, extensions;
ALTER ROLE authenticated SET search_path = public, extensions;
ALTER ROLE service_role  SET search_path = public, extensions;
```

**Risk:** any table column typed `vector(...)` keeps its type (operator class is by OID, not name); but stored generated columns or function bodies that reference unqualified `vector` may break. Pre-migration audit:
```sql
SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prosrc ILIKE '%vector%' AND n.nspname='public';
```
If any custom function references unqualified vector ops, qualify with `extensions.` before the schema move.

**Validation:**
- Re-run Supabase linter; `SUPA_extension_in_public` must clear.
- E2E smoke: pages that touch embedding-backed reads (skills search, match explanation) load without error.
- New Vitest: `src/lib/__tests__/pgvector-schema.test.ts` queries `pg_extension` via a read-only server fn and asserts `extnamespace = 'extensions'`.

If the migration cannot complete (managed Postgres restriction), capture the exact error, revert, and document the limitation in security memory — do not silently leave the warning unmarked.

---

## 6. Harden `has_role` + `submit_attestation`

### `has_role`
Already SECURITY DEFINER, STABLE, `search_path = public`. Add:
- Explicit `RAISE EXCEPTION WHEN _user_id IS NULL OR _role IS NULL` (currently returns false silently — masks bugs).
- New audit on **admin-role checks only** (avoid logging every authenticated read): a wrapper `assert_admin()` SECURITY DEFINER that calls `has_role(auth.uid(), 'admin')` and `INSERT INTO audit_log` on denial. Use in any server fn that performs admin actions.

### `submit_attestation`
Add inside the function body, before insert:
- Rate limit: `PERFORM rl_check('attestation:submit', auth.uid()::text, 10, 3600)`; raise on false.
- Reject duplicates: `IF EXISTS (SELECT 1 FROM attestations WHERE attester_id=auth.uid() AND skill_id=_skill_id) THEN RAISE EXCEPTION 'duplicate attestation';`
- Verify `_attester_pubkey`/`_ecdsa_signature`/`_payload_hash` are non-empty and length-bounded (≤512 chars).
- Audit log every call (success + failure) with `action='attestation_submit'`, metadata `{skill_id, relationship, outcome}` — no PII.

### Tests
- `src/lib/__tests__/has_role.test.ts`: null inputs raise; non-admin call returns false; admin call returns true; assert_admin denial writes audit row.
- `src/lib/__tests__/submit_attestation.test.ts`: self-attestation rejected; duplicate rejected; rate-limit ceiling; oversized signature rejected; happy path inserts row + promotes skill at weight ≥ 2.5; audit row present for each path.
- Run via Vitest using a service-role client + test user fixtures; teardown deletes attestation/audit rows by `metadata->>test_run_id`.

---

## 7. Re-run all security scans + prioritized findings list

Sequence (build mode):
1. `security--run_security_scan` (Supabase Lov + Supabase linter).
2. `supabase--linter` standalone for fresh view.
3. `security--get_scan_results` to ingest connector scans (Wiz). If no Wiz findings are returned, report that explicitly — don't fabricate.
4. Produce `docs/security/findings-<date>.md` with table: `id | scanner | severity | resource | status | next action | owner`. Sort by severity then resource sensitivity. Mark deltas vs prior accepted-risk memory.
5. Update `security memory` only if posture changed (e.g., pgvector moved → drop that accepted risk).

---

## 8. CI security regression gates

**File:** `.github/workflows/security-regression.yml` (nightly + on PR touching `supabase/migrations/**` or `src/integrations/supabase/**`).

Steps:
1. **RLS invariant test** — `tests/security/rls.invariants.test.ts` (Vitest, service-role client):
   - Snapshot expected policy set as JSON fixture (`tests/security/__fixtures__/rls.expected.json`):
     ```json
     {
       "profiles":          ["profiles_authenticated_read","profiles_self_insert","profiles_self_update"],
       "attestations":      ["attestations_read","attestations_no_write"],
       "credential_anchors":["credentials_owner_read","credentials_no_write"],
       "audit_log":         ["audit_admin_read","audit_log_no_write"],
       "fairness_audits":   ["fairness_admin_read","fairness_audits_no_write"],
       "rate_limits":       ["rate_limits_no_access","rate_limits_no_write"]
     }
     ```
   - Query `pg_policies` for each table; fail if set differs (added, removed, renamed).
   - Also assert: anon SELECT against each table returns 0 rows (or permission error); authenticated SELECT respects scoping (uses two seeded test users, asserts user A cannot read user B's credential).
2. **EXECUTE-grant invariant**: query `information_schema.role_routine_grants` for `issue_credential, rl_check, handle_new_user, set_updated_at`; assert no grant to anon/authenticated. For `has_role, submit_attestation` assert authenticated only.
3. **Scan-delta gate**: store last known findings hash in `tests/security/__fixtures__/findings-baseline.json`. Job re-runs scans, computes a deterministic hash of `{scanner, id, internal_id, level}` set, fails if hash differs. Updating baseline requires explicit PR edit (review forcing function).
4. Add the new job to required-checks for `main`.

---

## Technical sequencing

```text
Week 1
  Track 1, 2, 3 (tests) and Track 4 (CI plumbing) in parallel
Week 1 end
  Track 7 (re-scan + report) — surfaces any new regressions before backend work
Week 2
  Track 5 (pgvector) → Track 8 (regression gates with new baseline)
Week 2 end
  Track 6 (function hardening) — depends on audit_log writes already locked down
```

## Out of scope

- Replacing pgvector with a different vector backend.
- Real hardware WebAuthn authenticators (CDP virtual authenticator only).
- Load/penetration testing — covered separately.
- Cross-browser visual baselines (Chromium only; Firefox/WebKit deferred).
- Mobile native passkey platform-authenticator tests (browser virtual authenticator only).

## Out-of-scope guardrails

No production code refactors beyond what Tracks 5 and 6 require. No UI copy changes. No new locales. No edge-function migration of existing server fns.
