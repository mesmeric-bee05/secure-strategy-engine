# TalentGraph Africa — Execution Plan (this turn)

Faithful continuation of the approved master plan in `.lovable/plan.md`. This turn focuses on the user's five named asks **plus** parallel scaffolding of Modules 02, the Trust layer, and Security so the whole project keeps moving — exactly as requested.

---

## 1. Wire the shell into the app (immediate)

- `src/routes/__root.tsx`: keep the SSR shell (html/head/body/Scripts) intact, wrap `<Outlet />` in **`QueryClientProvider`** sourced from router context (per TanStack Query SSR rules), and add a global `notFoundComponent`.
- `src/router.tsx`: create a fresh `QueryClient` **inside `getRouter`** (no module singleton — prevents cross-request leaks during SSR), set `defaultPreloadStaleTime: 0`, attach `defaultErrorComponent`.
- `src/routes/index.tsx`: **remove the placeholder** entirely. Replace with a real Overview module wrapped in `<AppShell>`:
  - Hero strip (UNMAPPED · Challenge 05 badge, the dark gradient + grid backdrop from the mockup)
  - 3 module cards (Skills Engine 01 · AI Readiness 02 · Opportunities 03) using gold/teal/coral accents and the Sora display type
  - Live "Country signals" mini-strip pulled from `countries` table (loader → server fn) with citations
  - "Demo Sarah in 90 seconds" CTA → `/skills?persona=sarah`
- Every new route file gets its own `head()` (title, description, og:title, og:description) per the SSR/SEO rules.

## 2. Module 01 — Skills Signal Engine (`/skills`)

Route file: `src/routes/skills.tsx` wrapped in `<AppShell>`.

### UI (matches mockup pixel-faithfully)
- **Eyebrow**: `MODULE 01 · SKILLS SIGNAL ENGINE`
- **Input panel**: textarea + voice button (Web Speech API, with a graceful fallback notice when unavailable), language selector (en/sw/fr/ha), persona quick-fill chips (Sarah · James · Amara · Kwame, fetched from `personas` table)
- **Action bar**: "Map to ISCO-08 / ESCO" gold button (the streaming trigger), clear, save-as-draft
- **Right column** (renders progressively as data streams):
  - **Skill Constellation** — pure SVG radial graph: center node = persona, orbiting nodes sized by proficiency, color-coded by category (manual=gold, digital=teal, soft=lavender, business=sky, creative=coral). Edges weighted by AI confidence. Hover → tooltip with ISCO code + proficiency.
  - **ISCO/ESCO mapping table** — sticky header: skill | ISCO-08 | ESCO | category | proficiency 1–10 | confidence | evidence
  - **Skill credential card preview** — generated SVG card (dark navy, gold border, persona name, top 3 verified skills, SHA-256 payload hash truncated, QR placeholder pointing to `/credential/preview`)
- **CitationsPanel** at bottom (see §5) listing ISCO-08, ESCO v1.1, Lovable AI model card.

### Server logic
- `src/server/skills.functions.ts` — `extractSkills` server fn:
  - `createServerFn({ method: "POST" })` → `.inputValidator(zod schema: text 1–4000 chars, language enum, personaSlug?)` → `.handler(...)`
  - **Prompt-injection guard**: strip `ignore previous`, `you are now`, `[INST]`, `<\|...\|>`, zero-width chars before sending
  - Calls **Lovable AI Gateway** (`google/gemini-3-flash-preview`) with **structured tool-calling**:
    - Tool name: `extract_skills`, parameters: `skills[]` of `{name, isco_code (regex `^[0-9]{4}$`), esco_code, category enum, proficiency 1-10, confidence 0-1, evidence_strength enum, observations}`
  - Cross-references returned ISCO codes against the seeded `isco_taxonomy` table; drops or relabels any code not present (defensive)
  - For authenticated users: inserts into `skills` (RLS-scoped), returns `skillId`s. For anon demo flow: returns ephemeral results only
  - Logs to `audit_log` (action=`skills.extract`, hashed IP)
  - **Streaming**: handler returns the parsed JSON in one shot (Gemini structured output is not chunked). UI uses TanStack Query mutation + per-row staggered fade-in to give the "streaming" feel without faking an SSE channel. (If real token streaming is later needed, swap to `model.streamText` and a server route under `/api/skills/stream`.)
