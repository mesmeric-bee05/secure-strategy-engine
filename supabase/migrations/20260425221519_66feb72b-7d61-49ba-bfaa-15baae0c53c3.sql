-- 1. Sliding-window rate limiter -----------------------------------------
CREATE OR REPLACE FUNCTION public.rl_check(
  _bucket TEXT,
  _identifier TEXT,
  _limit INT,
  _window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start TIMESTAMPTZ := date_trunc('second', NOW()) - make_interval(secs => _window_seconds);
  _count INT;
BEGIN
  -- Purge old buckets opportunistically (cheap; bounded by unique keys)
  DELETE FROM public.rate_limits
   WHERE bucket = _bucket
     AND identifier = _identifier
     AND window_start < _window_start;

  SELECT COALESCE(SUM(request_count), 0) INTO _count
    FROM public.rate_limits
   WHERE bucket = _bucket
     AND identifier = _identifier
     AND window_start >= _window_start;

  IF _count >= _limit THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limits (bucket, identifier, window_start, request_count)
  VALUES (_bucket, _identifier, date_trunc('second', NOW()), 1)
  ON CONFLICT (bucket, identifier, window_start)
  DO UPDATE SET request_count = public.rate_limits.request_count + 1;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.rl_check(TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rl_check(TEXT, TEXT, INT, INT) TO service_role;

-- 2. Credential issuance (server-only via service role) ------------------
CREATE OR REPLACE FUNCTION public.issue_credential(
  _skill_id UUID,
  _user_id UUID,
  _payload JSONB,
  _payload_hash TEXT,
  _platform_signature TEXT,
  _signing_key_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id UUID;
BEGIN
  INSERT INTO public.credential_anchors (
    skill_id, user_id, payload, payload_hash, platform_signature, signing_key_id
  ) VALUES (
    _skill_id, _user_id, _payload, _payload_hash, _platform_signature, _signing_key_id
  )
  RETURNING id INTO _new_id;
  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_credential(UUID, UUID, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_credential(UUID, UUID, JSONB, TEXT, TEXT, TEXT) TO service_role;

-- 3. Attestation submission ----------------------------------------------
-- A signed-in user can attest a skill that is not theirs. Trust weight is
-- clamped to <= 1.0 server-side.
CREATE OR REPLACE FUNCTION public.submit_attestation(
  _skill_id UUID,
  _attester_name TEXT,
  _attester_email TEXT,
  _relationship public.attester_relationship,
  _attestation_text TEXT,
  _trust_weight NUMERIC,
  _ecdsa_signature TEXT,
  _attester_pubkey TEXT,
  _payload_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _skill_owner UUID;
  _new_id UUID;
  _w NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'attestation requires an authenticated user';
  END IF;

  SELECT user_id INTO _skill_owner FROM public.skills WHERE id = _skill_id;
  IF _skill_owner IS NULL THEN
    RAISE EXCEPTION 'skill not found';
  END IF;

  IF _skill_owner = auth.uid() THEN
    RAISE EXCEPTION 'cannot attest your own skill';
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

  -- Promote skill if accumulated trust weight crosses threshold
  UPDATE public.skills s
     SET attestation_count = attestation_count + 1,
         attestation_weight_sum = attestation_weight_sum + _w,
         is_verified = (attestation_weight_sum + _w) >= 2.5,
         updated_at = NOW()
   WHERE s.id = _skill_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_attestation(UUID, TEXT, TEXT, public.attester_relationship, TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_attestation(UUID, TEXT, TEXT, public.attester_relationship, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;