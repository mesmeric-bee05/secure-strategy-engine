// Build dashboard content, ported from the master HTML brief.
// Pure data — no runtime side effects. Safe for SSR.

export type PhaseTone = "blue" | "teal" | "purple" | "amber" | "coral" | "green";
export type PhaseStatus = "shipped" | "in-progress" | "planned";

export interface Phase {
  num: number;
  tone: PhaseTone;
  title: string;
  time: string;
  status: PhaseStatus;
  tasks: { label: string; detail: string }[];
}

export const PHASES: Phase[] = [
  {
    num: 1,
    tone: "blue",
    title: "Foundation & scaffolding",
    time: "Hours 0–4",
    status: "shipped",
    tasks: [
      { label: "Repo setup", detail: "TanStack Start monorepo with routes, server fns, edge functions" },
      { label: "CI pipeline", detail: "GitHub Actions: lint, typecheck, unit, e2e, security regression" },
      { label: "Env config", detail: ".env.example with all required keys documented" },
      { label: "Database", detail: "Migrations for users, skills, attestations, credentials, audit_log + pgvector" },
      { label: "Auth skeleton", detail: "Supabase JWT + RLS gate via _authenticated layout" },
    ],
  },
  {
    num: 2,
    tone: "teal",
    title: "Core AI pipeline",
    time: "Hours 4–14",
    status: "shipped",
    tasks: [
      { label: "Skill extractor", detail: "Lovable AI Gateway, multimodal portfolio analysis" },
      { label: "Embedding engine", detail: "pgvector store for skills + opportunities" },
      { label: "Opportunity matcher", detail: "Cosine similarity ranking, sub-200ms top-K" },
      { label: "Match explanation", detail: "Edge function returns citations + reasoning" },
      { label: "Scoring engine", detail: "AI confidence + attestation weight + assessment" },
      { label: "Bias auditor", detail: "fairness_audits table tracks group deviation > 15%" },
    ],
  },
  {
    num: 3,
    tone: "purple",
    title: "Trust & credential layer",
    time: "Hours 14–22",
    status: "in-progress",
    tasks: [
      { label: "Attestation system", detail: "submit_attestation SECURITY DEFINER, rate-limited, audited" },
      { label: "Three-attestation rule", detail: "Auto-promote skill once weighted trust ≥ threshold" },
      { label: "Credential issuance", detail: "issue_credential RPC writes credential_anchors + audit row" },
      { label: "Public verifier", detail: "/credential/$id reads via service-role server fn, curated DTO" },
      { label: "QR + share link", detail: "Built into the verifier route" },
      { label: "On-chain anchor", detail: "Planned — soulbound ERC-721 on a low-cost L2" },
    ],
  },
  {
    num: 4,
    tone: "amber",
    title: "Frontend — mobile-first PWA",
    time: "Hours 22–34",
    status: "shipped",
    tasks: [
      { label: "Skill dashboard", detail: "/skills with import, audit log, drafts, retry" },
      { label: "Opportunity feed", detail: "/opportunities with ranked match cards" },
      { label: "Opportunity map", detail: "/opportunities/map with consent-gated geolocation" },
      { label: "Pathway planner", detail: "/readiness with AI explanation + citations" },
      { label: "Multilingual", detail: "i18next: en, sw, fr, ha — locked by build-gate tests" },
      { label: "Offline & errors", detail: "RouteErrorBoundary, RestoredBanner, LastErrorPanel" },
    ],
  },
  {
    num: 5,
    tone: "coral",
    title: "Security hardening",
    time: "Hours 34–40",
    status: "shipped",
    tasks: [
      { label: "Passkeys", detail: "WebAuthn registration + auth, recovery + e2e retry coverage" },
      { label: "Rate limiting", detail: "rl_check SECURITY DEFINER, fail-closed, per-action buckets" },
      { label: "Input sanitization", detail: "Zod schemas + redact helpers on every server fn" },
      { label: "Prompt-injection guard", detail: "30+ patterns, applied before any LLM call" },
      { label: "CSP + HSTS + headers", detail: "public/_headers + meta-tag fallbacks" },
      { label: "Audit log", detail: "Append-only, no_write policy, RLS-locked reads" },
    ],
  },
  {
    num: 6,
    tone: "green",
    title: "Polish, seed data & demo prep",
    time: "Hours 40–48",
    status: "in-progress",
    tasks: [
      { label: "Demo personas", detail: "Sarah, James, Amara, Kwame seeded in fixtures" },
      { label: "Error handling", detail: "Graceful fallbacks on every async path" },
      { label: "Loading states", detail: "Skeletons over spinners" },
      { label: "Visual regression", detail: "Playwright matrix: 4 locales × 8 pages × 2 viewports" },
      { label: "README + docs", detail: "docs/roadmap/ extracted from the architecture brief" },
    ],
  },
];

export interface StackItem {
  name: string;
  why: string;
}
export interface StackCategory {
  category: string;
  tone: PhaseTone;
  items: StackItem[];
}

