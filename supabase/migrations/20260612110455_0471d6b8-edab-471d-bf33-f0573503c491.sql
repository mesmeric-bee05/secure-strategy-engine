
-- 1. Profiles: restrict public read to authenticated users
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
CREATE POLICY "profiles_authenticated_read" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- 2. Credential anchors: drop public read; server uses service role
DROP POLICY IF EXISTS "credentials_public_read" ON public.credential_anchors;
CREATE POLICY "credentials_owner_read" ON public.credential_anchors
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Block direct writes from anon/authenticated (service role bypasses RLS)
CREATE POLICY "credentials_no_write" ON public.credential_anchors
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 3. Attestations: remove email exposure via verified skill branch
DROP POLICY IF EXISTS "attestations_read" ON public.attestations;
CREATE POLICY "attestations_read" ON public.attestations
  FOR SELECT TO authenticated
  USING (auth.uid() = skill_owner_id OR auth.uid() = attester_id);

-- Block direct writes (submit_attestation SECURITY DEFINER handles inserts)
CREATE POLICY "attestations_no_write" ON public.attestations
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 4. Audit log: explicit deny writes
CREATE POLICY "audit_log_no_write" ON public.audit_log
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 5. Fairness audits: explicit deny writes
CREATE POLICY "fairness_audits_no_write" ON public.fairness_audits
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 6. Rate limits: explicit deny writes from non-service callers
CREATE POLICY "rate_limits_no_write" ON public.rate_limits
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 7. Lock down SECURITY DEFINER functions: revoke EXECUTE from public roles
REVOKE EXECUTE ON FUNCTION public.issue_credential(uuid, uuid, jsonb, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rl_check(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- submit_attestation is called by authenticated users from the app, keep authenticated EXECUTE
REVOKE EXECUTE ON FUNCTION public.submit_attestation(uuid, text, text, attester_relationship, text, numeric, text, text, text) FROM PUBLIC, anon;

-- has_role is used inside RLS policies; authenticated must keep EXECUTE
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
