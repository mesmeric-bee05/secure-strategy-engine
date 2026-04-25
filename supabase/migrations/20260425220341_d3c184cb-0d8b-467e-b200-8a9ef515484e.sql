-- =========================================================================
-- TalentGraph Africa — initial schema
-- World Bank Challenge 5 (Unmapped)
-- =========================================================================

-- Extensions ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums --------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'attestor', 'user');
CREATE TYPE public.skill_category AS ENUM ('technical','creative','trade','business','interpersonal','digital','agriculture','service');
CREATE TYPE public.evidence_strength AS ENUM ('weak','moderate','strong','exceptional');
CREATE TYPE public.attester_relationship AS ENUM ('employer','teacher','colleague','client','community_leader','peer');

-- =========================================================================
-- profiles
-- =========================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  country_code CHAR(2),
  region TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  gender TEXT,
  age_band TEXT,
  ecdsa_public_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, country_code, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'country_code', 'KE'),
    COALESCE(NEW.raw_user_meta_data ->> 'preferred_language', 'en')
  );
  -- Default role: user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- =========================================================================
-- user_roles  (separate table - never on profile)
-- =========================================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Trigger after user_roles exists
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- countries  (curated reference data — public)
-- =========================================================================
CREATE TABLE public.countries (
  code CHAR(2) PRIMARY KEY,
  name TEXT NOT NULL,
  flag_emoji TEXT,
  region TEXT,
  currency CHAR(3),
  -- Real econometric figures
  youth_unemployment_pct NUMERIC(5,2),
  min_wage_monthly_usd NUMERIC(8,2),
  min_wage_local TEXT,
  informal_share_pct NUMERIC(5,2),
  human_capital_index NUMERIC(4,3),
  population_millions NUMERIC(7,2),
  -- LMIC automation calibration (Frey-Osborne discount)
  lmic_calibration NUMERIC(3,2) NOT NULL DEFAULT 0.65,
  -- Citations
  unemployment_source TEXT,
  wage_source TEXT,
  informal_source TEXT,
  hci_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "countries_public_read" ON public.countries FOR SELECT USING (TRUE);

-- =========================================================================
-- ISCO-08 taxonomy (reference — public)
-- =========================================================================
CREATE TABLE public.isco_taxonomy (
  isco_code CHAR(4) PRIMARY KEY,
  esco_code TEXT,
  title TEXT NOT NULL,
  category public.skill_category,
  description TEXT,
  major_group_code CHAR(1),
  major_group_title TEXT
);
ALTER TABLE public.isco_taxonomy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "isco_public_read" ON public.isco_taxonomy FOR SELECT USING (TRUE);

-- =========================================================================
-- Frey-Osborne automation scores (reference — public)
-- =========================================================================
CREATE TABLE public.frey_osborne_scores (
  isco_code CHAR(4) PRIMARY KEY REFERENCES public.isco_taxonomy(isco_code) ON DELETE CASCADE,
  automation_probability NUMERIC(4,3) NOT NULL,
  task_routine_share NUMERIC(4,3),
  task_cognitive_share NUMERIC(4,3),
  citation TEXT NOT NULL DEFAULT 'Frey & Osborne (2013), The Future of Employment'
);
ALTER TABLE public.frey_osborne_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "freyo_public_read" ON public.frey_osborne_scores FOR SELECT USING (TRUE);

-- =========================================================================
-- Wittgenstein education projections (reference — public)
-- =========================================================================
CREATE TABLE public.wittgenstein_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  country_code CHAR(2),
  year INT NOT NULL,
  no_schooling_pct NUMERIC(4,1),
  primary_pct NUMERIC(4,1),
  secondary_pct NUMERIC(4,1),
  tertiary_pct NUMERIC(4,1),
  scenario TEXT NOT NULL DEFAULT 'SSP2',
  citation TEXT NOT NULL DEFAULT 'Wittgenstein Centre for Demography & Global Human Capital (2023), SSP2 scenario',
  UNIQUE (region, country_code, year, scenario)
);
ALTER TABLE public.wittgenstein_projections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wittgenstein_public_read" ON public.wittgenstein_projections FOR SELECT USING (TRUE);

-- =========================================================================
-- Opportunities (job/gig postings — public read)
-- =========================================================================
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT,
  source_citation TEXT,
  title TEXT NOT NULL,
  employer TEXT,
  description TEXT,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  required_isco_codes TEXT[] NOT NULL DEFAULT '{}',
  salary_min INT,
  salary_max INT,
  currency CHAR(3) DEFAULT 'USD',
  salary_period TEXT DEFAULT 'month',
  is_remote BOOLEAN NOT NULL DEFAULT FALSE,
  country_code CHAR(2),
  location TEXT,
  growth_pct NUMERIC(4,1),
  embedding vector(384),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opportunities_public_read" ON public.opportunities FOR SELECT USING (TRUE);
