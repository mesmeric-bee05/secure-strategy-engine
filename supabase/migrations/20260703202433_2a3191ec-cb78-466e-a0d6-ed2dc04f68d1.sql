-- Tighten profiles read: only the owner can select their profile
DROP POLICY IF EXISTS profiles_authenticated_read ON public.profiles;
CREATE POLICY profiles_self_read
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Tighten skills read: only the owner can select; verified-skill public
-- discovery goes through server functions that use the service role.
DROP POLICY IF EXISTS skills_owner_read ON public.skills;
CREATE POLICY skills_self_read
  ON public.skills
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Explicit deny-write policies on webauthn_challenges (defense-in-depth).
-- All writes must go through SECURITY DEFINER server paths using the
-- service role, which bypasses RLS.
DROP POLICY IF EXISTS webauthn_challenges_no_insert ON public.webauthn_challenges;
DROP POLICY IF EXISTS webauthn_challenges_no_update ON public.webauthn_challenges;
DROP POLICY IF EXISTS webauthn_challenges_no_delete ON public.webauthn_challenges;

CREATE POLICY webauthn_challenges_no_insert
  ON public.webauthn_challenges
  FOR INSERT
  TO public
  WITH CHECK (false);

CREATE POLICY webauthn_challenges_no_update
  ON public.webauthn_challenges
  FOR UPDATE
  TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY webauthn_challenges_no_delete
  ON public.webauthn_challenges
  FOR DELETE
  TO public
  USING (false);