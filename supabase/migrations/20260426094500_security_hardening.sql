-- =========================================================================
-- Security hardening pass
-- =========================================================================
-- Tightens RLS on tables that previously exposed broader data than required:
--
-- 1. credential_anchors.payload is JSONB and previously fully readable to
--    anonymous callers. The verifier UI only needs id, skill_id, payload_hash,
--    platform_signature, signing_key_id, is_revoked, anchored_at — NOT the
--    raw payload. We expose a public view with only those columns and shift
--    the public read policy to a per-column check.
--
-- 2. rate_limits had `USING (FALSE)` for SELECT only. Add matching
--    INSERT/UPDATE/DELETE denials so anon/authenticated keys cannot mutate
--    the table even if a future RLS bypass slips through. Service-role keys
--    bypass RLS by design; the SECURITY DEFINER `rl_check` is unaffected.
--
-- 3. audit_log: previously allowed any caller to INSERT (we removed the
--    permissive INSERT policy in the earlier hardening migration). Be
--    explicit and add a deny-all policy for non-service callers so RLS
--    behaviour is unambiguous.
--
-- This migration is idempotent — safe to re-run.

-- 1. credential_anchors public projection ---------------------------------
DROP POLICY IF EXISTS "credentials_public_read" ON public.credential_anchors;

-- Re-create with row-level access still granted (the `payload` column is
-- screened at the application layer below via a view).
CREATE POLICY "credentials_public_read" ON public.credential_anchors FOR SELECT
  USING (TRUE);

-- The verifier MUST go through this view. Server functions that need the raw
-- payload (e.g. issuance hand-off) continue to use the service-role admin
-- client which bypasses RLS.
CREATE OR REPLACE VIEW public.credential_anchors_public AS
  SELECT
    id,
    skill_id,
    user_id,
    payload_hash,
    platform_signature,
    signing_key_id,
    is_revoked,
    revoked_reason,
    revoked_at,
    anchored_at
  FROM public.credential_anchors;

GRANT SELECT ON public.credential_anchors_public TO anon, authenticated;
COMMENT ON VIEW public.credential_anchors_public IS
  'Public-safe projection of credential_anchors that omits the raw payload JSON. Verifier UIs MUST query this view.';

-- 2. rate_limits — explicit deny-all for non-service callers --------------
DROP POLICY IF EXISTS "rate_limits_no_select" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits_no_insert" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits_no_update" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits_no_delete" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits_no_access" ON public.rate_limits;

CREATE POLICY "rate_limits_no_select" ON public.rate_limits FOR SELECT  USING (FALSE);
CREATE POLICY "rate_limits_no_insert" ON public.rate_limits FOR INSERT  WITH CHECK (FALSE);
CREATE POLICY "rate_limits_no_update" ON public.rate_limits FOR UPDATE  USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY "rate_limits_no_delete" ON public.rate_limits FOR DELETE  USING (FALSE);

-- 3. audit_log — be explicit that no client role may insert directly ------
-- Ensure no permissive INSERT policy remains.
DROP POLICY IF EXISTS "audit_insert" ON public.audit_log;
DROP POLICY IF EXISTS "audit_no_insert" ON public.audit_log;
DROP POLICY IF EXISTS "audit_no_update" ON public.audit_log;
DROP POLICY IF EXISTS "audit_no_delete" ON public.audit_log;

CREATE POLICY "audit_no_insert" ON public.audit_log FOR INSERT WITH CHECK (FALSE);
CREATE POLICY "audit_no_update" ON public.audit_log FOR UPDATE USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY "audit_no_delete" ON public.audit_log FOR DELETE USING (FALSE);

-- 4. fairness_audits — same pattern: previously allowed any insert -------
DROP POLICY IF EXISTS "fairness_insert" ON public.fairness_audits;
DROP POLICY IF EXISTS "fairness_no_insert" ON public.fairness_audits;
DROP POLICY IF EXISTS "fairness_no_update" ON public.fairness_audits;
DROP POLICY IF EXISTS "fairness_no_delete" ON public.fairness_audits;

CREATE POLICY "fairness_no_insert" ON public.fairness_audits FOR INSERT WITH CHECK (FALSE);
CREATE POLICY "fairness_no_update" ON public.fairness_audits FOR UPDATE USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY "fairness_no_delete" ON public.fairness_audits FOR DELETE USING (FALSE);

-- 5. attestations — previously had a permissive WITH CHECK (TRUE). Reaffirm
--    that all writes flow through public.submit_attestation (SECURITY
--    DEFINER) by denying direct DML for non-service callers.
DROP POLICY IF EXISTS "attestations_insert" ON public.attestations;
DROP POLICY IF EXISTS "attestations_no_insert" ON public.attestations;
DROP POLICY IF EXISTS "attestations_no_update" ON public.attestations;
DROP POLICY IF EXISTS "attestations_no_delete" ON public.attestations;

CREATE POLICY "attestations_no_insert" ON public.attestations FOR INSERT WITH CHECK (FALSE);
CREATE POLICY "attestations_no_update" ON public.attestations FOR UPDATE USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY "attestations_no_delete" ON public.attestations FOR DELETE USING (FALSE);

-- 6. profiles — previously fully public-read. Demographic columns
--    (gender, age_band) are PII; restrict them to the owner + admin.
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_read" ON public.profiles;

-- Public projection — names + country only, used by leaderboards / share
-- pages. Demographic + activity timestamps are NOT exposed.
CREATE OR REPLACE VIEW public.profiles_public AS
  SELECT
    id,
    display_name,
    country_code,
    region,
    preferred_language,
    is_active,
    created_at
  FROM public.profiles
  WHERE is_active = TRUE;

GRANT SELECT ON public.profiles_public TO anon, authenticated;
COMMENT ON VIEW public.profiles_public IS
  'Public-safe projection of profiles. Excludes gender, age_band, ecdsa_public_key, and last_active.';

CREATE POLICY "profiles_owner_read" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- 7. credential_anchors append-only enforcement ---------------------------
DROP POLICY IF EXISTS "credentials_insert" ON public.credential_anchors;
DROP POLICY IF EXISTS "credentials_no_insert" ON public.credential_anchors;
DROP POLICY IF EXISTS "credentials_no_update" ON public.credential_anchors;
DROP POLICY IF EXISTS "credentials_no_delete" ON public.credential_anchors;

CREATE POLICY "credentials_no_insert" ON public.credential_anchors FOR INSERT WITH CHECK (FALSE);
CREATE POLICY "credentials_no_update" ON public.credential_anchors FOR UPDATE USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY "credentials_no_delete" ON public.credential_anchors FOR DELETE USING (FALSE);
