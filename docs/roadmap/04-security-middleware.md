# 04 · Security Middleware

The brief specifies short-lived JWTs with rotating refresh, rate limiting, prompt-injection
prevention, CSP/HSTS, and an immutable audit log. All are implemented; the gaps documented below
are accepted by the security memory.

## Implemented

| Brief item | Implementation |
| --- | --- |
| Short-lived JWT + rotating refresh | Supabase Auth; `attachSupabaseAuth` middleware re-attaches the bearer to every server-fn RPC. |
| WebAuthn passkeys | `src/lib/passkeys/passkeys.functions.ts` + `src/components/PasskeyManager.tsx`. Recovery and retry paths covered by e2e + unit tests. |
| Rate limiting | `rl_check` SECURITY DEFINER, fail-closed, per-user-per-action buckets. |
| Input sanitization | Zod `inputValidator` on every server fn; `src/lib/security/sanitize.ts` for free-text. |
| Prompt-injection guard | `src/lib/security/prompt-guard.ts` + shared edge copy. |
| PII redaction | `src/lib/security/redact.ts` applied before logging or LLM context. |
| CORS + CSP + HSTS | Canonical in `public/_headers`; mirrored as meta-tag fallback in `src/routes/__root.tsx`. |
| Audit log | `audit_log` with `no_write` deny policy; writes only via SECURITY DEFINER paths. |

## Accepted residual risks (security memory)

- `has_role` and `submit_attestation` remain `authenticated`-executable by design; required for RLS
  policies and the user-facing attestation flow. Both have explicit null/duplicate/length checks.
- `pgvector` cannot be moved out of the `public` schema on managed Postgres (Supabase limitation).
  Tracked, accepted.

## Cross-references

- `src/lib/security/`
- `public/_headers`
- `tests/security/rls.invariants.test.ts`
- `docs/security/findings-2026-06-12.md`
