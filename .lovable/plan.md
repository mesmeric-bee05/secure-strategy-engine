## Goal

Three coordinated workstreams driven by your uploads:

1. **Redesign** existing app surfaces to match the UNMAPPED v2 prototype's visual system.
2. **Build** the master phases/tech/security dashboard from `talentgraph_master_dashboard.html` as an in-app route.
3. **Extract** the architecture + bash docs into a structured roadmap (`docs/roadmap/`).

Scope is presentation + content. No backend, RLS, auth, or server-fn refactors. Existing test suite (256 passing) stays green.

---

## Track 1 — UNMAPPED v2 design system

Source of truth: `talentgraph_unmapped_v2-5.html` `:root` tokens + component CSS.

**Tokens → `src/styles.css` (@theme)**
- Surfaces: `--bg-0` `#060B16` → `--bg-4` `#1A2540`; borders 0/1/2.
- Accents: `--gold` `#E8A838` + `--gold-2` `#C88228`, `--teal` `#2DD4BF`, `--coral` `#F87171`, `--lavender` `#A78BFA`, `--emerald` `#34D399`, `--sky` `#38BDF8`.
- Text: `--tx-0` `#EDE8E0` / `--tx-1` `#8B9DC0` / `--tx-2` `#4A5578`.
- Radii: 4/8/12/16/20/24. Soft-glow shadows on gold/teal cards.
- Map shadcn semantic tokens (`--background`, `--card`, `--primary`, `--border`, `--muted`, `--accent`, etc.) onto the new palette via `@theme inline` so all existing components recolor without rewrites.

**Fonts — `src/routes/__root.tsx` `head()`**
- Add `<link>` for Sora (display), Space Mono (mono), DM Sans (body). No CSS `@import` of remote URLs.
- Define `--font-display`, `--font-mono`, `--font-body` in `@theme`. Apply Sora to `h1–h3`, DM Sans to body, Space Mono to numeric/metric runs.

**Global chrome**
- Body background: layered radial gradients (gold/teal/lavender at 5/4/3% opacity) over `--bg-0`, plus a fixed 48px grid pattern at 1.5% opacity (matches the prototype's `body::before` + `.gridpat`).
- Topbar: 52px, blurred `rgba(6,11,22,.92)`, gold gradient logo mark + Sora wordmark + "Unmapped" uppercase tag.
- Sidebar: 256px, `bg-1` panel, grouped sections with uppercase 9px labels.
- Reusable primitives in `src/components/ui-tg/`: `EcoStrip`, `StatCard`, `SectionHeader`, `PersonaCard`, `BadgeGold/Teal/Coral`, `CardGlow`, `PageEyebrow`.

**Pages redesigned in place** (markup/structure stays; classes swap to new tokens)
- AppShell / Topbar / Sidebar / Footer
- `/` (index hero + eco-strip)
- `/skills`, `/opportunities`, `/opportunities/map`, `/readiness`, `/security`, `/settings`, `/trust-graph`, `/credential/$id`
- LanguageSwitcher, PasskeyManager, MatchExplanation, OpportunitiesMap legend/popups, CitationsPanel, RestoredBanner, LastErrorPanel

No business-logic edits in those files — only className + small wrapper changes.

**Visual regression baselines**
- `tests/e2e/visual.spec.ts` snapshots will need regeneration once. Plan calls it out so CI failure on first run is expected; baselines updated in the same commit.

---

## Track 2 — Master build dashboard route

New route: `src/routes/dashboard.tsx` → `/dashboard` (public, SSR on, head metadata set).

Ports the 5 tabs from `talentgraph_master_dashboard.html`:
- **Phases** — collapsible phase cards (Discovery, Architecture, AI Pipeline, Security, Launch) with time chips and bullet body.
- **Tech Stack** — grouped badge grid (frontend/backend/AI/data/infra/blockchain) using badge color variants.
- **Features** — 6 feature cards mapped to existing routes (`/skills`, `/opportunities`, `/opportunities/map`, `/readiness`, `/security`, `/credential/$id`).
- **Security** — checklist with status icons; pulls live state from existing `tests/security/__fixtures__/rls.expected.json` for the RLS row count, otherwise static.
- **Status** — 4-up stat grid (phases done, tests passing, locales shipped, scan findings open).

Implementation:
- Pure React component using shadcn `Tabs`, `Card`, `Badge`, `Collapsible`.
- No new dependencies. No server fn — fully static content lives in `src/lib/dashboard-content.ts` (typed, i18n-keyed for the 4 supported locales).
- Add nav entry to Sidebar between Settings and Security with a "Build" badge.
- `head()`: title "Build Dashboard — TalentGraph Africa", meta description, og:title/description.

---

## Track 3 — Architecture roadmap extraction

Output: `docs/roadmap/` (markdown only, no code execution).

Files:
- `00-overview.md` — Vision + system diagram description from `Now here is the complete system architecture.docx` p.1–2.
- `01-data-model.md` — Tables (users, skills, portfolio_items, attestations, opportunities, audit_log) with column lists transcribed from pages 3–4. Cross-reference current Supabase schema, flag gaps.
- `02-ai-pipeline.md` — Skill extraction + composite scoring + readiness coaching (pages 5–11). Mapped to existing `src/lib/ai/extract-skills.ts` and `supabase/functions/extract-skills-multimodal`.
- `03-trust-and-credentials.md` — Attestation engine, ECDSA, soulbound NFT (pages 12–15).
- `04-security-middleware.md` — JWT rotation, prompt-injection patterns, CSP/HSTS (pages 16–19). Cross-reference `src/lib/security/*`.
- `05-fairness-audits.md` — Group approval deviation logic (pages 23–24, 31–32). Cross-reference `fairness_audits` table.
- `06-roadmap.md` — Phase 5 / Phase 8 plan (pages 30–33) merged with the dashboard's phase definitions so both stay in sync.
- `README.md` — index + status table (implemented / partial / not started).

Each file ends with a "Cross-references" block listing the relevant project files. The `bash-3.docx` is the prototype HTML source for Track 1 — referenced in `00-overview.md`, not copied wholesale.

---

## Out of scope

- New backend tables, RLS changes, edge functions, server-fn rewrites.
- Replacing the map/AI provider or the WebAuthn flow.
- Real blockchain integration (soulbound NFT stays in roadmap docs only).
- Hero illustrations / generative imagery (token palette + gradients only).
- Light theme (UNMAPPED is dark-only).

## Verification

- `bun run test` — all 256 existing tests still pass; locale strict tests still gate.
- `bunx playwright test visual.spec.ts --update-snapshots` once, committed.
- Manual smoke in preview: each route renders with new chrome; LanguageSwitcher still cycles all 4 locales; `/dashboard` tabs switch without console errors.
- `supabase--linter` unchanged (no DB changes).

Ready to switch to build mode whenever you are.