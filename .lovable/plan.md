
## Goal

Strengthen the `/skills` page with a security/privacy checklist, power-user keyboard shortcuts, hardened import validation, a "drafts restored" banner, and a mobile-friendly persona selector — while keeping accessibility, persistence, and the elite dark UI from the v3 spec consistent.

The shared `bash.docx` (TalentGraph v3 elite spec) confirms the design tokens and layout intent we're building toward: dark `--bg #07080C`, gold `#F5A623` accents, Syne/DM Sans typography, mono details (`JetBrains Mono`), pulse + radio-style chips. All visuals stay aligned with the existing token system already wired in `src/styles.css` and the `AppShell`.

---

## 1) Hardened import (parseImport in `src/lib/skills-drafts.ts`)

**Problem:** `DraftExportSchema` currently uses `z.record(z.string(), z.string())` which Zod accepts for plain objects — but a malicious or malformed file with `null`, arrays, nested objects under `drafts`/`languages`, or non-string slug keys can still slip through unexpected shapes (e.g. `drafts: ["a","b"]` becomes object-like in some flows). Tighten:

- Replace `DraftExportSchema` with explicit guards:
  - `drafts`: `z.record(z.string().min(1).max(64), z.string().max(20_000))` plus a custom `.refine` ensuring the parsed value is a **plain object** (`Object.getPrototypeOf(v) === Object.prototype`) — rejects arrays/`Map`/class instances even when they coerce.
  - `languages`: same plain-object refinement, value is `z.string().max(16)`.
  - Top-level: `.strict()` so unknown sibling keys (e.g. `__proto__`, `constructor`) are rejected outright; explicitly strip prototype-pollution keys before validation.
