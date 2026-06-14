# 02 · AI Pipeline

The brief proposed an Anthropic-driven multimodal skill extractor and a composite-score readiness
engine. The repo implements both via the Lovable AI Gateway (no per-project API key) and a small
set of server functions / edge functions.

## Stages

1. **Skill extraction** — `supabase/functions/extract-skills-multimodal/index.ts` and
   `src/lib/ai/extract-skills.ts`. Accepts images and text portfolio items, returns structured
   `{ skills[], overall_confidence, recommended_job_titles, summary }`.
2. **Embedding** — Stored alongside each skill row (`embedding vector(1536)`), ivfflat indexed.
3. **Match generation** — `src/server/opportunities.functions.ts` runs cosine similarity against
   `opportunities.embedding`, re-ranks by salary range, remote flag, and (when present) location.
4. **Match explanation** — `supabase/functions/match-explanation/index.ts` produces cited reasoning
   surfaced by `src/components/MatchExplanation.tsx` + `src/components/CitationsPanel.tsx`.
5. **Composite score** — Weighted sum of AI confidence (40%) + attestation strength (35%) +
   assessment outcome (25%). Documented in the brief, computed in `src/lib/readiness.ts`.

## Guardrails

- Every prompt passes through `src/lib/security/prompt-guard.ts` (and its edge twin in
  `supabase/functions/_shared/prompt-guard.ts`). 30+ injection patterns.
- All LLM-bound text passes through `src/lib/security/redact.ts` first.
- Rate-limited per user via `rl_check`.

## Cross-references

- `src/lib/ai/`
- `src/lib/ai/__tests__/extract-skills.test.ts`
- `supabase/functions/extract-skills-multimodal/`
- `supabase/functions/match-explanation/`
