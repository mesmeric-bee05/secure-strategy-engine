-- Tighten WITH CHECK (TRUE) policies — these tables write through service-role server functions only

DROP POLICY IF EXISTS "attestations_insert" ON public.attestations;
DROP POLICY IF EXISTS "credentials_insert" ON public.credential_anchors;
DROP POLICY IF EXISTS "audit_insert" ON public.audit_log;
DROP POLICY IF EXISTS "fairness_insert" ON public.fairness_audits;

-- Make rate_limits explicitly inaccessible to anyone except service role
CREATE POLICY "rate_limits_no_access" ON public.rate_limits FOR SELECT USING (FALSE);

-- Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;