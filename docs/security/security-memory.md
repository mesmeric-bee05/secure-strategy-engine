# Security Memory

TalentGraph Africa is an authenticated web app for informal-worker skill capture,
peer attestation, and portable credential issuance. Access control is enforced
through Supabase RLS on every `public` table plus `SECURITY DEFINER` server
functions for privileged writes.

## Access model

- `profiles` — owner-only (`profiles_self_read`, `profiles_self_insert`, `profiles_self_update`). No public read.
- `skills` — owner-only (`skills_self_read`, `skills_owner_insert`, `skills_owner_update`, `skills_owner_delete`).
- `attestations` — readable by skill owner and attester (`attestations_read`); writes only through `submit_attestation()` (`attestations_no_write`).
- `credential_anchors` — owner-read (`credentials_owner_read`); writes only through `issue_credential()` (`credentials_no_write`).
- `audit_log` — admin-read (`audit_admin_read`); no direct writes from clients (`audit_log_no_write`).
- `fairness_audits` — admin-read (`fairness_admin_read`); no direct writes (`fairness_audits_no_write`).
- `rate_limits` — no client access (`rate_limits_no_access`, `rate_limits_no_write`); mutated only by `rl_check()`.
- `webauthn_challenges` — no client access (`webauthn_challenges_no_access`) with explicit deny on `INSERT`/`UPDATE`/`DELETE`; mutated only by passkey server functions.

### Function EXECUTE grants

- No `anon` or `authenticated` EXECUTE on: `issue_credential`, `rl_check`, `handle_new_user`, `set_updated_at`.
- `authenticated`-only EXECUTE on: `has_role`, `submit_attestation`.

## What should never happen

- Unauthenticated users must never read `profiles`, `skills`, `attestations`, `credential_anchors`, `audit_log`, `fairness_audits`, `rate_limits`, or `webauthn_challenges`.
- Direct `INSERT`/`UPDATE`/`DELETE` on `audit_log`, `fairness_audits`, `rate_limits`, `credential_anchors`, `attestations`, or `webauthn_challenges` from client roles.
- A user attesting their own skill (blocked in `submit_attestation`).
- Raw PII (email, IP, user-agent) written to `audit_log` without hashing.
- The `SUPABASE_SERVICE_ROLE_KEY` reachable from client bundles.

## Accepted risks

Findings intentionally left open with justification. Each entry MUST match a
row in `docs/security/findings.accepted.json`.

- **supabase:has_role_execute_authenticated** (ACCEPTED) — `has_role` requires `EXECUTE TO authenticated` because RLS policy expressions call it as the invoking role. Function is `STABLE SECURITY DEFINER` and only reads `user_roles`.
- **supabase:submit_attestation_execute_authenticated** (ACCEPTED) — `submit_attestation` is the only write path for peer attestations; hardened with per-user rate limit (10/hour), duplicate-attester guard, self-attestation rejection, crypto-field length bounds, and audit logging on every outcome.

## Change protocol

Any edit to this file MUST be paired in the same commit with a matching edit to
at least one of:

- `tests/security/__fixtures__/rls.expected.json`
- `docs/security/findings.accepted.json`
- a new migration under `supabase/migrations/`

CI enforces this via `scripts/check-security-memory-drift.ts`.
