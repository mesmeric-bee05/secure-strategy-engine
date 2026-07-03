## Goal

Take the two uploaded documents as the single source of truth and bring the live app all the way there:

- `bash-4.docx` → the **UNMAPPED v3 "elite"** prototype (full HTML/CSS/JS, ~50 pages). This replaces v2 as the design + interaction target.
- `Now here is the complete system architecture-5.docx` → the **production architecture brief** (schema, AI pipeline, trust engine, security middleware, fairness auditor, soulbound credential, JWT rotation, rate limiting, bias audit, phase plan).

Everything below either ships as production code on the current TanStack Start + Lovable Cloud stack or is explicitly mapped to an existing implementation. Nothing from the brief is silently dropped — anything not built lands in `docs/roadmap/` with a status.

---

## Track A — UNMAPPED v3 design system (replaces v2)

Source: `bash-4.docx` `:root` tokens + component CSS + persona/module/opportunity layouts.

**Tokens → `src/styles.css`** (overwrite v2 palette)
- Surfaces: `--bg #07080C`, `--bg-1 #0E1017`, `--bg-2 #14171F`, `--bg-3 #1C2030`; borders `rgba(255,255,255,.06)` / `.14`.
- Accents: `--gold #F5A623` (+ dim/glow), `--teal #00C9A7`, `--red #FF4757`, `--blue #4A9FFF`, `--purple #A78BFA`, each with `-dim` companion.
- Text: `--txt #EDF0F8`, `--txt-2 #8B9AB3`, `--txt-3 #4A556B`.
- Fonts: **Syne** (display), **DM Sans** (body), **JetBrains Mono** (mono) — loaded via `<link>` in `src/routes/__root.tsx` head, mapped through `@theme` to shadcn semantic tokens.
- Nav height 56, sidebar 220, radii 10/16.
- CSP/HSTS/X-Frame/X-Content-Type/Referrer-Policy meta tags mirrored in root head (already partly present via `public/_headers`).

**Global chrome rebuilt to v3**
- Topbar: 56px, blurred `rgba(7,8,12,.92)`, gradient gold logo mark, "Unmapped · World Bank Challenge 05" sub-tag, tab strip with numeric chips, country selector, live-bandwidth pill with pulsing dot.
- Sidebar: 220px, sectioned (Persona / Signals / Data Sources) with 9px uppercase labels, econ-signal rows (youth unemployment, informal share, HCI, min-wage) reading from `countries` table.
- Persona cards (Sarah/James/Amara/Kwame) with avatar + role, active state in gold-dim.
- Data-source chips (ILO ILOSTAT, ISCO-08, ESCO v1.1, WB HCI, Wittgenstein SSP2, Frey-Osborne, Coursera, Google Career Certs).

**Modules (each an in-app route, ported from v3 markup)**
1. `/skills` — Module 01 Skill Extraction: voice input (Web Speech API, existing `useSpeechRecognition`), portfolio evidence grid, ISCO-08+ESCO mapping table, confidence chips, adaptive assessment CTA.
2. `/readiness` — Module 02 AI Readiness & Displacement Lens: Frey-Osborne gauge, Wittgenstein SSP2 projections, adjacent-skills resilience chart, Coursera course cards.
3. `/opportunities` + `/opportunities/map` — Module 03 Opportunity Matching & Econometric Dashboard: match cards with source badges, salary chips, remote flag, live econ signal panel per country.
4. `/trust-graph` — Module 04 Attestation Constellation: canvas node graph (from v3 script), ECDSA-signed attestation submit dialog, weighted trust rollup.
5. `/credential/$id` — Module 05 Soulbound Credential: QR, ECDSA signature panel, verifier CTA, "Issued <date>" chip.
6. `/security` — live security posture (already partial): CSP/HSTS/rate-limit/injection-guard indicators.
7. `/dashboard` — keep the master build dashboard; restyle to v3 tokens.

**Reusable primitives** in `src/components/ui-tg/`: `SignalRow`, `PersonaCard`, `SourceChip`, `MatchCard`, `ConfChip`, `GaugeBox`, `NodeCanvas`, `CountrySelector`, `BandwidthPill`, `NavTab`.

No business-logic edits in reused files — className/wrapper swaps and prop-driven data only.

**Visual regression**: regenerate `tests/e2e/visual.spec.ts` baselines in the same commit.

---

## Track B — Backend feature completion (from architecture brief)

Everything below maps to the brief and either fills a gap or hardens an existing surface. All schema goes through `supabase--migration` with GRANT + RLS + policies in one migration.

**B1. Country econ-signal table** (drives sidebar + Module 03)
- Extend existing `countries` with missing brief columns: `youth_unemployment_pct`, `informal_share_pct`, `hci_score`, `min_wage_usd_month`, `source_url`. RLS: public read (`TO anon`), no writes.

