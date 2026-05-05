## Goal

Finish the Skills hardening pass: wire the unfinished UI pieces into `src/routes/skills.tsx`, broaden audit-log coverage, give multi-file imports a sensible default action with a clearly-exposed per-persona toggle, and add the missing unit + integration tests.

## 1. Wire pending pieces into `src/routes/skills.tsx`

Already mounted: `StorageCapabilityNotice`, `SkillsAuditLog`, `SkillsPrivacyCard`, single-file import.

To finish:

- **Multi-file import via `ImportReviewDialog`**
  - Change the hidden `<input type="file">` to `multiple`.
  - On change, parse each file independently with `parseImport()` inside a try/catch and stage results into `StagedRow[]` (one row per persona slug per file).
  - Read each file as text first; reject any file whose `file.type` is set and is not `application/json` / `text/*`, or whose first 1KB contains NUL bytes (defence against "rename .png to .json"). Failed files become `FileError` entries.
  - Open `<ImportReviewDialog open rows errors onApply onCancel/>`.
  - On apply: merge rows whose `action !== "keep"` into `draftMap` / `langMap`, respecting `overwrite` (replace) vs `append` (concatenate with `\n\n` separator, capped at 20,000 chars; if cap hit, log `import_rejected` and skip that row).

- **"Download my local data" button**
  - Add a button next to Export labelled "Download my data". Calls `buildLocalDataDump({ drafts, languages, savedSnapshot })` then triggers a download via `localDataFilename()`. Emits a `data_download` audit event (`kind: "data_download"`, summary `Downloaded local data snapshot`, detail `{ filename, bytes, slugCount }`). Errors emit `privacy_blocked` if it was a Storage/SecurityError, otherwise show toast only.

- **Storage banner already mounted** — keep existing wiring; verify that `aria-live="assertive"` mounts above the editor and that the `onProbe` callback already logs `quota_blocked` / `privacy_blocked` (it does — leave as is).

## 2. Smart per-persona conflict defaults

Add `pickDefaultAction(current, incomingText, currentText, incomingExportedAt?, currentSavedAtMap?)` to `src/lib/skills-drafts.ts`:

- If `currentText.trim() === ""` → `overwrite` (no conflict).
- If `incomingText.trim() === currentText.trim()` → `keep` (identical content, nothing to do).
- If we can determine an "incoming is newer" timestamp (`exportedAt` from the file vs. last-saved-at recorded per slug) → `overwrite`.
- Otherwise → `keep` (safe default; user must opt in).

Use this in the staging step so each `StagedRow.action` arrives at the dialog pre-set. Keep the per-row Keep / Overwrite / Append radio group fully visible (existing UI in `ImportReviewDialog`) and add a small "Default chosen for you" caption below rows whose action was auto-picked.

To support "incoming is newer": persist a tiny `talentgraph:skills:saved-at-by-persona` map of `{ slug: ISO }` written each time `useDebouncedLocalStorage` flips to `saved`. Read in the import handler.

## 3. Broader audit-log coverage

Emit `appendAuditEvent(...)` from every relevant code path. Each call MUST set `kind`, derive `scope` automatically (the helper already does), and include an ISO `at` (the helper already sets it).

| Path | kind | When |
|---|---|---|
| Successful single/multi import | `import` | after merge applied |
| Any rejected file (parse / schema / safe-text / size / non-text MIME) | `import_rejected` | per file |
| Append-cap overflow | `import_rejected` | per skipped row |
| Export button | `export` | already in place |
| Download my data | `data_download` | new |
| Storage probe failure | `quota_blocked` / `privacy_blocked` | already in place |
| `useDebouncedLocalStorage` quota error after retry exhaustion | `quota_blocked` | NEW — surface a callback `onPersistError(reason)` from the hook and emit on the route |
| `appendAuditEvent` itself falls back to memory | scope `"memory"` already tagged on the event | no new call needed |

## 4. End-to-end safe-text integration test

New `src/lib/__tests__/skills-import-integration.test.ts` simulates the real pipeline:

1. Build a `File` from a JSON string containing `<script>alert(1)</script>` inside `drafts.sarah`. Read via `file.text()` → `JSON.parse` → `parseImport()` → expect throw → `friendlyImportError()` returns `Invalid backup: contains HTML/JS-like content`.
2. Same with `\u0000` bytes (control chars).
3. Same with a binary payload (`new File([new Uint8Array([0,1,2,...])])`) — parse must throw before reaching the schema (JSON.parse fails with SyntaxError → friendly message).
4. Happy-path JSON merges into a fake `Storage` object and asserts the persisted JSON contains the imported text.

## 5. Unit tests

- `src/lib/__tests__/storage-capability.test.ts`
  - `missing` when `pickStorage` returns null (mock `window` undefined via `vi.stubGlobal`).
  - `denied` when `setItem` throws `SecurityError`.
  - `quota` (small fails) and `nearQuota` (small ok, large fails) via `vi.spyOn(Storage.prototype, "setItem")`.

- `src/lib/__tests__/skills-audit.test.ts`
  - `appendAuditEvent` writes to `localStorage`, sets `at` to a valid ISO, defaults `scope` to `"localStorage"`.
  - When `setItem` throws, scope flips to `"memory"` and the event still appears in `readAuditLog()`.
  - `clearAuditLog()` empties both persisted + in-memory buffers and dispatches the custom event.
  - FIFO eviction at `MAX_ENTRIES`.

- Extend `src/lib/__tests__/skills-drafts.test.ts` with cases for `pickDefaultAction` and updated `assertSafeText` matrix (control chars, `<svg onload=…>`, `javascript:` URLs).

## 6. Run + verify

Run `bunx vitest run` once after wiring + tests to confirm all suites pass. Fix any regressions (most likely: hook signature change for the new `onPersistError` callback).

## Files

**Edit**
- `src/routes/skills.tsx` — multi-file import, Download my data button, persist `saved-at` map, hook into `onPersistError`.
- `src/lib/skills-drafts.ts` — add `pickDefaultAction`.
- `src/hooks/useDebouncedLocalStorage.ts` — add optional `onPersistError(reason)` callback.
- `src/components/ImportReviewDialog.tsx` — add "Default chosen for you" caption when row was auto-picked.

**Create**
- `src/lib/__tests__/storage-capability.test.ts`
- `src/lib/__tests__/skills-audit.test.ts`
- `src/lib/__tests__/skills-import-integration.test.ts`

No DB / server / dependency changes; all work is client-side under `/skills`.
