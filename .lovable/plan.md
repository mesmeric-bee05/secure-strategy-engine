# Findings History: filters, pagination, CSV — plus drift webhook and rescan verification

## 1. Filter bar, pagination, CSV button (buildable now)

On Security → Findings History, above the side-by-side comparison:

- **Filter bar**
  - Status chips (multi-select): new, recurring, accepted, ignored, resolved — a row matches if either side's status is selected.
  - Scanner dropdown and severity dropdown, options derived from the two loaded runs.
  - Transition chips: added / removed / unchanged (from `transitionOf`).
  - Free-text search across rule, internal_id, resource, fingerprint.
  - "Clear filters" button; live count ("showing X of Y findings") in an `aria-live="polite"` region.
- **Pagination** for the diff table: page size 25/50/100, prev/next, "showing X–Y of Z". The runs table gets the same control.
- **Download CSV** button that exports the *currently filtered* rows via the existing `src/lib/security/csv.ts` (fingerprint, scanner, rule, internal_id, resource, severity, status A, status B, firstSeen, lastSeen, transition). Filename `findings-<runA>-vs-<runB>.csv`. Disabled with an explanatory title when no rows match.
- Filter and page state lives in URL search params (`validateSearch` with zod + fallbacks) so a filtered view is shareable and survives reload.
- The CSV export is audited (row count only, never finding contents) alongside the existing page-view audit.

**Tests to add and run**
- Component tests: chips narrow rows, search matches, pagination boundaries, empty-result state.
- E2E in `tests/e2e/security-findings-history.spec.ts`: apply a status chip and assert only matching `diff-row-*` remain; click Download CSV, capture the download, assert header row and the filtered row count.

## 2. Drift webhook — needs one thing from you

`scripts/security/notify-drift.ts` and the workflow step already exist and read `SECURITY_DRIFT_WEBHOOK_URL`. Two limits I can't work around from here:

- The drift gate runs inside **GitHub Actions**, and the webhook URL must be added as a **repository secret** named `SECURITY_DRIFT_WEBHOOK_URL` in your GitHub repo settings. I have no access to your GitHub secrets, and this project's secret store isn't read by the CI job.
- I also can't confirm a message arrived in your Slack channel or inbox — only you can see that.

What I will do instead: run the notifier locally against a **mock endpoint** and show you the exact JSON payload it posts (drift score, run id, changed keys, artifact/diff links), plus a payload-shape test. Once you add the repo secret and open a PR that trips the gate, the real Slack post and artifact upload happen automatically.

## 3. Nightly rescan verification (partly local)

- Run `bun run security:rescan` locally: typecheck, security vitest suite, dependency audit, collect findings, render HTML/JSON, validate history artifacts. Report the new/recurring/accepted/ignored/resolved counts.
- If the run produces a new history artifact, confirm it appears in the runs table and that its findings render with the correct status badges (verified through the E2E/component path, since the live page requires an admin session in your browser).
- The *scheduled* nightly job itself runs on GitHub's cron; I can't trigger it. Its local equivalent above is what I'll verify.

## Technical notes

- `src/routes/security.findings-history.tsx`: add `validateSearch`, `useMemo`-derived filtered/paged rows, and extracted `FiltersBar` / `Pagination` / `CsvButton` components. Switch the loaders to `loadHistoryIndexResult` / `loadHistoryRunResult` so schema failures stay non-fatal.
- Reuse `toCsv`, `downloadCsv`, `safeFileToken` from `src/lib/security/csv.ts` and `transitionOf` from `src/lib/security/history.ts` — no new deps.
- Audit event `security_history_csv_export` added to the existing security audit path.

## Open item

Add `SECURITY_DRIFT_WEBHOOK_URL` as a GitHub repository secret (Settings → Secrets and variables → Actions). Tell me if you'd rather I wire the notifier to a different transport (e.g. email via a server route) that this app can own end to end.
