## Overview

Five enhancements to `/skills` and the persistence/error infrastructure, all building on the existing `draftMap` / `useDebouncedLocalStorage` / `last-error` modules. No schema or server-function changes — all client-side.

---

### 1. Per-persona "Saved/Unsaved" pill on each persona chip

**File**: `src/routes/skills.tsx` (persona quick-fill grid, ~lines 287–315)

- Reuse the existing `hasUnsavedChanges(slug)` helper (already implemented).
- For each persona chip, render a tiny status dot/badge:
  - **Empty draft** → no badge.
  - **Has draft, matches saved snapshot** → muted gold ✓ "Saved".
  - **Has unsaved diff vs `savedSnapshotRef.current[slug]`** → coral "•" with tooltip "Unsaved changes".
- Also cover the implicit `"default"` bucket via a small "Unsaved drafts: N" counter above the chip row when any non-active persona has pending edits — keeps the signal visible even when collapsed.
- Add `aria-label` describing state ("James — saved" / "James — unsaved changes") so the badge is announced.

### 2. Auto-retry persistence on `QuotaExceededError`

**File**: `src/hooks/useDebouncedLocalStorage.ts`

- After a write throws `QuotaExceededError`, set `status = "error"` (current behaviour).
- Add a lightweight retry effect: when `value` changes *after* an error and the new serialized length is **shorter** than the failed length, immediately retry the write (bypassing the debounce). On success → `"saved"` and clear the error; on second failure → stay in `"error"`.
- Track `lastFailedLength` in a ref so we only retry when the user has actually freed space.
- Expose a manual `retry()` callback in the returned object for a future "Retry now" button (not wired into UI in this pass — kept minimal).

**File**: `src/routes/skills.tsx`

- Update `SavedIndicator` to surface "Auto-retrying…" briefly when a retry is in flight (new `"retrying"` status added to `PersistStatus`).

### 3. Full keyboard navigation for persona switching

**File**: `src/routes/skills.tsx`

- Wrap the persona chip row in a container with `role="radiogroup"` and `aria-label="Choose a persona to quick-fill"`.
- Each chip becomes `role="radio"` with `aria-checked` reflecting active state and `tabIndex={active ? 0 : -1}` (roving tabindex pattern).
- Keyboard handlers on the container:
  - `ArrowRight` / `ArrowDown` → move focus to next chip (wraps).
  - `ArrowLeft` / `ArrowUp` → previous chip (wraps).
  - `Home` / `End` → first / last chip.
  - `Enter` / `Space` → invoke `switchPersona(slug)` (already shows the unsaved-changes confirm dialog).
- Add a visible-on-focus instruction line: "Use arrow keys to navigate personas, Enter to select."  Hidden visually until the radiogroup receives focus; always present in the DOM as `sr-only` for screen readers.
- Manage focus via a `useRef` array of chip buttons; `requestAnimationFrame` to focus the newly active chip after state updates.

### 4. Export / Import per-persona drafts as JSON

**File**: `src/routes/skills.tsx` — add small toolbar above the textarea (next to `SavedIndicator`).

- **Export button**: builds `{ version: 1, exportedAt: ISO, drafts: draftMap, languages: langMap }`, creates a Blob and triggers download as `talentgraph-skills-drafts-YYYYMMDD.json` via a temporary `<a download>` link. Toast confirms.
- **Import button**: hidden `<input type="file" accept="application/json">`. On file pick:
  1. Validate with a Zod schema (`version === 1`, `drafts` is `Record<string,string>`, `languages` is `Record<string,SpeechLang>` — unknown languages dropped).
  2. Show a `window.confirm()` dialog summarizing how many drafts will be merged and whether they will overwrite existing personas.
  3. Merge on accept (new drafts win for matching keys), update both `draftMap` and `langMap`, then write `langMap` immediately and let the debounced hook persist `draftMap`.
  4. Toast success/failure; on schema failure, surface the Zod issue path in the toast.
- Both buttons get clear `aria-label`s and visible icons (`Download`, `Upload` from `lucide-react`).

### 5. Unit tests

**New / updated test files** under `src/`:

- **`src/routes/__tests__/skills-persistence.test.tsx`** (new, JSDOM)
  - Renders a minimal harness around the persona-draft state logic (extract the per-persona helpers into `src/lib/skills-drafts.ts` so they're testable without mounting the full route — see "Refactor" below).
  - Verifies:
    1. Writing a draft for `sarah`, switching to `james`, writing another, and switching back restores `sarah`'s text.
    2. Legacy single-key draft (`talentgraph:skills:draft`) migrates to `{ default: ... }` on first read.
    3. `hasUnsavedChanges` returns `true` after edit and `false` after the snapshot updates.

- **`src/routes/__tests__/skills-confirm.test.tsx`** (new)
  - Mocks `window.confirm` to return `false` and asserts that `switchPersona` does **not** mutate state when the user cancels.
  - Mocks `window.confirm` to return `true` and asserts the persona changes and the previous draft is preserved (not cleared).

- **`src/components/__tests__/LastErrorPanel.test.tsx`** (new)
  - Seeds `sessionStorage` with a record dated 25h ago.
  - Renders `<LastErrorPanel />` and asserts:
    1. The "Expired" badge is in the document.
    2. The container has `role="status"` (not `"alert"`) and `aria-live="off"`.
    3. The message text appears with the muted styling class.
  - Second test: fresh record (just now) → `role="alert"`, no "Expired" badge.

- **`src/hooks/__tests__/useDebouncedLocalStorage.test.ts`** (new)
  - Uses fake timers + a `Storage` mock that throws `QuotaExceededError` on the first call and succeeds on the second.
  - Verifies status transitions: `idle → saving → error → (value shrinks) → retrying → saved`.

**Refactor for testability**:
Move the pure helpers (`readJSONMap`, `hasUnsavedChanges` predicate over a pair of maps, `parseImport` Zod schema) into `src/lib/skills-drafts.ts`. The route imports them; tests import them directly. This avoids needing to spin up the TanStack Router shell in tests.

---

## Files touched

- **Edited**: `src/routes/skills.tsx`, `src/hooks/useDebouncedLocalStorage.ts`
- **Created**: `src/lib/skills-drafts.ts`, `src/routes/__tests__/skills-persistence.test.tsx`, `src/routes/__tests__/skills-confirm.test.tsx`, `src/components/__tests__/LastErrorPanel.test.tsx`, `src/hooks/__tests__/useDebouncedLocalStorage.test.ts`

## Verification

- `bunx tsc --noEmit` clean.
- `bunx vitest run` — all existing 24 tests still pass plus ~10 new tests.
- Manual smoke: switch personas with keyboard only, fill quota by pasting a giant string then deleting, export/import round-trip.

## Out of scope (explicitly)

- Server-side draft sync (still localStorage only).
- Cross-device draft restore.
- Conflict-resolution UI on import beyond "merge, new wins" — kept simple per request.