CREATE INDEX idx_opportunities_country ON public.opportunities(country_code);

-- =========================================================================
-- Personas (demo seed personas — public read)
-- =========================================================================
CREATE TABLE public.personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  emoji TEXT,
  occupation TEXT,
  location TEXT,
  country_code CHAR(2),
  description TEXT,
  prefill_text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personas_public_read" ON public.personas FOR SELECT USING (TRUE);

-- =========================================================================
-- Skills
-- =========================================================================
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  isco_code CHAR(4),
  esco_code TEXT,
  category public.skill_category,
  proficiency_level SMALLINT CHECK (proficiency_level BETWEEN 1 AND 10),
  years_of_practice NUMERIC(4,1),
  evidence_strength public.evidence_strength,
  ai_confidence_score NUMERIC(3,2),
  attestation_count INT NOT NULL DEFAULT 0,
  attestation_weight_sum NUMERIC(5,2) NOT NULL DEFAULT 0,
  assessment_score NUMERIC(5,2),
  composite_score NUMERIC(5,2),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  market_relevance TEXT,
  observations TEXT,
  embedding vector(384),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skills_owner_read" ON public.skills FOR SELECT
  USING (auth.uid() = user_id OR is_verified = TRUE);
CREATE POLICY "skills_owner_insert" ON public.skills FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "skills_owner_update" ON public.skills FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "skills_owner_delete" ON public.skills FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_skills_user ON public.skills(user_id);
CREATE INDEX idx_skills_isco ON public.skills(isco_code);

-- =========================================================================
-- portfolio_items
-- =========================================================================
CREATE TABLE public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('text','image','link','github','video','voice')),
  title TEXT,
  storage_url TEXT,
  raw_text TEXT,
  ai_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portfolio_owner_all" ON public.portfolio_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- attestations  (append-only)
-- =========================================================================
CREATE TABLE public.attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  skill_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attester_id UUID REFERENCES auth.users(id),
  attester_name TEXT NOT NULL,
  attester_email TEXT,
  relationship public.attester_relationship NOT NULL,
  attestation_text TEXT,
  trust_weight NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  ecdsa_signature TEXT NOT NULL,
  attester_pubkey TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.attestations ENABLE ROW LEVEL SECURITY;

-- Skill owner can read attestations on their skills; attester can read theirs; verified credential context allows public read for verifier
CREATE POLICY "attestations_read" ON public.attestations FOR SELECT
  USING (auth.uid() = skill_owner_id OR auth.uid() = attester_id OR EXISTS (
    SELECT 1 FROM public.skills s WHERE s.id = skill_id AND s.is_verified = TRUE
  ));
CREATE POLICY "attestations_insert" ON public.attestations FOR INSERT
  WITH CHECK (TRUE); -- creation goes through server function with validation
-- NO update / delete policies → append-only

CREATE INDEX idx_attestations_skill ON public.attestations(skill_id);

-- =========================================================================
-- credential_anchors  (append-only, public verifiable)
-- =========================================================================
CREATE TABLE public.credential_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  platform_signature TEXT NOT NULL,
  signing_key_id TEXT NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_reason TEXT,
  revoked_at TIMESTAMPTZ,
  anchored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.credential_anchors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credentials_public_read" ON public.credential_anchors FOR SELECT USING (TRUE);
CREATE POLICY "credentials_insert" ON public.credential_anchors FOR INSERT WITH CHECK (TRUE);
-- NO update / delete

CREATE INDEX idx_credentials_skill ON public.credential_anchors(skill_id);

-- =========================================================================
-- audit_log  (append-only, admin-only read)
-- =========================================================================
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_read" ON public.audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audit_insert" ON public.audit_log FOR INSERT WITH CHECK (TRUE);
-- NO update / delete

-- =========================================================================
-- fairness_audits
-- =========================================================================
CREATE TABLE public.fairness_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_label TEXT NOT NULL,
  decisions_count INT NOT NULL,
  overall_approval_rate NUMERIC(4,3),
  group_rates JSONB NOT NULL,
  max_deviation NUMERIC(4,3),
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  reviewer_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.fairness_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fairness_admin_read" ON public.fairness_audits FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "fairness_insert" ON public.fairness_audits FOR INSERT WITH CHECK (TRUE);

-- =========================================================================
-- rate_limits
-- =========================================================================
CREATE TABLE public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INT NOT NULL DEFAULT 1,
  UNIQUE (bucket, identifier, window_start)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No public policies — accessed only by service role server functions

-- =========================================================================
-- Updated-at trigger helper
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_skills_updated BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();