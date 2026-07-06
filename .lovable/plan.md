# Security Memory Drift Guard + Nightly Full Re-scan

Three tracks, all additive. No product code touched.

## Track 1 — Security memory ↔ invariants/findings consistency test

New file: `tests/security/security-memory.consistency.test.ts` (vitest).

Inputs it reads at test time:
- `docs/security/security-memory.md` (canonical source; if the memory currently lives only in the security-memory tool, we mirror it into this file — see Track 2)
- `tests/security/__fixtures__/rls.expected.json` (existing RLS baseline)
- `docs/security/findings-2026-06-12.md` + a new `docs/security/findings.accepted.json` machine-readable list of `{scanner, internal_id, status: "accepted"|"fixed"|"ignored", reason}` derived from the latest scan

Assertions:
1. Every table named in `security-memory.md` under an "intentionally public / owner-only / no-write" section exists in `rls.expected.json` with a matching invariant shape (e.g. memory says "profiles is owner-only" → fixture must list `profiles_self_read` and not a broad `_authenticated_read`).
2. Every finding the memory calls out as `ACCEPTED` or `IGNORED` appears in `findings.accepted.json` with the same status and a non-empty reason.
3. Reverse direction: every `accepted`/`ignored` entry in `findings.accepted.json` must be mentioned by `internal_id` (or scanner+resource key) in `security-memory.md`. Catches "silently ignored" findings.
4. Structural: memory contains required sections (`## Access model`, `## What should never happen`, `## Accepted risks`). Missing section fails.

Test skips gracefully (with a clear message, not silently) only if the memory file is absent — never on CI.

## Track 2 — CI drift gate

New workflow job in `.github/workflows/tests.yml` (added to existing `checks` job, no new workflow file):

```
- name: Security memory drift gate
  run: bun run test tests/security/security-memory.consistency.test.ts
```

Additionally, a path-scoped guard in the same job:

```
- name: Require paired updates when security memory changes
  run: bun scripts/check-security-memory-drift.ts
```

New script `scripts/check-security-memory-drift.ts`:
- Uses `git diff --name-only origin/${{ github.base_ref || 'main' }}...HEAD` (falls back to `HEAD~1` on push).
- If `docs/security/security-memory.md` is in the diff, require that at least one of these is also in the diff:
  - `tests/security/__fixtures__/rls.expected.json`
  - `docs/security/findings.accepted.json`
  - a new file under `supabase/migrations/`
- Otherwise exit non-zero with a message pointing to the missing artifact.
- Symmetric check: if `findings.accepted.json` changes, `security-memory.md` must change too.

Mirror step (one-time, part of this track): export the current security-memory content into `docs/security/security-memory.md` so the file is the source of truth the tests + gate can read. Future updates via `security--update_memory` will be paired with an edit to this file (documented in `docs/security/README.md`).

## Track 3 — Nightly full security re-scan + artifacts

New workflow `.github/workflows/security-nightly.yml`:

```text
name: security-nightly
on:
  schedule: [{ cron: "0 3 * * *" }]   # 03:00 UTC daily
  workflow_dispatch:
jobs:
  full-rescan:
    runs-on: ubuntu-latest
    steps:
      - checkout + bun setup + install
      - Run Supabase linter CLI against project (bunx supabase db lint ... using E2E_SUPABASE_* secrets), write JSON to reports/supabase-lint.json
      - Run RLS invariants test → JUnit XML in reports/
      - Run dependency scan (bun run scripts/dep-scan.ts if present, else `bunx audit-ci --config .audit-ci.json`) → reports/deps.json
      - Fetch connector scan (Wiz) results via the workspace-configured connector output artifact if exposed as a repo secret WIZ_REPORT_URL; otherwise emit a placeholder note (Wiz scans run workspace-wide and are viewed in Security tab — this step just records the timestamp + last-known digest).
      - Render an HTML index: scripts/render-security-report.ts consumes reports/*.json and writes reports/index.html (simple template, no framework).
      - actions/upload-artifact@v4: name=security-nightly-<date>, path=reports/, retention-days=30
      - On any hard failure (linter error, new HIGH finding not in findings.accepted.json), open/refresh a GitHub issue titled "Nightly security scan: new findings YYYY-MM-DD" with the delta.
```

The existing `security-regression.yml` stays as-is (PR-scoped RLS invariants); this new workflow is the broad nightly.

## Out of scope
- Changing product code, RLS policies, or migrations.
- Auto-fixing new findings — nightly only surfaces them.
- Wiz API integration beyond recording status (Wiz is workspace-scoped, not per-project; results remain viewable in the Security tab).

## Verification
- Run the new consistency test locally: `bun run test tests/security/security-memory.consistency.test.ts` — passes against current fixtures.
- Simulate drift: temporarily edit `security-memory.md` without touching sibling files → `scripts/check-security-memory-drift.ts` exits 1.
- Trigger `security-nightly` via `workflow_dispatch` from a branch to confirm artifact upload.