- `parseImport` returns a **typed error result** (`{ ok: false, reason: "version" | "shape" | "json" | "unknown", message }`) **OR** continues to throw `ZodError` — to keep diff small, keep throwing and add a `friendlyImportError(e)` helper that returns a single human-readable string for toast use.
- Skip slug keys whose value is empty after trim (don't pollute storage with empty drafts).

**Caller change in `src/routes/skills.tsx`:** swap the `catch` block in `handleImportFile` to use `friendlyImportError(e)` so toasts say things like:
- `"Invalid backup: drafts must be an object of slug → text"`
- `"Invalid backup: file is not valid JSON"`
- `"Backup version 2 is not supported (expected version 1)"`

## 2) Drafts-restored banner

Add a dismissible info banner at the top of `/skills` (above the input grid) that announces when drafts were rehydrated from `localStorage` on mount:

- New component `src/components/RestoredBanner.tsx`:
  - Props: `count: number`, `onDismiss: () => void`.
  - `role="status"`, `aria-live="polite"` so screen readers hear "N drafts restored from this browser" once on mount.
  - Gold-accent pill style matching the v3 design (`border-gold-glow bg-gold-soft text-gold`), close button with `aria-label="Dismiss restored drafts notice"`.
  - Auto-dismiss timer **disabled** — explicit user dismissal only, per the request.
- In `SkillsPage`:
  - Compute `restoredCount` once at mount from the initial `draftMap` (count of slugs with non-empty trimmed text). Use a `useRef`+`useState` so the count is captured **before** the user starts typing.
  - Persist dismissal in `sessionStorage` under `talentgraph:skills:restored-banner-dismissed` so it doesn't reappear when navigating between pages in the same session, but does come back after a fresh tab.

## 3) Keyboard shortcuts + visible legend

Add a `useSkillsHotkeys` hook (inline in `skills.tsx` or split to `src/hooks/useSkillsHotkeys.ts`):

- **Ctrl/Cmd+S** → triggers `handleExport()` (and `e.preventDefault()` to suppress browser save).
- **Ctrl/Cmd+I** → opens the import file picker (`importInputRef.current?.click()`).
- **Alt+ArrowRight / Alt+ArrowLeft** → switches to next/previous persona (wraps), reusing `switchPersona()`. This works regardless of focus, unlike the existing radiogroup arrow nav which only works when a persona chip is focused.
- All handlers ignore events whose target is inside the textarea **only for Alt+arrows would interfere with caret-jump-by-word**; Ctrl/Cmd+S and Ctrl/Cmd+I always fire.
- Mac-friendly: detect `e.metaKey || e.ctrlKey`.
- Cleanup on unmount.

**Visible UI:** small `<KeyboardShortcutsLegend />` rendered as a collapsible `<details>` next to Export/Import. Defaults closed; uses `<kbd>` elements styled with the existing token palette. Inside `<details>` the `<summary>` reads "Keyboard shortcuts" so screen-reader users discover them. Also add an `aria-keyshortcuts` attribute to the Export, Import, and persona group for AT discoverability.

## 4) Security & privacy checklist section

A new collapsible card rendered below the OUTPUT column (or above the citations panel) titled **"Where your data lives"**. Plain-language, gold-accented, and links to actions the user can take.

- New component `src/components/SkillsPrivacyCard.tsx`. Static content, no network calls, no PII.
- Sections:
  1. **Stored on this device only** — drafts in `localStorage` (`talentgraph:skills:draft-by-persona`), language prefs (`talentgraph:skills:lang-by-persona`), banner dismissal in `sessionStorage`. Last-error log is in `sessionStorage` and auto-expires after 24h (already implemented).
  2. **Sent to the server only when you click "Map to ISCO-08 / ESCO"** — text + language hint; nothing is sent automatically while typing.
  3. **What to do if saving fails** — quota tips: export your drafts first, then delete unused personas; clear the site's storage in browser DevTools; switch to incognito which has its own quota; if private mode blocks `localStorage`, your draft still works in-memory for the session but won't persist.
  4. **Audit trail** — server-side errors are appended to the immutable `audit_log` (already wired via `logClientError`).
- A "Copy storage report" button that copies a JSON payload to the clipboard listing the current keys and approximate byte sizes (helpful for support requests). Uses `navigator.clipboard.writeText` with a `sonner` toast confirmation and an `aria-live` announcement.

## 5) Small-screen UX polish

- **Persona selector**: switch the `flex flex-wrap gap-2` container to a horizontally-scrollable strip on `< sm`:
  - `flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 sm:flex-wrap sm:overflow-visible`
  - Add `snap-start` to each chip and `flex-shrink-0` so chips never compress.
  - Keep keyboard navigation working (it already uses refs/focus, no DOM-position assumptions).
  - Add `aria-orientation="horizontal"` to the radiogroup on small screens (purely cosmetic for AT — it still works either way).
- **Saved/Unsaved indicator visibility while typing**: the `SavedIndicator` currently lives in the top toolbar which can scroll out of view on phones. Add a **sticky footer pill** inside the textarea card that always shows the current persona's status next to a small character count (`text.length / 4000`). Sticky via `sticky bottom-0 -mb-3 -mx-3` inside the rounded container — uses the existing `bg-bg-4` so it fades into the editor.
- The textarea's `border-t pt-2` action row already wraps; verify wrapping at 320px viewport via QA after implementation. No layout-blocking change needed.

## 6) Tests (Vitest)

- `src/lib/__tests__/skills-drafts.test.ts` — extend with cases for the hardened `parseImport`:
  - Rejects `drafts: ["a"]` (array masquerading as record).
  - Rejects `drafts: { sarah: 123 }` (non-string value).
  - Rejects keys with prototype-pollution names (`__proto__`, `constructor`).
  - Rejects unknown top-level keys (`.strict()`).
  - `friendlyImportError` returns the expected human strings for each branch.
- `src/components/__tests__/RestoredBanner.test.tsx` — renders the count, dismissal callback fires, `role="status"` present.
- `src/hooks/__tests__/useSkillsHotkeys.test.ts` — fires on Ctrl+S, Cmd+I, Alt+ArrowRight; ignores Alt+arrow when target is inside a textarea; no-ops without modifier.

## 7) Files

**New**
- `src/components/RestoredBanner.tsx`
- `src/components/SkillsPrivacyCard.tsx`
- `src/hooks/useSkillsHotkeys.ts`
- `src/components/__tests__/RestoredBanner.test.tsx`
- `src/hooks/__tests__/useSkillsHotkeys.test.ts`

**Edited**
- `src/lib/skills-drafts.ts` — harden `DraftExportSchema`, add `friendlyImportError`, prototype-pollution stripping.
- `src/routes/skills.tsx` — wire banner, hotkeys, privacy card, sticky `SavedIndicator`, scrollable persona strip; replace toast text in import catch with `friendlyImportError`.
- `src/lib/__tests__/skills-drafts.test.ts` — extra cases.

## Out of scope

- No backend changes (no new server functions, no migrations).
- No changes to `/opportunities`, the audit pipeline, or `useDebouncedLocalStorage`.
- No new external dependencies — all UI uses existing `lucide-react`, `sonner`, Tailwind tokens, and shadcn primitives.

## QA after implementation

1. `bunx tsc --noEmit` — clean.
2. `bunx vitest run` — all suites pass (target ≥ 50 tests with the new ones).
3. Manual hotkeys check: Ctrl/Cmd+S exports, Ctrl/Cmd+I opens picker, Alt+→/← cycles personas (with confirm prompt when unsaved).
4. Resize preview to 375×812 — persona strip scrolls horizontally, sticky Saved pill stays visible.
5. Import a hand-crafted bad JSON file (`{"drafts":["x"]}`) — toast surfaces a friendly message, no crash.