- Embedding generation: a follow-up `generateSkillEmbeddings` server fn calls a small Lovable AI embed-capable model and writes `vector(384)` into `skills.embedding`. Triggered post-extract for authenticated users.

### Frontend wiring
- TanStack Query mutation `useExtractSkills`, optimistic constellation skeleton, error boundary surfaces friendly fallback ("AI is busy — showing the last good result for this persona").
- Persona quick-fill: clicking Sarah pre-loads her seeded text and auto-runs the mapping (perfect for judges).

## 3. Module 03 — Opportunity Dashboard (`/opportunities`)

Route file: `src/routes/opportunities.tsx`.

### UI
- **Eyebrow**: `MODULE 03 · OPPORTUNITY DASHBOARD`
- **Country filter**: pill row (KE · GH · NG · ZA · RW) bound to URL search params (`?country=KE`) so it's deep-linkable & SSR-friendly
- **Econometric strip** (top): 4 stat tiles — youth unemployment, min wage USD, informal share, HCI — each with a tiny citation chip ("ILO 2023" / "WB HCI 2020") that opens the CitationsPanel
- **Tabs**: `Youth view` (default) · `Policymaker view`
- **Youth view**:
  - Persona selector (re-uses sidebar persona) → fetches that persona's skills → server fn `matchOpportunities` does cosine similarity (pgvector `<=>`) against `opportunities.embedding`, returns top 12 with match %
  - Cards: title, employer, location/remote pill, salary range, growth %, match % gold badge, "View pathway" button
  - Pathway modal (deferred to next turn for full AI generation; placeholder + skeleton in this turn)
- **Policymaker view**:
  - Skill-supply vs demand heatmap (SVG grid) per region — first cut uses aggregate counts from seeded data
  - Recommended interventions card (3 items, hard-coded based on top supply/demand gaps for the selected country, each cited)
  - Fairness audit summary card (reads latest `fairness_audits` row; "no audits yet" empty state)

### Server logic
- `src/server/opportunities.functions.ts`:
  - `listOpportunities({ country })` — public, filters `opportunities` by `country_code`
  - `matchOpportunities({ personaSlug, country })` — fetches persona's seeded skills, computes a query embedding (mean of skill embeddings; if any are missing, falls back to keyword match on `required_skills` ARRAY column), returns top-N with similarity score
  - All inputs Zod-validated; no PII returned

## 4. ISCO/ESCO mapping button (server-driven, results streamed into UI)

- The "Map to ISCO-08 / ESCO" button on `/skills` is the user-facing trigger.
- Implementation: TanStack Query `useMutation` → `useServerFn(extractSkills)` → on each returned skill, push into a Zustand-free local state with a 60ms stagger → constellation nodes pop in one-by-one (perceived streaming).
- Optional true-stream path documented as a follow-up: convert handler to a server route at `/api/skills/stream` returning `text/event-stream` of `tool_call.delta` chunks from Lovable AI.

## 5. Citations panel (cross-cutting component)

- `src/components/CitationsPanel.tsx`:
  - Props: `sources: Array<{ key, label, citation, url? }>`
  - Renders as a collapsible section at the bottom of every module page, plus a clickable chip variant (`<CitationChip />`) usable inline next to any stat
  - Pulls citation strings directly from the seeded columns: `countries.unemployment_source`, `countries.wage_source`, `countries.informal_source`, `countries.hci_source`, `frey_osborne_scores.citation`, `wittgenstein_projections.citation`, `opportunities.source_citation`, `isco_taxonomy` (static label).
- A small server fn `getCitationsForCountry(code)` aggregates them so each module gets one shaped payload per country.

## 6. Concurrent scaffolding (started this turn, finished next)

To keep the whole project moving while §1–§5 are the headline work:

