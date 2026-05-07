# Test hardening: import error UI, schema versioning, retry & migration

Four new automated test suites that lock in the recent /skills hardening work. No production code changes are required — the implementations (`classifyImportError`, `migrateLocalDataDump`, `LOCAL_DATA_DUMP_VERSION`, `ImportReviewDialog` retry/migration props, `stageFiles`/`applyStagedRows`) are already in place. We are adding the missing test coverage and one small UX polish to the dialog so the migration banner can be dismissed independently of cancel.

## 1. A11y tests for the enriched error UI

File: `src/components/__tests__/ImportReviewDialog.a11y.test.tsx` (new)

- Renders the dialog with `errors=[{ rule: "Safe text", hint: "Remove HTML…", … }]` and `onRetry`.
- Asserts:
  - The errors block has `role="alert"` (live announcement).
  - Each rule renders as visible chip text inside the alert.
  - Hint text is rendered and associated with the same alert region.
  - The retry button is reachable by Tab order, has accessible name "Pick a corrected file and retry", and triggers `onRetry` on Enter and Space.
  - When `migrationNotice` is set, a `role="status"` region is rendered (polite announcement) and is distinct from the alert.
- Uses `@testing-library/user-event` for keyboard interaction.

## 2. Schema-version unit tests for the local-data dump

File: `src/lib/__tests__/skills-drafts.test.ts` (extend existing)

Add a `describe("local data dump — schemaVersion")` block:

- `buildLocalDataDump({...})` always sets `schemaVersion: 1` (matches `LOCAL_DATA_DUMP_VERSION`), even when drafts/languages are empty.
- Round-trip: `parseLocalDataDump(JSON.parse(JSON.stringify(buildLocalDataDump(...))))` returns `{ ok: true, dump }` with `dump.schemaVersion === 1`.
- `migrateLocalDataDump` upgrades a v0 dump (no `schemaVersion`, has `personas[]` + `generatedAt`) → `{ migrated: true, fromVersion: 0, dump.schemaVersion: 1, notes: [/Upgraded snapshot/] }`.
- A dump with `schemaVersion: 99` returns `null` (newer than app).
- A dump already on v1 returns `{ migrated: false, fromVersion: 1 }` unchanged.

## 3. E2E retry-flow test

File: `src/lib/__tests__/skills-import-retry.e2e.test.tsx` (new)

Mirrors the existing `skills-import-e2e.test.tsx` harness:

- Stage one bad file (invalid JSON `"{not json"`) and one good file via the same `stage()` helper, but route the bad one through `classifyImportError` so it lands in `errors` instead of `rows`.
- Render `ImportReviewDialog` with `rows=[]`, `errors=[badFile]`, and an `onRetry` spy.
- Click the "Pick a corrected file and retry" button → assert `onRetry` called once.
- Simulate the parent re-staging by re-rendering the dialog with `rows=[goodRow]`, `errors=[]`.
- Assert the alert region disappears, the staged row appears, and clicking "Apply 1 change" fires `onApply` with the corrected row.

## 4. Migration warning integration test

File: `src/lib/__tests__/skills-import-migration.test.tsx` (new)

- Build a v0 dump payload (omit `schemaVersion`, keep `generatedAt` + `personas`) and feed it through the same staging logic used by `stageFiles` (extracted helper or inline copy of the migration branch).
- Render `ImportReviewDialog` with the resulting rows, errors, and `migrationNotice="x.json: Upgraded snapshot from schemaVersion 0 to 1."`.
- Assert a `role="status"` region containing "Upgraded snapshot" is visible.
- Re-render with `migrationNotice={undefined}` (simulating retry / cancel cleanup that `applyStagedRows` already does) and assert the status region is gone.
- Also assert that when a v1 file is staged, no `role="status"` region is rendered.

## Technical notes

- All tests run under existing `vitest` + `jsdom` config; no new deps required (`@testing-library/user-event` is already used elsewhere — verify in `package.json` before running and add via `bun add -d @testing-library/user-event` if missing).
- No changes to `ImportReviewDialog.tsx` behaviour — only test additions. If `package.json` lacks `user-event`, the a11y test will fall back to `fireEvent.keyDown` for Enter/Space.
- Final verification: `bunx vitest run` → expect previous 173 + ~15 new tests passing.