export const STACK: StackCategory[] = [
  {
    category: "Frontend",
    tone: "blue",
    items: [
      { name: "TanStack Start", why: "SSR + file-based routing" },
      { name: "React 19 + Vite 7", why: "Fast HMR, Suspense data loading" },
      { name: "TypeScript strict", why: "Type-safe RPC end-to-end" },
      { name: "Tailwind v4", why: "@theme tokens, CSS-first" },
      { name: "shadcn/ui", why: "Accessible primitives" },
      { name: "i18next", why: "en / sw / fr / ha" },
    ],
  },
  {
    category: "Backend",
    tone: "teal",
    items: [
      { name: "Supabase (Lovable Cloud)", why: "Postgres + Auth + Storage" },
      { name: "RLS + GRANT", why: "Per-table, per-role authorisation" },
      { name: "Server functions", why: "createServerFn typed RPC" },
      { name: "Edge functions", why: "Webhook & AI surface only" },
      { name: "pgvector", why: "Skill + opportunity embeddings" },
      { name: "pg_cron", why: "Scheduled fairness audits" },
    ],
  },
  {
    category: "AI / ML",
    tone: "purple",
    items: [
      { name: "Lovable AI Gateway", why: "No key, multi-provider" },
      { name: "Multimodal extractor", why: "Image + text portfolio" },
      { name: "Match explainer", why: "Cited reasoning per match" },
      { name: "Prompt guard", why: "Injection patterns blocked" },
      { name: "Fairness auditor", why: ">15% deviation triggers review" },
    ],
  },
  {
    category: "Security & Infra",
    tone: "coral",
    items: [
      { name: "WebAuthn passkeys", why: "Phishing-resistant primary auth" },
      { name: "Rate limit (rl_check)", why: "Per-user, per-action" },
      { name: "Audit log", why: "Append-only, no_write policy" },
      { name: "CSP + HSTS", why: "Defence-in-depth headers" },
      { name: "Cloudflare edge", why: "Workers, CDN, DDoS" },
      { name: "GitHub Actions", why: "Tests + security regression" },
    ],
  },
];

export interface Feature {
  num: number;
  title: string;
  desc: string;
  route?: string;
  status: PhaseStatus;
}

export const FEATURES: Feature[] = [
  { num: 1, title: "Multimodal skill portfolio builder", desc: "Drop images, text, or paste links. AI extracts structured skills mapped to ISCO-08.", route: "/skills", status: "shipped" },
  { num: 2, title: "AI adaptive skill assessment", desc: "Generates custom challenges for skills without portfolio evidence.", route: "/readiness", status: "in-progress" },
  { num: 3, title: "Cryptographic peer attestation", desc: "Invite past employers / teachers to attest. ECDSA-signed, three-of-N to verify.", route: "/trust-graph", status: "in-progress" },
  { num: 4, title: "Verifiable credential link", desc: "Each verified skill gets a sharable verifier route. Curated DTO, no PII leak.", route: "/credential/demo", status: "shipped" },
  { num: 5, title: "Semantic opportunity matching", desc: "pgvector cosine similarity, sub-200ms top-K, re-ranked by salary + location.", route: "/opportunities", status: "shipped" },
  { num: 6, title: "AI career pathway planner", desc: "Identifies skill gaps for a target opportunity and proposes a learning roadmap.", route: "/readiness", status: "shipped" },
  { num: 7, title: "Offline-first PWA shell", desc: "Local-first drafts, restored banner, error boundaries on every route.", status: "in-progress" },
  { num: 8, title: "Cross-locale UX", desc: "Locale switcher persists across reloads; map + AI text follow it.", route: "/settings", status: "shipped" },
  { num: 9, title: "Fairness audit engine", desc: "Every batch of AI decisions reviewed for demographic parity; >15% deviation flagged.", status: "in-progress" },
  { num: 10, title: "Open API for institutions", desc: "Server fns expose curated query surfaces for partners.", status: "planned" },
];

export interface SecurityCheck {
  letter: string;
  tone: "red" | "amber" | "blue" | "teal" | "purple";
  title: string;
  desc: string;
  status: PhaseStatus;
}

export const SECURITY: SecurityCheck[] = [
  { letter: "A", tone: "red", title: "Passwordless authentication (WebAuthn)", desc: "Passkeys as primary auth. No plaintext passwords stored anywhere.", status: "shipped" },
  { letter: "T", tone: "red", title: "Short-lived JWT tokens", desc: "Supabase access tokens auto-rotate. attachSupabaseAuth re-attaches per RPC.", status: "shipped" },
  { letter: "R", tone: "amber", title: "Layered rate limiting", desc: "rl_check SECURITY DEFINER, per-user buckets, fail-closed.", status: "shipped" },
  { letter: "P", tone: "amber", title: "AI prompt-injection prevention", desc: "30+ pattern guard runs on every user-supplied prompt before LLM dispatch.", status: "shipped" },
  { letter: "E", tone: "blue", title: "Field-level redaction", desc: "redact helpers strip PII before logging or LLM context.", status: "shipped" },
  { letter: "I", tone: "blue", title: "Input validation", desc: "Zod inputValidator on every server fn. Parameterised SQL only via Supabase client.", status: "shipped" },
  { letter: "H", tone: "teal", title: "Security headers (CSP, HSTS, CORS)", desc: "Authoritative copies in public/_headers, meta-tag fallback in root route.", status: "shipped" },
  { letter: "L", tone: "teal", title: "Immutable audit log", desc: "audit_log has no_write deny policy; writes only via SECURITY DEFINER paths.", status: "shipped" },
  { letter: "C", tone: "purple", title: "Public credential verifier", desc: "Service-role read via curated DTO; RLS denies direct anon reads.", status: "shipped" },
];

export interface DashStat {
  label: string;
  value: string;
  tone: "gold" | "teal" | "coral" | "lavender";
}

export const STATS: DashStat[] = [
  { label: "Phases shipped", value: "4 / 6", tone: "gold" },
  { label: "Unit + E2E tests passing", value: "256", tone: "teal" },
  { label: "Locales shipped (build-gated)", value: "4", tone: "lavender" },
  { label: "Open critical scan findings", value: "0", tone: "coral" },
];
