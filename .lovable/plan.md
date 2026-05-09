## Plan — Security hardening, Trust Graph, Passkeys, i18n

### ⚠️ Important: Next.js conversion is NOT recommended
This project is built on **TanStack Start v1** (Vite + Cloudflare Workers SSR). Converting to Next.js would mean:
- Rewriting every route, server function, and the auth middleware
- Losing the existing Worker deployment, `_headers` CSP, edge function wiring, and 200+ passing tests
- 1–2 weeks of pure migration work with no user-visible benefit — TanStack Start **already does SSR + per-route metadata**, which is what you actually need for SEO

I recommend we **keep TanStack Start** and instead double down on its SSR + `head()` metadata (which is already in place). If you still want Next.js after seeing the rest land, we can revisit as a separate, dedicated track.

The plan below assumes we **stay on TanStack Start** and ship the other four tracks in sequence.

---

### Phase 1 — AI edge function hardening (security)
**Files:** `supabase/functions/_shared/{rate-limit.ts,validation.ts,logger.ts}`, edits to `extract-skills-multimodal/index.ts` and `match-explanation/index.ts`, new tests.

- **Rate limiting**: per-IP + per-user sliding window via existing `rl_check` Postgres function (already deployed). Buckets: `ai:extract` (10/min), `ai:explain` (30/min). Fail-closed on infra error.
- **Request validation**: zod schemas for both function bodies — strict size caps (image ≤ 4 MB base64, text ≤ 8 KB persona, ≤ 2 KB opportunity), allow-listed mime types with magic-byte recheck server-side.
- **Structured logging**: JSON log lines `{ts, fn, requestId, userId?, status, latencyMs, model, tokensIn?, tokensOut?, errorCode?}` to stdout (picked up by Cloud logs). New `_shared/logger.ts` with `logEvent()`.
- **Alerts**: severity tag (`info|warn|error`); 5xx and 429-from-upstream emit `error` lines. Document how to wire to a log drain later (no infra change now).
- **Tests**: Deno tests for rate-limit decision, schema rejection, oversized image rejection, mime spoofing rejection.

### Phase 2 — Neo4j trust graph
**Files:** `supabase/functions/trust-graph-sync/index.ts` (cron-style), `src/lib/trust-graph/{client.ts,queries.ts}`, `src/server/trust-graph.functions.ts`, `src/routes/_authenticated/trust-graph.tsx`, tests.

- **Hosting**: Neo4j AuraDB Free (5 GB, no card). User adds three secrets: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` (will request via `add_secret` at start of phase).
- **Schema**: `(:User)-[:HAS_SKILL {weight}]->(:Skill)`, `(:Skill)-[:EVIDENCED_BY]->(:Attestation)`, `(:Opportunity)-[:REQUIRES]->(:Skill)`, `(:Opportunity)-[:LOCATED_IN]->(:Place)`.
- **Sync**: server fn `syncTrustGraph()` reads from Postgres (skills/attestations/opportunities) and `MERGE`s into Neo4j. Triggered manually + on attestation insert.
- **Read paths**: server fn `findTrustedMatches(userId)` runs Cypher path query: `MATCH (u)-[:HAS_SKILL]->(s)<-[:REQUIRES]-(o) WHERE …` returning ranked opportunities w/ trust score.
- **UI**: new `/trust-graph` route — small force-directed view (Cytoscape.js, lightweight) showing user's first/second-degree skill graph. Read-only.
- **Security**: Neo4j calls server-side only; never expose Bolt creds; Cypher uses parameter binding (no string concat).

### Phase 3 — WebAuthn passkeys
**Files:** `src/server/webauthn.functions.ts`, `src/lib/webauthn/{register.ts,authenticate.ts}`, edits to login/signup pages, new `passkeys` table migration.

- Library: `@simplewebauthn/server` + `@simplewebauthn/browser` (both Worker-compatible).
- DB: `passkeys (id, user_id, credential_id, public_key, counter, transports[], created_at, last_used_at, label)` with RLS `user_id = auth.uid()`. Challenges in short-TTL `webauthn_challenges` table.
- Flows: register passkey from settings; sign in with passkey OR fall back to email/password OR email magic link; **recovery** = at least one verified email + one alternate factor required before passkeys become primary.
- Tests: registration round-trip, login round-trip, replay-attack rejection (counter regression), challenge expiry.

### Phase 4 — i18n (en, sw, fr, ha)
**Files:** `src/lib/i18n/{index.ts,detect.ts}`, `src/locales/{en,sw,fr,ha}/common.json`, language switcher in `Topbar.tsx`, edits across map + AI components.

- Library: `i18next` + `react-i18next` (SSR-friendly; works with TanStack Start).
- Detection: URL `?lng=` → cookie → `Accept-Language` → `en`.
- Coverage: nav, landing, skills, opportunities (incl. map popups), AI streaming labels, error UI, auth pages. AI **prompts** also localised — system prompt switches to instruct the model to respond in the user's language.
- Pluralisation rules included for sw/fr/ha (CLDR via i18next).
- SEO: `<html lang>` + `hreflang` alternates emitted from each route's `head()`.
- Tests: render snapshot per locale for landing + opportunities; switcher updates `lang` and persists.

### Cross-cutting
- After each phase: run `bun run test`, `supabase--linter`, and `security--run_security_scan`. Fix any new findings before moving on.
- Update `mem://index.md` with: "Stack = TanStack Start (no Next.js migration)", "Neo4j AuraDB for trust graph", "i18n via i18next, locales en/sw/fr/ha".

### Out of scope
- Next.js conversion (see top note).
- Blockchain credential anchoring on a public chain (already have `credential_anchors` table; on-chain is a separate decision).
- Mobile apps.

### Sequencing
1. Phase 1 (smallest, no new infra, fully gated by existing tests).
2. Phase 3 (passkeys — auth-critical, wants its own QA window).
3. Phase 4 (i18n — touches many files but presentation-only).
4. Phase 2 (Neo4j — needs new external service + secrets; lands last so failures don't block other tracks).
