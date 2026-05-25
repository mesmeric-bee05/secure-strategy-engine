
CREATE TABLE public.passkeys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] NOT NULL DEFAULT '{}',
  device_label TEXT,
  backed_up BOOLEAN NOT NULL DEFAULT false,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_passkeys_user ON public.passkeys(user_id);

ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY passkeys_owner_read ON public.passkeys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY passkeys_owner_insert ON public.passkeys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY passkeys_owner_delete ON public.passkeys FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY passkeys_owner_update ON public.passkeys FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.webauthn_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  challenge TEXT NOT NULL,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('registration','authentication')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webauthn_challenges_user ON public.webauthn_challenges(user_id);
CREATE INDEX idx_webauthn_challenges_email ON public.webauthn_challenges(email);
CREATE INDEX idx_webauthn_challenges_expires ON public.webauthn_challenges(expires_at);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY webauthn_challenges_no_access ON public.webauthn_challenges FOR SELECT USING (false);
