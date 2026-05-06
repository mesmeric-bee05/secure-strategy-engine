## Goal

Four targeted improvements to the `/skills` import/export flow:

1. Versioned local-data dump for forward-compatible re-import.
2. Stronger HTML/JS rejection test coverage.
3. Verified accessibility of `ImportReviewDialog` (focus trap, Escape, ARIA).
4. "Apply to all" bulk conflict resolution in the dialog.

---

## 1. `schemaVersion` on the local-data dump

Edit `src/lib/skills-drafts.ts`:

- Add a top-level `schemaVersion: 1` field on `LocalDataDump` (alongside the existing nested `schema.version`). The flat field is what future migrators will branch on; the nested block stays for human readability.
- Bump `LOCAL_DATA_DUMP_VERSION = 1` constant exported from the module.
- Add a `parseLocalDataDump(input: unknown)` helper that:
  - Validates `schemaVersion` is a known number (currently only `1`).
  - Returns `{ ok: true, dump }` or `{ ok: false, reason: "unknown_schema_version" | "invalid_shape", got? }`.
  - Used by a future re-import path; ships now so snapshots taken today remain readable.
- Update `buildLocalDataDump` to set the new field.

Add tests in `src/lib/__tests__/skills-drafts.test.ts`:

- Dump includes `schemaVersion: 1`.
- `parseLocalDataDump` accepts the output of `buildLocalDataDump`.
- `parseLocalDataDump` rejects `{ schemaVersion: 99 }` with `unknown_schema_version`.
- `parseLocalDataDump` rejects non-object / missing-field payloads.

---

## 2. Harden safe-text import tests

Extend `src/lib/__tests__/skills-import-integration.test.ts` and `skills-drafts.test.ts` with explicit rejection cases — each must assert the import returns an error AND `localStorage` is untouched:

- `<iframe src="javascript:alert(1)">`
- `<img src=x onerror="alert(1)">`
- `<svg onload="alert(1)">...`
- `javascript:void(0)` URL inside text
- `data:text/html;base64,...` payload
- Bare event handler `onclick="x()"`
- Mixed-case `<ScRiPt>` tag
- Whitespace-padded `<  script  >` tag (regex already uses `\s*`, lock it in)
- NUL byte mid-string (`"hi\u0000there"`)
- Vertical tab `\u000B` and form feed `\u000C`
- Oversized payload: 20_001-char string → SafeTextError
- Non-string draft value (e.g. `{ sarah: 123 }`) → schema rejection
- Array as `drafts` (`[]`) → `isPlainObject` rejection
- `__proto__` key in `drafts` is stripped, not honored

Each test asserts `friendlyImportError` returns a user-facing message that does not leak stack traces.

---

## 3. Verify `ImportReviewDialog` accessibility

The dialog already uses Radix `Dialog`, which provides focus trap and Escape-to-close. We confirm and lock this in with tests + small ARIA polish.

Edit `src/components/ImportReviewDialog.tsx`:

- Add `aria-describedby` linkage between `DialogContent` and the description.
- Ensure the per-row radiogroup has `aria-label` referencing the persona slug (already present — keep).
- Add `aria-live="polite"` to the "Apply N changes" footer count so screen readers hear updates as the user toggles actions.
- Ensure the Cancel button is the initial focus target (Radix default focuses first focusable; verify and add `autoFocus` only if needed after test).

Create `src/components/__tests__/ImportReviewDialog.test.tsx`:

- Renders with `role="dialog"` and accessible name "Review import".
- Pressing `Escape` triggers `onCancel`.
- Focus is trapped: tabbing past last button cycles to first.
- Each row's radiogroup exposes 3 `role="radio"` buttons with correct `aria-checked` toggling.
- Errors block renders with `role="alert"`.

---

## 4. "Apply to all" bulk conflict action

Edit `src/components/ImportReviewDialog.tsx`:

- Above the rows list (only when `staged.length > 1`), add a toolbar:
  - Label: "Apply to all:"
  - Three buttons: Keep all / Overwrite all / Append all.
  - Clicking sets every staged row's `action` to that value and clears `autoChosen`.
- Keep per-row controls fully functional (bulk action is a one-shot, rows remain individually editable afterwards).
- Toolbar buttons are keyboard-accessible (`<button type="button">`) and grouped under `role="group" aria-label="Apply the same action to all personas"`.

Add tests in `ImportReviewDialog.test.tsx`:

- Toolbar hidden when only 1 row is staged.
- Clicking "Overwrite all" sets every row's action to `overwrite` and the apply-count footer updates.
- Clicking "Keep all" disables the Apply button (count = 0).
- Per-row override still wins after a bulk click.

---

## Files

**Modified**
- `src/lib/skills-drafts.ts` — `schemaVersion`, `parseLocalDataDump`, `LOCAL_DATA_DUMP_VERSION`.
- `src/lib/__tests__/skills-drafts.test.ts` — dump version + parser tests.
- `src/lib/__tests__/skills-import-integration.test.ts` — expanded HTML/JS/binary rejection cases.
- `src/components/ImportReviewDialog.tsx` — bulk action toolbar, ARIA polish.

**Created**
- `src/components/__tests__/ImportReviewDialog.test.tsx` — a11y + bulk action tests.

No route wiring changes needed — `/skills` already passes through staged rows untouched. The new `parseLocalDataDump` is exported for future use; no UI surface yet.
