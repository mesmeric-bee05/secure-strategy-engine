import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";
import { CitationsPanel } from "@/components/CitationsPanel";
import { useQuery } from "@tanstack/react-query";
import { getCitations } from "@/server/citations.functions";
import { listCountries } from "@/server/opportunities.functions";
import {
  ArrowRight,
  BookOpen,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { z } from "zod";

const SearchSchema = z.object({
  persona: z.enum(["sarah", "james", "amara", "kwame"]).optional().catch(undefined),
  country: z.string().length(2).optional().catch(undefined),
});

export const Route = createFileRoute("/readiness")({
  validateSearch: SearchSchema,
  head: () => ({
    meta: [
      {
        title: "AI Readiness Lens — Frey-Osborne automation risk · TalentGraph",
      },
      {
        name: "description",
        content:
          "Per-skill automation risk based on Frey & Osborne (2013), calibrated for LMIC context, with Wittgenstein 2025-2035 education projections.",
      },
      {
        property: "og:title",
        content: "AI Readiness Lens · TalentGraph Africa",
      },
      {
        property: "og:description",
        content:
          "See your displacement risk and durable-skill paths, grounded in published research.",
      },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({
      queryKey: ["citations", null],
      queryFn: () => getCitations({ data: {} }),
    });
    void context.queryClient.prefetchQuery({
      queryKey: ["countries"],
      queryFn: () => listCountries(),
    });
  },
  component: ReadinessPage,
});

/* ── Frey-Osborne automation probabilities by ISCO-08 4-digit code ── */
const FREY_OSBORNE: Record<string, number> = {
  "7531": 0.57,
  "7318": 0.62,
  "5223": 0.92,
  "7411": 0.57,
  "7421": 0.51,
  "5230": 0.65,
  "3322": 0.45,
  "6111": 0.54,
  "6121": 0.6,
  "1439": 0.16,
  "2521": 0.25,
  "3142": 0.35,
  "7516": 0.63,
  "3331": 0.59,
  "4321": 0.72,
  "2643": 0.38,
  "2431": 0.67,
  "2359": 0.03,
  "3152": 0.41,
  "8322": 0.86,
  "2166": 0.21,
  "5141": 0.33,
};

const LMIC_CALIBRATION: Record<string, number> = {
  KE: 0.78,
  GH: 0.8,
  NG: 0.72,
  RW: 0.7,
  ZA: 0.85,
};
const DEFAULT_LMIC_FACTOR = 0.78;

/* ── Persona skill seeds — maps to ISCO codes ── */
interface PersonaSkillSeed {
  name: string;
  emoji: string;
  country: string;
  skills: Array<{
    name: string;
    isco: string;
    category: string;
    level: number;
  }>;
  adjacentSkills: Array<{
    name: string;
    impact: string;
    desc: string;
    isco?: string;
  }>;
  resources: Array<{
    name: string;
    provider: string;
    duration: string;
    cost: string;
  }>;
}

const PERSONA_SEEDS: Record<string, PersonaSkillSeed> = {
  sarah: {
    name: "Sarah, 22",
    emoji: "🧵",
    country: "KE",
    skills: [
      { name: "Garment construction & tailoring", isco: "7531", category: "trade", level: 9 },
      { name: "Hand embroidery & beadwork", isco: "7318", category: "creative", level: 9 },
      { name: "Pattern making & design", isco: "7531", category: "technical", level: 8 },
      { name: "Small business management", isco: "1439", category: "business", level: 6 },
      { name: "Customer negotiation", isco: "3322", category: "interpersonal", level: 7 },
    ],
    adjacentSkills: [
      {
        name: "Digital pattern design (CAD)",
        impact: "+34%",
        desc: "Lectra, Optitex — remote-compatible, high demand from export garment sector",
        isco: "2166",
      },
      {
        name: "E-commerce operations",
        impact: "+28%",
        desc: "Sell on Jumia, Kilimall, Etsy. +22.5%/yr growth in Sub-Saharan Africa",
      },
      {
        name: "Quality control & audit",
        impact: "+41%",
        desc: "ISCO-3152. Requires human tactile judgment — highly durable across automation cycles",
        isco: "3152",
      },
      {
        name: "Small business finance",
        impact: "+22%",
        desc: "Bookkeeping, M-Pesa business accounts, microfinance navigation",
      },
    ],
    resources: [
      {
        name: "Lectra Academy — Pattern Design",
        provider: "Lectra",
        duration: "Self-paced",
        cost: "Free trial",
      },
      { name: "Jumia Seller Academy", provider: "Jumia", duration: "2 weeks", cost: "Free" },
      {
        name: "Google Digital Skills for Africa",
        provider: "Google",
        duration: "Self-paced",
        cost: "Free",
      },
    ],
  },
  james: {
    name: "James, 28",
    emoji: "🔧",
    country: "KE",
    skills: [
      { name: "Smartphone & tablet repair", isco: "7421", category: "technical", level: 9 },
      { name: "Micro-soldering & board repair", isco: "7421", category: "technical", level: 8 },
      { name: "Data recovery", isco: "2521", category: "digital", level: 7 },
      { name: "Shop operations & management", isco: "1439", category: "business", level: 6 },
      { name: "Self-directed learning", isco: "2359", category: "interpersonal", level: 8 },
    ],
    adjacentSkills: [
      {
        name: "CompTIA A+ Certification",
        impact: "+38%",
        desc: "Formal credential unlocks corporate helpdesk and IT support roles",
      },
      {
        name: "Android ROM development",
        impact: "+31%",
        desc: "Software side — remote gig work, XDA Developers community",
      },
      {
        name: "IoT device servicing",
        impact: "+26%",
        desc: "Growing market in smart home, security systems — leverages existing soldering skills",
      },
      {
        name: "Technical training delivery",
        impact: "+19%",
        desc: "Train other technicians — ISCO-2359, lowest automation risk of any occupation",
      },
    ],
    resources: [
      {
        name: "Professor Messer — CompTIA A+",
        provider: "Professor Messer",
        duration: "Self-paced",
        cost: "Free",
      },
      {
        name: "ALX Africa — Software Engineering",
        provider: "ALX",
        duration: "12 months",
        cost: "Free (scholarship)",
      },
      {
        name: "XDA Developers — ROM Development",
        provider: "XDA",
        duration: "Self-paced",
        cost: "Free",
      },
    ],
  },
  amara: {
    name: "Amara, 34",
    emoji: "🌾",
    country: "NG",
    skills: [
      { name: "Smallholder crop production", isco: "6111", category: "agriculture", level: 8 },
      { name: "Agricultural cooperative leadership", isco: "1439", category: "business", level: 8 },
      { name: "Post-harvest processing", isco: "7516", category: "trade", level: 7 },
      { name: "Soil testing & agronomy", isco: "3142", category: "technical", level: 6 },
      { name: "Training & knowledge transfer", isco: "2359", category: "interpersonal", level: 7 },
    ],
    adjacentSkills: [
      {
        name: "Digital farm record keeping",
        impact: "+32%",
        desc: "WeFarm, FarmDrive — cooperative becomes investable, unlocks microfinance",
      },
      {
        name: "Export market standards (GLOBALG.A.P)",
        impact: "+44%",
        desc: "Access EU export premiums for certified produce — huge salary uplift",
      },
      {
        name: "Precision agriculture basics",
        impact: "+27%",
        desc: "Soil sensors, drone monitoring — growing adoption in Nigeria",
      },
      {
        name: "Value chain coordination",
        impact: "+23%",
        desc: "Market linkage, buyer negotiation — builds on existing cooperative skills",
      },
    ],
    resources: [
      {
        name: "WeFarm — Digital Farming",
        provider: "WeFarm",
        duration: "Self-paced",
        cost: "Free (SMS & app)",
      },
      {
        name: "FAO e-learning — Good Agricultural Practices",
        provider: "FAO",
        duration: "6 weeks",
        cost: "Free",
      },
      {
        name: "Coursera — Financial Accounting",
        provider: "University of Illinois",
        duration: "Self-paced",
        cost: "Free (audit)",
      },
    ],
  },
  kwame: {
    name: "Kwame, 26",
    emoji: "🛒",
    country: "GH",
    skills: [
      {
        name: "International trade & import operations",
        isco: "3322",
        category: "business",
        level: 8,
      },
      { name: "Customs clearance & logistics", isco: "3331", category: "technical", level: 8 },
      { name: "Inventory & stock management", isco: "4321", category: "technical", level: 7 },
      { name: "Multilingual communication", isco: "2643", category: "interpersonal", level: 7 },
      { name: "Social commerce & marketing", isco: "2431", category: "digital", level: 6 },
    ],
    adjacentSkills: [
      {
        name: "Formal customs brokerage license",
        impact: "+36%",
        desc: "Ghana Revenue Authority — unlock B2B contracts with major importers",
      },
      {
        name: "Supply chain management",
        impact: "+33%",
        desc: "Coursera (Rutgers) — transition from trader to supply chain professional",
      },
      {
        name: "Digital marketing certification",
        impact: "+25%",
        desc: "Google Ads, Meta Business Suite — scale social commerce professionally",
      },
      {
        name: "Trade finance & letters of credit",
        impact: "+29%",
        desc: "Banking relationships — access larger import volumes",
      },
    ],
    resources: [
      {
        name: "Coursera — Supply Chain Management",
        provider: "Rutgers University",
        duration: "Self-paced",
        cost: "Free (audit)",
      },
      {
        name: "Google Digital Skills for Africa",
        provider: "Google",
        duration: "Self-paced",
        cost: "Free",
      },
      {
        name: "ILO Skills Academy — Labor Standards",
        provider: "ILO",
        duration: "4 weeks",
        cost: "Free",
      },
    ],
  },
};

/* ── Wittgenstein Centre SSP2 education projections ── */
const WITTGENSTEIN: Record<string, { primary: number[]; secondary: number[]; tertiary: number[] }> =
  {
    KE: {
      primary: [38, 36, 34, 31, 29],
      secondary: [46, 48, 50, 52, 53],
      tertiary: [16, 16, 16, 17, 18],
    },
    GH: {
      primary: [32, 30, 28, 26, 24],
      secondary: [52, 53, 54, 56, 57],
      tertiary: [16, 17, 18, 18, 19],
    },
    NG: {
      primary: [45, 43, 40, 37, 35],
      secondary: [44, 45, 47, 49, 51],
      tertiary: [11, 12, 13, 14, 14],
    },
    RW: {
      primary: [41, 39, 36, 33, 30],
      secondary: [51, 53, 55, 58, 60],
      tertiary: [8, 8, 9, 9, 10],
    },
    ZA: {
      primary: [18, 17, 15, 14, 13],
      secondary: [55, 56, 57, 58, 58],
      tertiary: [27, 27, 28, 28, 29],
    },
  };
const PROJ_YEARS = [2025, 2027, 2029, 2031, 2035];

function ReadinessPage() {
  const search = Route.useSearch();
  const selectedPersona = search.persona ?? "sarah";
  const persona = PERSONA_SEEDS[selectedPersona] ?? PERSONA_SEEDS.sarah;
  const countryCode = search.country ?? persona.country;
  const lmicFactor = LMIC_CALIBRATION[countryCode] ?? DEFAULT_LMIC_FACTOR;

  const citationsQ = useQuery({
    queryKey: ["citations", null],
    queryFn: () => getCitations({ data: {} }),
  });
  const countriesQ = useQuery({
    queryKey: ["countries"],
    queryFn: () => listCountries(),
  });

  const currentCountry = (countriesQ.data ?? []).find((c) => c.code === countryCode);

  const riskData = useMemo(() => {
    return persona.skills.map((s) => {
      const raw = FREY_OSBORNE[s.isco] ?? 0.45;
      const calibrated = raw * lmicFactor;
      return {
        ...s,
        rawRisk: raw,
        calibratedRisk: calibrated,
        durable: calibrated < 0.35,
      };
    });
  }, [persona.skills, lmicFactor]);

  const compositeRisk = useMemo(() => {
    if (riskData.length === 0) return 0;
    return riskData.reduce((a, r) => a + r.calibratedRisk, 0) / riskData.length;
  }, [riskData]);

  const durableCount = riskData.filter((r) => r.durable).length;
  const highRiskCount = riskData.filter((r) => r.calibratedRisk >= 0.5).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        <PageTitle
          module="Module 02"
          eyebrow="AI Readiness & Displacement Risk Lens"
          description="Frey & Osborne (2013) automation probabilities calibrated for LMIC context. Wittgenstein Centre 2025-2035 education projections. Honest risk analysis with durable skill identification and adjacent skill roadmap."
        >
          Your automation risk profile
        </PageTitle>

        {/* Persona selector strip */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-tx-2">
            Analyzing:
          </span>
          {Object.entries(PERSONA_SEEDS).map(([slug, p]) => (
            <Link
              key={slug}
              to="/readiness"
              search={{ persona: slug as never }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                selectedPersona === slug
                  ? "border-gold bg-gold-soft text-gold"
                  : "border-border bg-bg-3 text-tx-1 hover:border-gold-glow hover:text-tx-0"
              }`}
            >
              <span>{p.emoji}</span> {p.name}
            </Link>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-5">
            {/* Gauge */}
            <div className="rounded-xl border border-border-soft bg-bg-3 p-5 text-center">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-tx-2">
                Composite Automation Risk
              </p>
              <GaugeChart value={compositeRisk} />
              <p className="mt-2 text-[13px] font-semibold text-tx-0">
                {compositeRisk < 0.35
                  ? "LOW automation risk — resilient profile"
                  : compositeRisk < 0.55
                    ? "MODERATE risk — targeted upskilling recommended"
                    : "HIGH risk — priority reskilling needed"}
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-semibold ${
                    compositeRisk < 0.35
                      ? "bg-teal-soft text-teal"
                      : compositeRisk < 0.55
                        ? "bg-gold-soft text-gold"
                        : "bg-coral-soft text-coral"
                  }`}
                >
                  {compositeRisk < 0.35 ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {Math.round(compositeRisk * 100)}% composite
                </span>
              </div>
              <p className="mt-3 font-mono text-[9px] text-tx-2">
                Source: Frey & Osborne (2013) · LMIC calibration ×{lmicFactor.toFixed(2)} (
                {countryCode})
              </p>
            </div>

            {/* LMIC calibration callout */}
            <div className="rounded-xl border border-gold/20 bg-gold-soft p-4">
              <div className="flex items-start gap-2.5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <div className="text-[11px] leading-relaxed text-tx-1">
                  <p className="mb-1 font-semibold text-tx-0">Why LMIC calibration matters</p>
                  <p>
                    Base Frey-Osborne scores assume US task composition and capital intensity. In
                    LMIC informal economies, lower capital costs vs. labor, infrastructure
                    constraints, and different task bundles mean automation arrives slower. We apply
                    a{" "}
                    <strong className="text-gold">
                      ×{lmicFactor.toFixed(2)} country-level multiplier
                    </strong>{" "}
                    for {currentCountry?.name ?? countryCode} (range: 0.70–0.85 depending on
                    infrastructure index).
                  </p>
                </div>
              </div>
            </div>

            {/* Summary stats strip */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border-soft bg-bg-4 p-3 text-center">
                <p className="font-mono text-[22px] font-bold text-teal">{durableCount}</p>
                <p className="text-[10px] text-tx-2">Durable skills</p>
              </div>
              <div className="rounded-lg border border-border-soft bg-bg-4 p-3 text-center">
                <p className="font-mono text-[22px] font-bold text-coral">{highRiskCount}</p>
                <p className="text-[10px] text-tx-2">At-risk skills</p>
              </div>
              <div className="rounded-lg border border-border-soft bg-bg-4 p-3 text-center">
                <p className="font-mono text-[22px] font-bold text-gold">
                  {persona.adjacentSkills.length}
                </p>
                <p className="text-[10px] text-tx-2">Adjacent paths</p>
              </div>
            </div>

            {/* Per-skill risk rows */}
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-tx-2">
                Per-Skill Risk Breakdown
              </p>
              <div className="flex flex-col gap-2">
                {riskData.map((r, i) => {
                  const pct = Math.round(r.calibratedRisk * 100);
                  const color =
                    r.calibratedRisk < 0.35 ? "teal" : r.calibratedRisk < 0.55 ? "gold" : "coral";
                  const colorClass =
                    color === "teal" ? "text-teal" : color === "gold" ? "text-gold" : "text-coral";
                  const barClass =
                    color === "teal" ? "bg-teal" : color === "gold" ? "bg-gold" : "bg-coral";
                  return (
                    <div
                      key={i}
                      className="anim-fade-in rounded-xl border border-border-soft bg-bg-3 p-3"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-tx-0">{r.name}</span>
                        <span className={`font-mono text-[12px] font-bold ${colorClass}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="mb-2 h-[5px] rounded-full bg-bg-4">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${barClass}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[9.5px] text-tx-2">
                        {r.durable && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2 py-0.5 font-semibold text-teal">
                            <Shield className="h-2.5 w-2.5" />
                            Durable
                          </span>
                        )}
                        <span>
                          ISCO-{r.isco} · {r.category} · Base: {Math.round(r.rawRisk * 100)}% →
                          LMIC-calibrated: {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex flex-col gap-5">
            {/* Projection chart */}
            <div className="rounded-xl border border-border-soft bg-bg-3 p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-tx-0">
                    Education Level Projections 2025–2035
                  </p>
                  <p className="font-mono text-[9.5px] text-tx-2">
                    Wittgenstein Centre SSP2 · {currentCountry?.name ?? countryCode} · 25-34 cohort
                  </p>
                </div>
                <span className="text-[9.5px] text-tx-2">% of pop.</span>
              </div>
              <ProjectionChart countryCode={countryCode} />
              <div className="mt-2 flex gap-4">
                <LegendDot color="bg-gold" label="Primary only" />
                <LegendDot color="bg-sky" label="Secondary" />
                <LegendDot color="bg-teal" label="Tertiary" />
              </div>
            </div>

            {/* Adjacent skills */}
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-tx-2">
                Adjacent Skills — Build Resilience
              </p>
              <div className="grid grid-cols-2 gap-2">
                {persona.adjacentSkills.map((adj, i) => (
                  <div
                    key={i}
                    className="anim-fade-in rounded-xl border border-border-soft bg-bg-3 p-3 transition hover:border-teal/40"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <p className="text-[12px] font-semibold text-tx-0">{adj.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] font-semibold text-teal">
                      {adj.impact} resilience
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-tx-2">{adj.desc}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 font-mono text-[9px] text-tx-2">
                Resilience scores from ILO Future of Work task-content indices · 40+ countries
              </p>
            </div>

            {/* Free learning resources */}
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.08em] text-tx-2">
                Free Learning Resources — Africa-Accessible
              </p>
              <div className="flex flex-col gap-2">
                {persona.resources.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border-soft bg-bg-4 p-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
                      <div>
                        <p className="text-[12px] font-semibold text-tx-0">{r.name}</p>
                        <p className="text-[10px] text-tx-2">
                          {r.provider} · {r.duration}
                        </p>
                      </div>
                    </div>
                    <span className="rounded bg-teal-soft px-2 py-0.5 font-mono text-[10px] font-bold text-teal">
                      {r.cost.toUpperCase()}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-lg border border-border-soft bg-bg-4 p-3">
                  <div className="flex items-start gap-2.5">
                    <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
                    <div>
                      <p className="text-[12px] font-semibold text-tx-0">
                        ILO Skills Academy — Labor Standards
                      </p>
                      <p className="text-[10px] text-tx-2">
                        ILO-certified · relevant for cooperative organizers
                      </p>
                    </div>
                  </div>
                  <span className="rounded bg-teal-soft px-2 py-0.5 font-mono text-[10px] font-bold text-teal">
                    FREE
                  </span>
                </div>
              </div>
            </div>

            {/* CTA to Skills and Opportunities */}
            <div className="flex flex-wrap gap-2">
              <Link
                to="/skills"
                search={{ persona: selectedPersona as never }}
                className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-[12px] font-semibold text-bg-0 transition hover:opacity-90"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Map skills in Module 01
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                to="/opportunities"
                search={{ persona: selectedPersona as never }}
                className="inline-flex items-center gap-2 rounded-md border border-teal/40 bg-teal-soft px-4 py-2 text-[12px] font-semibold text-teal transition hover:bg-teal/20"
              >
                View matched opportunities
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        <CitationsPanel citations={citationsQ.data ?? []} defaultOpen />
      </div>
    </AppShell>
  );
}

/* ── Gauge Chart (SVG semicircle) ── */
function GaugeChart({ value }: { value: number }) {
  const r = 80;
  const cx = 100;
  const cy = 100;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - value);

  const color =
    value < 0.35
      ? "oklch(0.800 0.130 180)"
      : value < 0.55
        ? "oklch(0.770 0.140 75)"
        : "oklch(0.720 0.180 22)";
  const trackColor = "oklch(0.220 0.045 263)";

  return (
    <div className="relative inline-block">
      <svg width="200" height="120" viewBox="0 0 200 120">
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={trackColor}
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        {/* Tick marks */}
        {Array.from({ length: 11 }).map((_, i) => {
          const angle = Math.PI + (Math.PI * i) / 10;
          const x1 = cx + Math.cos(angle) * (r - 10);
          const y1 = cy + Math.sin(angle) * (r - 10);
          const x2 = cx + Math.cos(angle) * (r + 2);
          const y2 = cy + Math.sin(angle) * (r + 2);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="oklch(1 0 0 / 0.1)"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <div
        className="absolute bottom-1 left-1/2 -translate-x-1/2 font-display text-[26px] font-bold"
        style={{ color }}
      >
        {Math.round(value * 100)}%
      </div>
    </div>
  );
}

/* ── Projection Chart (Canvas-based via SVG polylines) ── */
function ProjectionChart({ countryCode }: { countryCode: string }) {
  const data = WITTGENSTEIN[countryCode] ?? WITTGENSTEIN.KE;
  const w = 400;
  const h = 140;
  const pad = { t: 8, r: 16, b: 24, l: 36 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;

  const toPoints = useCallback(
    (vals: number[]) => {
      return vals
        .map((v, i) => {
          const x = pad.l + (i / (PROJ_YEARS.length - 1)) * cw;
          const y = pad.t + ch * (1 - v / 80);
          return `${x},${y}`;
        })
        .join(" ");
    },
    [cw, ch, pad.l, pad.t],
  );

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[140px] w-full">
      {/* Grid lines */}
      {[0, 20, 40, 60, 80].map((v) => {
        const y = pad.t + ch * (1 - v / 80);
        return (
          <g key={v}>
            <line
              x1={pad.l}
              y1={y}
              x2={pad.l + cw}
              y2={y}
              stroke="oklch(1 0 0 / 0.04)"
              strokeWidth="1"
            />
            <text
              x={pad.l - 4}
              y={y + 3}
              textAnchor="end"
              style={{
                fontSize: "8px",
                fontFamily: "Space Mono",
                fill: "oklch(1 0 0 / 0.25)",
              }}
            >
              {v}%
            </text>
          </g>
        );
      })}
      {/* X labels */}
      {PROJ_YEARS.map((yr, i) => {
        const x = pad.l + (i / (PROJ_YEARS.length - 1)) * cw;
        return (
          <text
            key={yr}
            x={x}
            y={h - 2}
            textAnchor="middle"
            style={{
              fontSize: "8px",
              fontFamily: "Space Mono",
              fill: "oklch(1 0 0 / 0.25)",
            }}
          >
            {yr}
          </text>
        );
      })}
      {/* Lines */}
      <polyline
        points={toPoints(data.primary)}
        fill="none"
        stroke="oklch(0.770 0.140 75)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <polyline
        points={toPoints(data.secondary)}
        fill="none"
        stroke="oklch(0.760 0.130 230)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <polyline
        points={toPoints(data.tertiary)}
        fill="none"
        stroke="oklch(0.800 0.130 180)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Dots */}
      {[
        { vals: data.primary, color: "oklch(0.770 0.140 75)" },
        { vals: data.secondary, color: "oklch(0.760 0.130 230)" },
        { vals: data.tertiary, color: "oklch(0.800 0.130 180)" },
      ].map(({ vals, color }) =>
        vals.map((v, i) => {
          const x = pad.l + (i / (PROJ_YEARS.length - 1)) * cw;
          const y = pad.t + ch * (1 - v / 80);
          return <circle key={`${color}-${i}`} cx={x} cy={y} r="3" fill={color} />;
        }),
      )}
    </svg>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-tx-1">
      <div className={`h-[3px] w-[12px] rounded-full ${color}`} />
      {label}
    </div>
  );
}
