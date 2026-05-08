
# TalentGraph — Map, AI, UI Overhaul

GitHub Actions workflow running all suites is already live (`.github/workflows/tests.yml`). This plan covers the three remaining tracks, sequenced so each phase ships independently and tests stay green.

## Phase 1 — Geolocation map (`/opportunities/map`)

**Library:** `maplibre-gl` + OpenFreeMap vector tiles (`https://tiles.openfreemap.org/styles/liberty`). No API key, no secrets.

**New files:**
- `src/components/OpportunitiesMap.tsx` — MapLibre canvas, clustered GeoJSON source for opportunity pins, popup on click, "Use my location" toggle.
- `src/components/GeolocationConsent.tsx` — banner that requests `navigator.geolocation` only after explicit click; stores consent in `localStorage` (`tg.geo.consent.v1`).
- `src/lib/geo.ts` — haversine distance, bbox helpers, lat/lng zod schema, `withinRadiusKm`.
- `src/routes/opportunities.map.tsx` — new TanStack route with own `head()` metadata.
- `src/lib/__tests__/geo.test.ts` — distance + radius unit tests.
- `src/components/__tests__/GeolocationConsent.test.tsx` — consent gate (no auto-prompt, a11y label, focus on button).

**Edits:**
- `src/server/opportunities.functions.ts` — extend mock data with `lat`/`lng`/`city`/`countryCode`; add `listOpportunitiesNear({ lat, lng, radiusKm })` server fn.
- `src/routes/opportunities.tsx` — add a "Map view" `<Link to="/opportunities/map">` toggle.

**Privacy/security:**
- Geolocation only on user click; consent revocable from the same banner.
- User coordinates never sent to server — radius filter happens client-side.
- Tile URL pinned to OpenFreeMap; no third-party scripts.

## Phase 2 — AI enhancements (Lovable AI Gateway)

**New edge functions** (`supabase/functions/...`, `verify_jwt = true` by default):
- `extract-skills-multimodal/` — accepts `{ text?, imageBase64?, mimeType? }`, calls `google/gemini-2.5-pro` via gateway with **tool calling** (`extract_skills` schema: `skills[] { name, category, proficiency, evidence, marketRelevance }`). Returns parsed structured JSON. Handles 429/402 with explicit error JSON.
- `match-explanation/` — **streaming** SSE endpoint that explains "why this opportunity matches your profile"; uses `google/gemini-3-flash-preview` with `stream: true`. Follows the SSE pattern in `useful-context` (line-by-line parse, `[DONE]` handling).

**Shared helpers:**
- `supabase/functions/_shared/cors.ts`, `_shared/lovable-ai.ts` — gateway URL, auth header, error mapping.
- `supabase/functions/_shared/prompt-guard.ts` — port of existing `src/lib/security/prompt-guard.ts` for server-side prompt-injection screening before forwarding to the model.

**Frontend:**
- `src/lib/ai/extract-skills.ts` — typed client for the multimodal function (zod-validates response).
- `src/components/MatchExplanation.tsx` — streams tokens into a `<p aria-live="polite">`, abortable via `AbortController`, surfaces 429/402 toasts.
- `src/components/ImagePortfolioUpload.tsx` — file picker (jpg/png ≤ 4 MB), client-side resize to ≤ 1024 px, base64 encode; reuses existing `classifyImportError`-style enriched error UI for rejects.
- Wire `MatchExplanation` into `opportunities.tsx` opportunity cards (collapsible "Explain match"). Wire `ImagePortfolioUpload` into `skills.tsx` next to the existing text path.

**Tests:**
- `src/lib/ai/__tests__/extract-skills.test.ts` — mocks `fetch`, asserts request shape (tool definition), parses tool-call JSON, rejects schema violations.
- `src/components/__tests__/MatchExplanation.test.tsx` — feeds a fake SSE stream via mocked `ReadableStream`, asserts incremental token render and abort cleanup.
- `supabase/functions/extract-skills-multimodal/index.test.ts` — Deno test for prompt-guard rejection + 402/429 mapping.

**Security hardening (carried into the AI track):**
- All AI calls remain server-side; `LOVABLE_API_KEY` never reaches the client.
- Per-IP rate limiting reused from `src/lib/security/rate-limit.ts` inside both edge functions.
- Image uploads validated by mime + magic bytes (not just extension); strip EXIF before sending (client-side via `createImageBitmap` + canvas re-encode).
- CSP header in `public/_headers` extended to allow `https://tiles.openfreemap.org` and `blob:` for the map; AI gateway already same-origin via edge function.

## Phase 3 — UI/UX overhaul ("UNMAPPED" visual system)

Adopt the dark-gold aesthetic from `talentgraph_unmapped_v2-4.html`.

**Design tokens** in `src/styles.css`:
- Surfaces `--bg-0..4` (deep navy), borders `--border-0..2`, gold `--gold`/`--gold-2`/`--gold-glow`, accents teal/coral/lavender, text `--tx-0..2`.
- Fonts via `<link>` in `__root.tsx`: Sora (display), Space Mono (mono), DM Sans (body). Tailwind `@theme` block exposes `font-display`, `font-mono`, `font-body`.
- Gradient + shadow tokens (`--gradient-gold`, `--shadow-elegant`).

**Component refresh** (presentation-only; no logic changes):
- `Topbar.tsx`, `Sidebar.tsx`, `AppShell.tsx`, `PageHeader.tsx`, `Footer.tsx` — restyle with new tokens; sticky topbar with backdrop blur, gold logomark.
- `src/routes/index.tsx` — new landing hero ("UNMAPPED — find work that matches what you actually do"), 3-up feature cards, CTA to `/skills`.
- `src/components/ui/button.tsx` — add `premium` variant using `--gradient-gold`.
- All existing surfaces re-skinned via tokens (no per-component color literals).

**Route metadata:** distinct `head()` per route (`/`, `/skills`, `/opportunities`, `/opportunities/map`, `/readiness`, `/security`) with unique title/description/og.

**Accessibility:** maintain WCAG AA contrast on dark background (verified via `oklch` lightness of `--tx-0` vs `--bg-0`); keep all existing focus rings, role attributes, and the focus-management tests we already have.

## Sequencing & verification

1. Phase 1 lands first (smallest, isolated route). Run `bun run test` — expect existing 200+ tests + ~6 new geo/consent tests.
2. Phase 2 adds edge functions + AI clients. Run `bun run test` and `supabase--test_edge_functions`.
3. Phase 3 is presentation-only; run tests once more to confirm no regressions in a11y/focus/import suites.

## Out of scope (deliberately deferred)

- Blockchain/credential NFT issuance, Neo4j trust graph, WebAuthn passkeys, i18next multilingual — these are in the architecture doc but each is a multi-day track of its own; happy to plan them next once these three ship.

## Technical notes

- MapLibre is Worker-safe; no SSR concerns because the map component is dynamically rendered behind a `useEffect` mount guard.
- Edge functions use `verify_jwt = true` (default) so anonymous calls are blocked — frontend passes the Supabase session via `supabase.functions.invoke`.
- No new secrets required: `LOVABLE_API_KEY` is auto-provisioned, OpenFreeMap is keyless.
