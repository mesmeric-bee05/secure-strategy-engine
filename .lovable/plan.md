## Goal

Five coordinated hardening tasks. All narrowly scoped, no product/design changes.

---

## 1. E2E: locale-fresh map labels + AI explanation

New spec `tests/e2e/i18n-map-ai-fresh.spec.ts`:

- For each locale in `[en, sw, fr, ha]`:
  1. Visit `/opportunities/map`, switch language via `LanguageSwitcher`, assert `document.documentElement.lang` and that visible MapLibre popup / legend / marker labels use only the target locale's `mapLabels.*` strings (loaded from `src/lib/i18n/locales/<lang>.json`). Assert no string from any *other* locale bundle appears in the map DOM.
  2. Trigger a match-explanation render (mock `getMatchExplanation` server fn with a fixture), assert `MatchExplanation.tsx` output equals the locale bundle's `aiExplanation.*` template interpolation exactly.
  3. Switch locale twice more (round-trip) and re-assert — catches memoised/cached stale strings.
- Add a helper `tests/e2e/_helpers/locale-diff.ts` that loads all four JSON bundles and returns "strings that appear ONLY in locale X" so assertions are automatic, not hand-written.

Guardrail: fails if any component ships hardcoded English fallbacks in the map or explanation code paths.

---

## 2. E2E: WebAuthn retry + network-interruption reliability

Extend existing `tests/e2e/passkey-retry.spec.ts` with three new scenarios:

- **Retry loop under `NotAllowedError`**: virtual authenticator rejects the first 2 assertions, succeeds on the 3rd. Expect UI to surface "Try again" each time and finally establish a session (redirect off `/auth`).
- **Network interruption mid-challenge**: use Playwright `page.route()` to fail `**/passkeys.functions/**` on the first attempt (abort), then let it through. Expect the client to retry automatically and land in a signed-in state.
- **Server 5xx once, then 200**: same shape, using `route.fulfill({ status: 503 })` once. Confirms `PasskeyManager` + underlying server fn are resilient without duplicate session creation (assert `supabase.auth.getSession()` returns exactly one session, not stacked).

Runs inside the existing `hasEnv` skip gate so local checkouts without Supabase creds stay green.

---

## 3. Security re-scan + fix pass

- Call `security--run_security_scan` to force a fresh scan surface.
- Call `security--get_scan_results` (including `connector_security_scan` findings, e.g. Wiz).
- For each new finding:
  - **Fix** (migration, code edit, dependency bump) → then `security--manage_security_finding` with `mark_as_fixed`.
  - **Not applicable in context** → `ignore` with a concrete explanation, and update `security--update_memory` so future scans don't reproduce it.
- Re-run `supabase--linter` after any migration; iterate until clean.

Deferred until run time: exact fixes depend on what the fresh scan returns. Nothing is pre-committed.

---

## 4. Automated /dashboard tab checks

New spec `tests/e2e/dashboard-tabs.spec.ts`:

- Visit `/dashboard`.
- For each of Phases, Tech Stack, Features, Security, Status:
  - Click the tab, assert it becomes `aria-selected="true"`.
  - Assert the expected data slice from `src/lib/dashboard-content.ts` is rendered:
    - Phases: 6 phase cards, titles match `dashboardContent.phases[i].title`.
    - Tech Stack: badge groups (frontend/backend/AI/data/infra/blockchain) present with expected counts.
    - Features: 6 feature cards, each links to the correct route.
    - Security: checklist rows equal the `dashboardContent.security` entries; RLS row count matches `tests/security/__fixtures__/rls.expected.json` table count.
    - Status: 4 stat cards render (phases done, tests passing, locales shipped, scan findings open).
  - Screenshot each tab into `tests/e2e/__screenshots__/dashboard-<tab>.png` for visual regression.

Companion unit test `src/routes/__tests__/dashboard.content.test.ts` validates `dashboard-content.ts` shape with Zod, so drift between the doc and the route fails at unit-test time (fast) before the e2e even runs.

---

## 5. CI on every push

Extend `.github/workflows/tests.yml` (or add `.github/workflows/ci.yml` if cleaner) so **push** and **pull_request** both trigger a single `checks` job:

```yaml
on: [push, pull_request]
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup-bun
      - bun install --frozen-lockfile
      - bun run lint                         # eslint
      - bunx tsgo --noEmit                   # typecheck
      - bun run build:dev                    # verifies Vite/TanStack build
      - bun run test                         # vitest (unit + integration)
      - bunx playwright install --with-deps chromium
      - bun run test:e2e                     # Playwright, incl. new specs above
```

- Cache `~/.bun/install/cache` and `node_modules/.vite` for speed.
- Upload Playwright HTML report + screenshots on failure via `actions/upload-artifact@v4`.
- Keep the existing `security-regression.yml` workflow separate (its own scheduled cron), so this new job is push-triggered only.
- Concurrency group keyed on ref so redundant runs cancel.

---

## Out of scope

- Any product/design changes (dashboard content, map styling, passkey UX copy).
- New backend tables or RLS changes beyond what a security-scan fix requires.
- Adding new locales.
- Rewriting the existing security-regression workflow.

## Verification

- All new specs pass locally: `bun run test && bun run test:e2e`.
- `tsgo --noEmit` clean, `bun run lint` clean, `bun run build:dev` clean.
- Fresh security scan returns zero unaddressed findings; `security-memory` reflects any accepted ignores.
- CI green on the first push after merge.
