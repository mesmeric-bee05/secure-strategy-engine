# Security Findings History: schema validation, RBAC tests, audit logging, richer E2E

Four hardening items on the nightly security-findings pipeline and its admin-only UI.

## 1. Schema validation for history artifacts (fails CI before rendering)

- Add a single shared schema module (`src/lib/security/history-schema.ts`) holding the Zod schemas for a run file (`runId`, `timestamp`, `totals`, `findings[]`) and for `index.json`, so the render script, the API route, and the client all validate the same shape.
- `scripts/render-security-report.ts` validates every generated run file plus the rewritten `index.json` before writing. On failure it prints the offending file, path, and message, and exits non-zero.
- Add `scripts/security/validate-history.ts` (wired as `bun run security:validate`) that walks `src/security-history/*.json` and validates all of them — run in the nightly workflow and in the regular checks job so a malformed committed artifact fails CI.
- Add a unit test covering: valid run passes, missing `runId` fails, bad `status` enum fails, non-numeric `totals` fails, malformed `index.json` fails.

## 2. Explicit RBAC rejection tests for `/api/security/history/$file`

Add `tests/security/history-endpoint.rbac.test.ts` that imports the route handler and exercises:

- no `Authorization` header → 401 with `WWW-Authenticate`
- malformed / non-Bearer header → 401
- valid token but `has_role(admin)` false → 403
- `has_role` RPC error → 403 (fail closed)
- admin token, unknown filename → 404
- admin token, path traversal (`../secret.json`, `foo.txt`) → 404, never a file read
- admin token, real file → 200 with `no-store` and `nosniff` headers

Supabase client is stubbed at module level so the test runs offline. Response bodies are asserted to never leak the reason for denial beyond `Forbidden`/`Unauthorized`.

## 3. Audit logging for page and artifact access

- Artifact route: after the role check resolves, log one `security_history_artifact_read` event via the existing append-only audit logger, with actor id, requested filename, outcome (`granted` / `denied_401` / `denied_403` / `not_found`), hashed IP + user agent, and server timestamp. Denials are logged too. Audit failure never changes the response.
- Page view: a `logSecurityHistoryView` server function (auth middleware, admin check) records `security_history_view` with actor id and timestamp; the Findings History route calls it once on mount.
- Both use `recordAudit`, so redaction and the immutable `audit_log` table apply unchanged. No finding contents are written into metadata — only counts and filenames.
- Add a test asserting the artifact route emits exactly one audit event per request with the right action and outcome for granted and denied paths.

## 4. Extend the Findings History E2E

Extend `tests/e2e/security-findings-history.spec.ts` to assert diff content rather than just label presence, using per-row scoping:

- the row for a recurring fingerprint shows `RECURRING` in both run columns
- the new fingerprint shows `Not present` in the older column and `NEW` in the newer column
- the resolved fingerprint shows `RECURRING` then `RESOLVED`
- accepted and ignored fingerprints keep their badge in both columns
- resource and severity text renders in the correct column
- run-table totals match the stubbed `totals` per run

To make rows addressable, the diff row gets a stable `data-testid` (fingerprint-based) and each status cell gets a `data-run` attribute — presentation-only additions to the existing component.

## Technical notes

- Files touched: `src/lib/security/history-schema.ts` (new), `src/lib/security/history.ts` (reuse shared schemas), `scripts/render-security-report.ts`, `scripts/security/validate-history.ts` (new), `src/routes/api/security/history.$file.ts`, `src/lib/server-fns/security.functions.ts`, `src/routes/security.findings-history.tsx`, `package.json` scripts, `.github/workflows/security-nightly.yml` + `tests.yml`, plus new tests under `tests/security/` and the existing E2E spec.
- No database migration is needed: `audit_log` and `recordAudit` already exist and writes go through the service role.
- Existing statuses (`new`, `recurring`, `accepted`, `ignored`, `resolved`) and the fingerprinting logic stay unchanged.
