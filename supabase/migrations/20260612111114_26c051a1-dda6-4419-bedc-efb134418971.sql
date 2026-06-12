
-- 1. Move pgvector out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER EXTENSION vector SET SCHEMA extensions;
ALTER ROLE anon          SET search_path = public, extensions;
ALTER ROLE authenticated SET search_path = public, extensions;
ALTER ROLE service_role  SET search_path = public, extensions;

-- 2. Harden has_role: reject null inputs
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _user_id IS NULL OR _role IS NULL THEN
    RAISE EXCEPTION 'has_role: _user_id and _role must not be null';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- 3. Harden submit_attestation: rate-limit, duplicate guard, length bounds, audit logging
CREATE OR REPLACE FUNCTION public.submit_attestation(
  _skill_id uuid,
  _attester_name text,
  _attester_email text,
  _relationship attester_relationship,
  _attestation_text text,
  _trust_weight numeric,
  _ecdsa_signature text,
  _attester_pubkey text,
  _payload_hash text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _skill_owner UUID;
  _new_id UUID;
  _w NUMERIC;
  _allowed BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'attestation requires an authenticated user';
  END IF;

  -- Length bounds for cryptographic fields (defense against payload bloat)
  IF coalesce(length(_ecdsa_signature), 0) NOT BETWEEN 1 AND 512
     OR coalesce(length(_attester_pubkey), 0) NOT BETWEEN 1 AND 512
     OR coalesce(length(_payload_hash), 0) NOT BETWEEN 1 AND 512 THEN
    INSERT INTO public.audit_log (action, actor_id, resource_type, resource_id, metadata)
      VALUES ('attestation_submit', auth.uid(), 'attestation', _skill_id::text,
              jsonb_build_object('outcome', 'invalid_crypto_field_length'));
    RAISE EXCEPTION 'invalid signature/pubkey/payload_hash length';
  END IF;

  -- Per-user hourly rate limit
  SELECT public.rl_check('attestation:submit', auth.uid()::text, 10, 3600) INTO _allowed;
  IF NOT _allowed THEN
    INSERT INTO public.audit_log (action, actor_id, resource_type, resource_id, metadata)
      VALUES ('attestation_submit', auth.uid(), 'attestation', _skill_id::text,
              jsonb_build_object('outcome', 'rate_limited'));
    RAISE EXCEPTION 'rate limit exceeded for attestation:submit';
  END IF;

  SELECT user_id INTO _skill_owner FROM public.skills WHERE id = _skill_id;
  IF _skill_owner IS NULL THEN
    INSERT INTO public.audit_log (action, actor_id, resource_type, resource_id, metadata)
      VALUES ('attestation_submit', auth.uid(), 'attestation', _skill_id::text,
              jsonb_build_object('outcome', 'skill_not_found'));
    RAISE EXCEPTION 'skill not found';
  END IF;

  IF _skill_owner = auth.uid() THEN
    INSERT INTO public.audit_log (action, actor_id, resource_type, resource_id, metadata)
      VALUES ('attestation_submit', auth.uid(), 'attestation', _skill_id::text,
              jsonb_build_object('outcome', 'self_attestation_rejected'));
    RAISE EXCEPTION 'cannot attest your own skill';
  END IF;

  -- One attestation per attester per skill
  IF EXISTS (
    SELECT 1 FROM public.attestations
    WHERE attester_id = auth.uid() AND skill_id = _skill_id
  ) THEN
    INSERT INTO public.audit_log (action, actor_id, resource_type, resource_id, metadata)
      VALUES ('attestation_submit', auth.uid(), 'attestation', _skill_id::text,
              jsonb_build_object('outcome', 'duplicate_rejected'));
    RAISE EXCEPTION 'duplicate attestation for this skill';
  END IF;

  _w := LEAST(GREATEST(COALESCE(_trust_weight, 1.0), 0), 1.0);

  INSERT INTO public.attestations (
    skill_id, skill_owner_id, attester_id, attester_name, attester_email,
    relationship, attestation_text, trust_weight, ecdsa_signature,
    attester_pubkey, payload_hash
  ) VALUES (
    _skill_id, _skill_owner, auth.uid(),
    LEFT(COALESCE(_attester_name, ''), 200),
    NULLIF(LEFT(COALESCE(_attester_email, ''), 200), ''),
    _relationship,
    LEFT(COALESCE(_attestation_text, ''), 1000),
    _w, _ecdsa_signature, _attester_pubkey, _payload_hash
  )
  RETURNING id INTO _new_id;

  UPDATE public.skills s
     SET attestation_count = attestation_count + 1,
         attestation_weight_sum = attestation_weight_sum + _w,
         is_verified = (attestation_weight_sum + _w) >= 2.5,
         updated_at = NOW()
   WHERE s.id = _skill_id;

  INSERT INTO public.audit_log (action, actor_id, resource_type, resource_id, metadata)
    VALUES ('attestation_submit', auth.uid(), 'attestation', _new_id::text,
            jsonb_build_object('outcome', 'ok',
                               'skill_id', _skill_id,
                               'relationship', _relationship,
                               'trust_weight', _w));

  RETURN _new_id;
END;
$$;

-- Re-apply EXECUTE grants per security baseline
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_attestation(uuid, text, text, attester_relationship, text, numeric, text, text, text) FROM PUBLIC, anon;