- **Module 02 — AI Readiness Lens** (`/readiness`): route file + skeleton with overall gauge SVG component, per-skill table reading `frey_osborne_scores` joined to current persona's skills, Wittgenstein stacked-bar chart from `wittgenstein_projections` (using Recharts which is already in the stack). Adjacent-skill recommender deferred to the next turn but the data hook is wired.
- **Trust layer** (foundations): migration adding INSERT policies for `attestations` (auth user can attest a skill they don't own; weight ≤ 1.0), `credential_anchors` (insert via SECURITY DEFINER fn `issue_credential` only — append-only enforced by revoking UPDATE/DELETE), and a public `/credential/$id` route that renders a verifier card with QR (qrcode.react). Web Crypto signing flow lives behind `/attest/$token` — UI scaffold only this turn, full ECDSA flow next turn.
- **Security**:
  - Add **`requireSupabaseAuth`** middleware to every write server fn (skills insert, attestations, credential issuance)
  - Add a **rate-limit** middleware backed by the existing `rate_limits` table (sliding window, 30/min for AI endpoints, 500/min general) — implemented as a request middleware that hashes IP+userId
  - Prompt-injection sanitizer utility in `src/lib/security/prompt-guard.ts`
  - PII helpers `src/lib/security/pii.ts` (AES-256-GCM via Web Crypto, key from `process.env.PII_ENCRYPTION_KEY`) — flagged for an `add_secret` step on the next turn (when we wire phone OTP)
  - Zod schemas centralized in `src/lib/schemas.ts`
- **Auth route** (`/auth`): scaffold Email + Google sign-in (Lovable Cloud auth — passkey/OTP layered in next turn). No anonymous sign-ins. Auto-confirm stays OFF.

## 7. Files created or edited this turn

**New routes**: `src/routes/index.tsx` (replace placeholder), `src/routes/skills.tsx`, `src/routes/opportunities.tsx`, `src/routes/readiness.tsx`, `src/routes/auth.tsx`, `src/routes/credential.$id.tsx`

**New components**:
`src/components/Overview/HeroBlock.tsx`, `src/components/Overview/ModuleCard.tsx`, `src/components/skills/SkillsInputPanel.tsx`, `src/components/skills/SkillConstellation.tsx`, `src/components/skills/IscoMappingTable.tsx`, `src/components/skills/CredentialCardPreview.tsx`, `src/components/skills/PersonaQuickFill.tsx`, `src/components/opportunities/EconometricStrip.tsx`, `src/components/opportunities/CountryFilter.tsx`, `src/components/opportunities/OpportunityCard.tsx`, `src/components/opportunities/PolicymakerHeatmap.tsx`, `src/components/readiness/ReadinessGauge.tsx`, `src/components/readiness/EducationProjectionsChart.tsx`, `src/components/CitationsPanel.tsx` + `CitationChip.tsx`, `src/components/ui/SectionEyebrow.tsx`

**New server logic**:
`src/server/skills.functions.ts`, `src/server/opportunities.functions.ts`, `src/server/citations.functions.ts`, `src/server/readiness.functions.ts`, `src/lib/security/prompt-guard.ts`, `src/lib/security/rate-limit.ts`, `src/lib/schemas.ts`, `src/lib/ai/lovable-ai.ts` (typed wrapper around the gateway)

**Edited**:
`src/router.tsx` (per-request QueryClient + defaults), `src/routes/__root.tsx` (QueryClientProvider, notFoundComponent, route context type)

**DB migration**: append-only INSERT policies for `attestations`, `credential_anchors`, `audit_log`; SECURITY DEFINER `issue_credential` fn; sliding-window `rl_check(identifier, bucket, limit, window_seconds)` fn.

## 8. Out of scope for this turn (queued for next)

- Real WebAuthn passkey flow (scaffold only this turn)
- Full ECDSA peer-attestation signing UI (DB + verifier route only this turn)
- AI-generated pathway content for opportunity cards (skeleton + button this turn; live AI call next turn)
- Full i18n string extraction (en strings only this turn; sw/fr/ha keys stubbed)
- Service worker / offline PWA shell

These map 1-to-1 with phases 5 + 6 of `.lovable/plan.md` and will land in the next 2 turns.

---

**Acceptance criteria for this turn**

1. Visiting `/` shows the dark `AppShell` with topbar, sidebar, and the Overview hero — no placeholder image anywhere.
2. `/skills` lets you click "Sarah" → click "Map to ISCO-08 / ESCO" → a real Lovable AI call returns ISCO-coded skills → constellation + table + credential card all populate, with citations underneath.
3. `/opportunities` shows the Kenya econometric strip with real seeded numbers, opportunity cards from the seeded table, country filter changes URL + data, both tabs render.
4. CitationsPanel appears on every module page with the correct seeded source strings.
5. `bun run build` passes (no unresolved imports, no missing routes, strict TS clean).
