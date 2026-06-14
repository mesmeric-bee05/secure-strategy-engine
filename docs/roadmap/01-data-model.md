# 01 · Data Model

The brief specifies a Postgres + pgvector schema. The implementation lives across
`supabase/migrations/` with RLS, GRANTs, and audit triggers added per Lovable conventions.

## Tables (brief → implementation)

| Brief | In repo | Notes |
| --- | --- | --- |
| `users` | `auth.users` + `profiles` | Auth managed by Supabase; profile data is RLS-scoped to `auth.uid()`. |
| `skills` | `skills` | Includes `embedding vector(1536)` with ivfflat index. |
| `portfolio_items` | `portfolio_items` | item_type ∈ {image, text, github, pdf, voice}; AI analysis stored as JSON. |
| `attestations` | `attestations` | ECDSA signature + attester pubkey columns; writes only via `submit_attestation`. |
| `opportunities` | `opportunities` | Embedding + currency + remote flag; cosine search via SQL. |
| `audit_log` | `audit_log` | Append-only. `no_write` policy denies UPDATE/DELETE; writes only via SECURITY DEFINER. |
| `credentials` | `credential_anchors` | Public verifier route reads via service-role server fn (`getCredentialById`). |

## RLS & GRANT invariants

Locked by `tests/security/rls.invariants.test.ts` against
`tests/security/__fixtures__/rls.expected.json`. Any drift fails the build.

- `profiles` — `profiles_authenticated_read`, owner write
- `credential_anchors` — `credentials_owner_read`, `credentials_no_write`
- `attestations` — `attestations_read` scoped to skill owner or attester; `attestations_no_write`
- `audit_log`, `fairness_audits`, `rate_limits` — `no_write` deny on each

## Cross-references

- `supabase/migrations/`
- `src/integrations/supabase/types.ts`
- `src/server/credentials.functions.ts`