**B2. Frey-Osborne + Wittgenstein reference tables** (already present) — seed via migration from the brief's numbers for KE/GH/NG/ZA. Add `isco_code` foreign keys.

**B3. `credentials` metadata endpoint** — server fn `getCredentialAnchor(id)` returning `{skill, composite_score, issued_at, signature, pubkey, payload_hash}` for public verifier. Already partly present; extend DTO to include Module 05 fields (QR payload URL).

**B4. Attestation constellation query** — server fn `getTrustGraph(userId)` returning nodes+edges for canvas. Uses existing `attestations` + `skills`.

**B5. Bias/fairness batch** — port `FairnessAuditor` from brief pp.23–25 into a SECURITY DEFINER `run_fairness_audit()` scheduled via `pg_cron` daily; writes to existing `fairness_audits`. Admin-only review UI in `/security`.

**B6. Adaptive assessment** — edge function `assessment-generate` + `assessment-score` (matches brief pp.6–8). Uses Lovable AI Gateway; prompt-guarded and rate-limited via existing `rl_check`.

**B7. Soulbound credential anchor (Phase 3 of brief)** — kept **deferred** (no real chain in scope). Instead: server-side ECDSA signature over the payload hash using an app-signing key stored in `SUPABASE_SECRET_KEYS`; emit `credential_anchors.platform_signature` + `signing_key_id`. Documented in `docs/roadmap/03-trust-and-credentials.md` as "on-chain anchor deferred".

**B8. JWT rotation + replay protection (brief pp.16–18)** — Supabase Auth already covers rotation. Add a `used_jtis` table (RLS deny) + refresh-token replay guard in a server fn `rotateRefresh()`; audit on replay attempt.

**B9. Prompt-injection guard** — extend `src/lib/security/prompt-guard.ts` with the exact regex set from brief p.18 (currently ~30, add missing `<|...|>`, `[INST]`, `### instruction`, `you are now`, `act as`, `jailbreak`, `system prompt`).

**B10. Security headers** — mirror the full v3 CSP (`default-src`, `img-src data: blob:`, `connect-src` with Supabase + Lovable AI) in both `public/_headers` and `__root.tsx` meta fallback.

---

## Track C — Roadmap docs refreshed against the new brief

Rewrite `docs/roadmap/` sections to point at v3 and the brief revision 5:

- `00-overview.md` — updated architecture diagram (Client → API gateway → Backend → Data/AI/blockchain), map each layer to current repo files.
- `01-data-model.md` — full column list from brief pp.3–4, gap analysis vs current migrations, checklist of B1–B4 changes.
- `02-ai-pipeline.md` — extraction / adaptive assessment / composite score (`0.40*ai + 0.35*att + 0.25*assess`) from brief pp.5–8.
- `03-trust-and-credentials.md` — ECDSA + weighted attestation + soulbound status ("platform-signed anchor now, on-chain later").
- `04-security-middleware.md` — brief pp.16–20 mapped to `src/lib/security/*`, `public/_headers`, `rl_check`, `used_jtis`.
- `05-fairness-audits.md` — 15% deviation rule, batch cron, review queue.
- `06-roadmap.md` — 7 phases from brief pp.27–33, statuses reflect Tracks A+B.
- New `07-personas.md` — Sarah/James/Amara/Kwame reference data used by the v3 UI.

---

## Verification

- `bun run test` — all existing 256 tests green; add unit tests for new server fns (`getTrustGraph`, `getCredentialAnchor`, fairness audit math) and prompt-guard additions.
- `bunx playwright test --update-snapshots` once for v3 visual baselines.
- `tests/security/rls.invariants.test.ts` extended with new tables (`used_jtis`, extended `countries` grants).
- `supabase--linter` clean after each migration.
- Manual smoke: each module route renders v3 chrome; persona switch updates sidebar signals; Module 03 map renders opportunity cards; `/credential/$id` shows ECDSA panel; `/security` shows all guard states green.

---

## Out of scope (explicit)

- Real on-chain mint (Polygon/L2 soulbound NFT). Platform-signed anchor + roadmap only.
- Neo4j (trust graph stays in Postgres; canvas viz is client-side).
- Redis / Celery / FastAPI — collapsed onto server fns + `rl_check` per existing convention.
- Whisper self-host — voice input uses browser Web Speech API (brief-compatible fallback).
- Light theme.

---

## Order of execution (once approved)

1. Track A tokens + fonts + chrome (single commit, snapshots regenerated).
2. Track A module route restyles (per-route commits).
3. Track B1–B2 migrations, then B3–B6 server fns/edge functions, then B8–B9 hardening.
4. Track C doc refresh.
5. Full test + snapshot pass, then ready-to-publish.

Ready to switch to build mode.
