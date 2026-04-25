# TalentGraph Africa — World Bank Challenge 5 (Unmapped)

A full faithful build of the platform described in your three documents, adapted to run on the Lovable stack (TanStack Start + Lovable Cloud + Lovable AI Gateway). Every economic figure will be real and cited; AI work runs server-side; security follows the 18-point checklist from your master dashboard.

---

## 1. Visual identity (matched exactly to your mockup)

- **Palette**: bg `#060B16` → `#1A2540`, gold `#E8A838` (primary CTA), teal `#2DD4BF` (durable / safe), coral `#F87171` (at-risk), lavender `#A78BFA`, soft text `#EDE8E0` / `#8B9DC0`
- **Typography**: Sora (display) · Space Mono (data/codes) · DM Sans (body) — all from Google Fonts
- **Layout shell**: 52-px fixed topbar (logo + UNMAPPED/Challenge 05 badge + module nav + country selector + bandwidth indicator + view toggle), 256-px left sidebar with live country stats + persona picker + data-source citations, scrollable panel area
- **Reusable elements**: gauges (SVG arc), constellation graph (SVG), ISCO-08 table, opportunity cards with match %, econometric strip, sector growth bars, education projection chart, skill-card credential preview with QR
- **Animations**: subtle fade-in on panel switch, gauge sweep on data load, pulse on voice-listening state — kept tasteful

---

## 2. Three core modules (the product)

### Module 01 — Skills Signal Engine
- Free-text + voice input (Web Speech API for capture; Lovable AI for transcription fallback)
- Persona quick-fills: Sarah (seamstress, Eldoret) · James (phone-repair, Nairobi) · Amara (smallholder farmer, Kano) · Kwame (informal trader, Accra)
- Server function calls Lovable AI (`google/gemini-3-flash-preview`) with a structured tool-calling schema → returns ISCO-08 4-digit codes, ESCO codes, category, proficiency 1–10, evidence strength, market relevance
- Output: animated skill constellation (SVG), ISCO mapping table, generated skill credential card with cryptographic signature hash + QR

### Module 02 — AI Readiness Lens
- Per-skill automation risk based on **Frey & Osborne (2013)** baseline probabilities (curated table of 50+ ISCO occupations) with **LMIC calibration** (0.55–0.80 multiplier) keyed to the selected country's labor cost + informality + infrastructure
- Overall weighted gauge, durable-vs-at-risk breakdown, adjacent-skills recommender (cosine over a curated skill embedding table)
- **Wittgenstein Centre SSP2** education projections 2020 → 2035 (real published figures per region) as stacked bars
- **ILO sector employment growth** projections per country

### Module 03 — Opportunity Dashboard
- **Econometric strip**: youth unemployment (ILO ILOSTAT), national min wage (ILO WCLD), informal share, World Bank Human Capital Index — all real, all cited
- **Youth view**: ranked opportunity cards (semantic match using AI-generated skill embeddings cosine-compared to opportunity embeddings, both stored in Postgres), salary, remote flag, growth tag, AI-generated pathway with curated free-resource links (Coursera/YouTube/government programs)
- **Policymaker view**: heatmap of skill-supply vs demand by region, recommended interventions with projected impact, fairness-audit summary

---

## 3. Trust, credentials & attestations

- **Peer attestations**: invite by phone/email → attester signs the skill claim with a generated ECDSA keypair (Web Crypto API, P-256), signature + public key stored
- **Three-attestation rule**: skill auto-promotes to `verified` when sum of trust weights ≥ 2.5
- **Credential anchoring** (adapted from Polygon → Lovable Cloud): every verified skill produces an immutable, append-only `credential_anchor` row with SHA-256 of payload + ECDSA signature from the platform's signing key. Verifiable via public `/verify/:credentialId` route + QR — no login needed, works for any third party. Row insertion is enforced via DB policy as append-only (no UPDATE/DELETE for app role).
- **WhatsApp share**: one tap opens `wa.me` with pre-formatted credential link

---

## 4. Security (all 18 layers from your dashboard)

