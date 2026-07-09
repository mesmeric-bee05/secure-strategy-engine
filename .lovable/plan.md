## Goals

1. Make the security-memory drift gate self-explanatory in PRs.
2. Give a browsable Findings History page in the app.
3. Stabilise finding identity so nightly re-scans stop re-reporting the same issue.
4. One local command to reproduce the nightly security run end-to-end.
5. Schedule the nightly full re-scan and publish HTML+JSON artifacts.
6. Lock in the new JWT-authenticated edge-function contract with tests + build-time guards.

---

## 1. Drift-gate PR comments

Extend `scripts/check-security-memory-drift.ts` so, on failure, it writes a structured markdown report to `drift-report.md` containing:

- Changed keys in `docs/security/security-memory.md` (diff of headings + bullets, computed from `git diff`).
- Which RLS invariants (`tests/security/__fixtures__/rls.expected.json`) or accepted findings (`docs/security/findings.accepted.json`) were expected to change but didn't.
- Which of the three "paired" files DID change vs which are missing.

Add a new job step in `.github/workflows/security-regression.yml` (and `tests.yml` where drift runs) that, on `pull_request` events when the drift script exits non-zero, posts/updates a sticky PR comment via `actions/github-script` using `drift-report.md`. Uses the built-in `GITHUB_TOKEN`; no extra secrets.

## 2. Findings History page

New route `src/routes/security.findings-history.tsx` (child of the existing `/security` layout tab bar):

- Lists the last N nightly runs (default 30) read from a new JSON index `public/security/history/index.json`.
- Each run row expands into a table with columns: fingerprint, scanner, resource, severity, status (`accepted`, `ignored`, `new`, `resolved`), first-seen, last-seen.
- Side-by-side diff between two selected runs (checkbox picker) using the fingerprint as join key.
- Client-only route, no server calls; artifacts loaded via `fetch('/security/history/<run>.json')`.

Ships with a small `SecurityFindingsHistory` component + `src/lib/security/history.ts` loader with a Zod schema. Route is gated behind `has_role('admin')` via the existing `_authenticated` guard pattern.

## 3. Stable fingerprinting + de-duplication

Add `scripts/security/fingerprint.ts` exporting `fingerprintFinding(f)` returning a SHA-256 of a canonical tuple: `scanner|internal_id|resource|rule|severity`. Rules:

- Normalise whitespace, lowercase resource identifiers.
- Prefer `internal_id` when present; otherwise fall back to `rule + resource + evidence hash`.

Update `scripts/render-security-report.ts` to:

- Compute `fingerprint` for every finding.
- Load the prior run (`public/security/history/latest.json`) and mark each finding as `new`, `recurring`, `accepted`, or `ignored`.
- Emit two artifacts: `report-<date>.html` and `report-<date>.json` (with fingerprints), plus update `latest.json` and append to `index.json`.
- Fail the nightly test job only when `new` findings appear (not on `recurring`).

## 4. One-command local workflow

Add `scripts/security/rescan.mjs` and a `package.json` script `"security:rescan"` that runs, in order:

1. `bun run tsgo` (type gate for scripts).
2. `vitest run tests/security` (RLS invariants + memory consistency).
3. `bun scripts/security/collect.ts` (calls the security scanner API where available, otherwise loads `docs/security/findings-*.md` + `findings.accepted.json` as inputs).
4. `bun scripts/render-security-report.ts` to produce HTML+JSON under `./.security-out/`.
5. Prints a summary table (new / recurring / accepted / ignored counts).

Documented in `docs/security/README.md` with the exact command `bun run security:rescan`.

## 5. Nightly workflow + artifacts

Update `.github/workflows/security-nightly.yml`:

- Schedule already at 03:00 UTC; keep it.
- Run `bun run security:rescan` (single entry point — matches #4).
- Upload `./.security-out/` as an artifact named `security-nightly-<run_id>` with 30-day retention.
- Commit the new `public/security/history/*.json` files back to the repo on `main` via a bot commit step (so the Findings History page has data). Uses `peter-evans/create-pull-request` to avoid direct pushes.
- On new (non-recurring) findings, open/update a tracking issue with the same fingerprint list.

## 6. MatchExplanation auth contract

**Integration test** — `src/components/__tests__/MatchExplanation.auth.test.tsx`:

- Mocks `supabase.auth.getSession` to return a session with `access_token = "test-jwt"`.
- Mocks `fetch`; asserts the request Authorization header equals `Bearer test-jwt` and `apikey` equals the publishable key.
- Second case: no session → toast "Please sign in…" and no fetch call.

**Build-time FN_URL validation**:

- Extract the URL into `src/lib/ai/endpoints.ts` with a Zod check on `import.meta.env.VITE_SUPABASE_URL` (non-empty https). Throws at module load with a clear message if missing.
- `MatchExplanation.tsx` imports the resolved URL from that module.
- Vitest `src/lib/ai/__tests__/endpoints.test.ts` covers empty/malformed env cases.

**Edge-function regression tests** — `supabase/functions/_shared/auth_test.ts` and per-function `*_auth_test.ts` (Deno test):

- Unauthenticated request (no `Authorization`) → 401 `missing_authorization`.
- Invalid bearer → 401 `invalid_token`.
- Rate limit keying: two requests with different IPs but the same user id share the same bucket; two different user ids do not. Verified by mocking `checkLimit` to record the `identifier` argument and asserting it starts with `u:<userId>`.

CI: add a job step running `deno test supabase/functions/_shared supabase/functions/extract-skills-multimodal supabase/functions/match-explanation` in `tests.yml`.

---

## Technical details

**Files created**
- `scripts/security/fingerprint.ts`
- `scripts/security/collect.ts`
- `scripts/security/rescan.mjs`
- `src/routes/security.findings-history.tsx`
- `src/lib/security/history.ts`
- `src/lib/ai/endpoints.ts`
- `src/lib/ai/__tests__/endpoints.test.ts`
- `src/components/__tests__/MatchExplanation.auth.test.tsx`
- `supabase/functions/_shared/auth_test.ts`
- `supabase/functions/extract-skills-multimodal/index_auth_test.ts`
- `supabase/functions/match-explanation/index_auth_test.ts`
- `public/security/history/index.json` (seed with current baseline)

**Files modified**
- `scripts/check-security-memory-drift.ts` (emit `drift-report.md`)
- `scripts/render-security-report.ts` (fingerprint + diff vs prior run)
- `src/components/MatchExplanation.tsx` (use `endpoints.ts`)
- `src/routes/security.tsx` (add "Findings history" tab)
- `.github/workflows/security-regression.yml` (drift PR comment step)
- `.github/workflows/security-nightly.yml` (rescan + artifact upload + history commit)
- `.github/workflows/tests.yml` (add deno test job)
- `package.json` (`security:rescan` script)
- `docs/security/README.md` (document the local command)

**Out of scope**
- Changing which findings are accepted/ignored.
- Any RLS policy or Supabase function change (invariants stay identical; only the tooling around them changes).
- Redesigning the existing `/security` page — the new page is an added tab.

**Verification**
- `bun run security:rescan` locally produces `.security-out/report-*.html` with zero `new` findings.
- Vitest suites (RLS invariants, memory consistency, endpoints, MatchExplanation.auth) all pass.
- `deno test` in the three edge-function paths passes.
- Simulated PR that edits `security-memory.md` alone triggers the drift gate and posts the PR comment with the changed-keys list.
