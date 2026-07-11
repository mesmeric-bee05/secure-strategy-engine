
## Scope

Four focused deliverables on top of the existing Security → Findings History and nightly scan infrastructure. No unrelated refactors.

## 1. E2E: Findings History renders side-by-side statuses

New Playwright spec `tests/e2e/security-findings-history.spec.ts`.

- Seed two deterministic fixtures under `public/security/history/` at test setup (via a `test.beforeAll` that writes `run-e2e-A.json`, `run-e2e-B.json`, and an `index.json`) covering one `new`, one `recurring`, one `accepted`, one `ignored`, and one `resolved` finding.
- Sign in with the seeded admin passkey helper (`tests/e2e/_helpers/auth.ts`) so RBAC (see §3) allows access.
- Navigate to `/security/findings-history`, wait for both run cards to load, then assert:
  - Both runIds appear in the Runs table with correct totals.
  - Each fingerprint row has the expected status label (`NEW`, `RECURRING`, `ACCEPTED`, `IGNORED`, `RESOLVED`) in the correct A/B column via `getByRole` + `aria-label`.
  - A `resolved` finding shows "Not present" in the newer column.
- Restore original history files in `afterAll`.

## 2. Regression: fingerprint dedupe + additive artifacts between runs

New Vitest suite `tests/security/fingerprint.dedupe.regression.test.ts`.

- Uses `scripts/security/fingerprint.ts` `dedupe` + `diffAgainstPrevious`.
- Case A: identical findings across two runs produce zero `new`, all `recurring`, and identical fingerprint sets.
- Case B: adding one novel finding yields exactly one `new` fingerprint; all prior fingerprints stay `recurring`.
- Case C: reordering, whitespace, and casing variants of the same finding collapse to a single fingerprint (guards against fingerprint drift).
- Case D: artifact invariant — assert that `nextRun.fingerprints ⊇ prevRun.fingerprints \ resolved` and that new fingerprints in `nextRun` are strictly those classified `new`.

## 3. RBAC on Findings History route + JSON artifacts

Route protection:
- Move `src/routes/security.findings-history.tsx` into the `_authenticated` subtree as `src/routes/_authenticated/security.findings-history.tsx` so the managed auth gate applies.
- Add a `beforeLoad` that calls a new protected server function `requireSecurityViewer()` (in `src/lib/server-fns/security.functions.ts`) which uses `requireSupabaseAuth` middleware and checks `public.has_role(auth.uid(), 'admin')` OR a new `security_viewer` role via the existing `has_role` function.
- On failure, `throw redirect({ to: "/" })` with a toast-friendly search param.
- Update the `/security` dashboard link to only render for authorized users (fetch the same server fn via TanStack Query).

Artifact protection:
- Move nightly artifacts out of `public/security/history/` (world-readable) into a non-public path served by a new authenticated server route `src/routes/api/security/history.$runId.ts` that:
  - Requires bearer auth via `requireSupabaseAuth`.
  - Verifies `has_role(uid, 'admin' | 'security_viewer')`.
  - Streams the JSON from a build-time bundled directory (`src/security-history/*.json` imported via `import.meta.glob`) or from a Supabase Storage bucket with a private policy — pick storage if the workflow already uploads there; otherwise ship the bundled-directory approach and update the nightly workflow to commit files into `src/security-history/` instead of `public/`.
- Add `index.json` sibling endpoint `api/security/history.index.ts` with the same guard.
- Update `src/lib/security/history.ts` to fetch from the new endpoints and include the Supabase bearer token.
- DB: new migration adding `'security_viewer'` to the `app_role` enum, plus GRANT/policy notes; update `docs/security/security-memory.md` + `findings.accepted.json` in the same commit to satisfy the drift gate.

Tests:
- Unit test for `requireSecurityViewer` (allow admin, allow security_viewer, deny plain user, deny anon).
- Playwright negative test: unauthenticated GET of `/api/security/history/index.json` returns 401; authenticated non-admin returns 403.

## 4. README: one-command local rescan

Append a new "Security rescan (local)" section to `README.md` documenting:
- Command: `bun run security:rescan` (already wired to `scripts/security/rescan.mjs`).
- Prereqs: `bun install`, env vars if any.
- Output locations:
  - HTML report path
  - JSON artifacts path (post-RBAC: `src/security-history/`)
  - Drift report from `scripts/check-security-memory-drift.ts`
- How to view: local static serve command + link to the in-app `/security/findings-history` route.
- Note on nightly CI parity (`.github/workflows/security-nightly.yml`).

## Files touched

```text
NEW  tests/e2e/security-findings-history.spec.ts
NEW  tests/security/fingerprint.dedupe.regression.test.ts
NEW  src/lib/server-fns/security.functions.ts
NEW  src/routes/api/security/history.$runId.ts
NEW  src/routes/api/security/history.index.ts
NEW  supabase/migrations/<ts>_add_security_viewer_role.sql
MOVE src/routes/security.findings-history.tsx → src/routes/_authenticated/security.findings-history.tsx
EDIT src/lib/security/history.ts                  (fetch via API + bearer)
EDIT src/routes/security.tsx                      (conditional link)
EDIT .github/workflows/security-nightly.yml       (write to src/security-history/)
EDIT scripts/security/rescan.mjs                  (mirror output path)
EDIT docs/security/security-memory.md             (document new role + endpoints)
EDIT docs/security/findings.accepted.json         (drift-gate pair)
EDIT README.md                                    (new section)
```

## Out of scope

- Any UI redesign of the Findings History page.
- Changes to unrelated security memory entries.
- New scanners or rule authoring.
