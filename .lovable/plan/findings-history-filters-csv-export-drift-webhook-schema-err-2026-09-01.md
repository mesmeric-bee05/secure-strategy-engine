# Findings History: filters, CSV export, drift webhook, schema-error UI, caching

## What you get

1. **Filters + pagination** on Security → Findings History
   - Run picker filter (search by run id / date range narrowing of the runs table).
   - Status filter chips: new, recurring, accepted, ignored, resolved (multi-select) applied to the diff rows.
   - Category filter: scanner (e.g. rls, deps, wiz) plus severity dropdown, derived from the loaded runs.
   - Free-text search across rule, internal_id and resource.
   - Pagination for both the runs table and the diff table (page size 25/50/100, prev/next, "showing X–Y of Z"). Filter/page state lives in the URL search params so a filtered view is shareable and survives reload.

2. **Download CSV**
   - Button above the diff table exports the *currently filtered* rows: fingerprint, scanner, rule, internal_id, resource, severity, run A status, run B status, firstSeen, lastSeen, transition (new/resolved/unchanged).
   - Client-side generation, RFC-4180 quoting, formula-injection guard (leading `=`/`+`/`-`/`@` prefixed with `'`), filename `findings-<runA>-vs-<runB>.csv`.
   - Export is audited like page views (action `security_history_csv_export`, with row count only — never finding contents).

3. **Drift-gate webhook notification**
   - When the drift gate fails, post a Slack-compatible JSON payload (blocks + fallback `text`) to a configurable webhook URL.
   - Payload: repo, run id, PR number, **drift score** (count of drifted files + changed keys), the list of drifted files with reasons, and links to the workflow run, the artifact, and the PR diff.
   - Configuration: optional repo secret `SECURITY_DRIFT_WEBHOOK_URL`. Absent secret = notification silently skipped (gate still fails). No secret is ever echoed into logs or the report.
   - Also posts on recovery (gate passing after a previous failure in the same PR) so the channel doesn't stay noisy.

4. **Friendly runtime schema-validation UI**
   - When an artifact fails the shared Zod schema at fetch time, the page no longer throws: the offending run is marked invalid and rendered as an inline card listing each violation as a **JSON pointer** (`/findings/12/severity`) with the message and the received type.
   - Other selected runs keep rendering; the diff area explains that comparison needs two valid runs.
   - Same treatment for `index.json`: invalid entries are skipped with a warning banner instead of blanking the page.

5. **ETag / conditional requests for `/api/security/history/$file`**
   - Response gets a strong `ETag` (SHA-256 of the artifact bytes, computed once per bundled file) and `Cache-Control: private, no-cache, must-revalidate`.
   - `If-None-Match` match returns `304` with the ETag and no body — after the same RBAC check, so a stale token or a demoted user still gets 401/403.
   - Audit still records every request, with outcome `granted_304` for cache hits.
   - Client loader sends the cached ETag and serves the in-memory copy on 304.

## Technical notes

- `src/routes/security.findings-history.tsx`: add `validateSearch` (zod + `fallback`) for `status`, `scanner`, `severity`, `q`, `page`, `pageSize`, `runA`, `runB`; derive filtered/paged rows with `useMemo`; extract `FiltersBar`, `Pagination`, `SchemaErrorCard` components.
- `src/lib/security/history.ts`: return a discriminated result (`{ ok: true, run }` | `{ ok: false, issues }`) instead of throwing on schema failure; add JSON-pointer formatting to `history-schema.ts` (`issuesToPointers`) and an ETag-aware fetch cache.
- `src/lib/security/csv.ts` (new): typed CSV serializer + injection escaping, unit-tested.
- `src/routes/api/security/history.$file.ts`: precompute ETags for the `import.meta.glob` map; handle `If-None-Match`; extend `ArtifactOutcome` with `granted_304`.
- `scripts/security/notify-drift.ts` (new): reads `reports/security-memory-drift.md` + a new machine-readable `reports/security-memory-drift.json` emitted by `check-security-memory-drift.ts`, computes the drift score, posts the webhook. Wired into `.github/workflows/security-memory-drift.yml` after the PR comment step.
- Tests: CSV serializer unit tests, filter/pagination + schema-error rendering tests for the page, ETag/304 + RBAC-before-304 tests in `tests/security/history-endpoint.rbac.test.ts`, drift-payload shape test for the notifier, and an E2E pass asserting filter chips narrow rows and the CSV download fires.