- **Auth**: WebAuthn passkeys primary + phone OTP fallback (server-issued, Redis-style rate-limited via Postgres)
- **Tokens**: 15-min access + rotating 7-day refresh in `httpOnly; Secure; SameSite=Strict` cookies — never localStorage
- **Roles**: separate `user_roles` table + `has_role()` SECURITY DEFINER function (per Lovable security rules) — never on profile
- **Rate limiting**: sliding window in Postgres — 5/15min auth, 30/min AI, 500/min general
- **Prompt-injection guard**: pre-check strips `ignore previous`, `you are now`, `[INST]`, `<|...|>` patterns; user content always in `user` role separated from `system`; output PII filter
- **PII encryption**: AES-256-GCM field-level on phone numbers and any ID data using `pgcrypto`; key from server env
- **Validation**: Zod on every server function input (length, format, allowed values); parameterized queries only
- **Headers**: HSTS, CSP blocking inline scripts + non-allowlisted origins, X-Frame-Options DENY, Referrer-Policy no-referrer
- **Audit log**: append-only `audit_log` table — every credential issuance, attestation, revocation, admin action logged with actor id, hashed IP, UA, timestamp; UPDATE/DELETE revoked at DB level
- **Fairness audit**: every batch of AI decisions checked for demographic parity (gender, country, region) — flags any group deviating >15% from mean approval rate; flagged batches require human review before issuance

---

## 5. Data layer (Lovable Cloud / Postgres)

Tables:
`users`, `user_roles`, `skills` (with embedding column), `portfolio_items`, `attestations`, `opportunities` (with embedding), `credential_anchors` (append-only), `audit_log` (append-only), `fairness_audits`, `country_stats` (curated), `frey_osborne_scores` (curated), `wittgenstein_projections` (curated), `sector_growth` (curated), `isco_taxonomy` (curated reference)

Seed data shipped:
- 5 countries: Kenya, Ghana, Nigeria, South Africa, Rwanda — every econometric figure sourced from ILO ILOSTAT, World Bank WDI/HCI, Wittgenstein Centre, with citation strings stored alongside the values
- 50 realistic opportunity records across the 5 countries
- 4 demo personas pre-loaded with skills, attestations, and matched opportunities
- "Sarah" demo account that walks the full 90-second judge demo

---

## 6. Routes

`/` landing & module overview · `/skills` Module 01 · `/readiness` Module 02 · `/opportunities` Module 03 · `/credential/:id` public verifier (no auth, QR target) · `/attest/:token` peer attestation flow · `/policymaker` policymaker view · `/auth` passkey + OTP · `/admin/fairness` audit dashboard · `/api/public/verify/:id` machine-readable JSON for third-party verification

Each route gets its own `head()` with unique title, description, og:title, og:description per TanStack SSR/SEO rules.

---

## 7. Multilingual

i18n via `react-i18next` with English, Swahili, French, Hausa — at minimum landing page, module titles, persona names, CTAs, credential card. AI prompts request output in the user's selected language where applicable.

---

## 8. Build phases (mirrors your master dashboard)

1. **Foundation**: design tokens (CSS vars matching mockup), fonts, shell, topbar + sidebar + country picker, route scaffolding, Lovable Cloud enabled, schema + seed data
2. **Module 01 — Skills Engine**: input UI, persona quick-fill, AI extraction server function with structured output, constellation SVG, ISCO table, credential card
3. **Module 02 — AI Readiness**: Frey-Osborne data + LMIC calibrator, overall gauge, per-skill rows, adjacent-skill recommender, Wittgenstein projection chart, sector bars
4. **Module 03 — Opportunities**: econometric strip, youth view (cards + pathway), policymaker view (heatmap + interventions), embedding-based matching server function
5. **Trust layer**: attestation invite + sign flow (Web Crypto), three-attestation rule, credential anchor table + public verifier + QR
6. **Security & polish**: WebAuthn + OTP, rate limiting, audit log, fairness audit, prompt-injection guard, PII encryption, security headers, multilingual strings, demo seed, error boundaries on every route

---

## 9. What's faithfully adapted vs. swapped

| Spec doc | Lovable adaptation |
|---|---|
| FastAPI + SQLAlchemy + Alembic | TanStack Start server functions + Lovable Cloud (Postgres) |
| pgvector | Same — pgvector available in Lovable Cloud |
| Neo4j trust graph | Postgres recursive CTE over `attestations` (sufficient for trust weight propagation at hackathon scale) |
| Polygon ERC-721 NFT | Append-only `credential_anchors` + ECDSA signature + public verifier + QR — same trust property without on-chain dependency |
| Hardhat / Solidity | Removed (replaced as above) |
| Anthropic Claude direct | Lovable AI Gateway (`google/gemini-3-flash-preview` default, structured tool-calling for ISCO mapping) |
| Whisper voice | Web Speech API browser-native + Lovable AI fallback |
| Redis sliding-window rate limiter | Postgres-backed sliding window |
| Docker Compose + GH Actions | Lovable's managed deploy |
| i18next | `react-i18next` (same library, React binding) |

Every other capability — multimodal portfolio analysis, skill embeddings, semantic matching, peer attestations, fairness audit, audit log, public credential verification, offline-friendly PWA polish — is built as specified.