import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Gauge,
  GraduationCap,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";
import { CitationsPanel } from "@/components/CitationsPanel";
import { getCitations } from "@/server/citations.functions";
import { listCountries } from "@/server/opportunities.functions";

const PERSONAS = ["sarah", "james", "amara", "kwame"] as const;
const COUNTRIES = ["KE", "GH", "NG", "ZA", "RW"] as const;

const SearchSchema = z.object({
  persona: z.enum(PERSONAS).default("sarah").catch("sarah"),
  country: z.enum(COUNTRIES).default("KE").catch("KE"),
});

export const Route = createFileRoute("/readiness")({
  validateSearch: SearchSchema,
  head: () => ({
    meta: [
      {
        title:
          "AI Readiness Lens — Frey-Osborne automation risk · TalentGraph",
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
      queryKey: ["countries"],
      queryFn: () => listCountries(),
    });
    void context.queryClient.prefetchQuery({
      queryKey: ["citations", null],
      queryFn: () => getCitations({ data: {} }),
    });
  },
  component: ReadinessPage,
});

function ReadinessPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const countriesQ = useQuery({
    queryKey: ["countries"],
    queryFn: () => listCountries(),
  });
  const citationsQ = useQuery({
    queryKey: ["citations", null],
    queryFn: () => getCitations({ data: {} }),
  });

  const persona = PERSONA_DATA[search.persona];
  const fallbackCountry = STATIC_COUNTRIES[search.country];
  const country =
    countriesQ.data?.find((c) => c.code === search.country) ?? fallbackCountry;
  const calibration =
    "lmic_calibration" in country && country.lmic_calibration
      ? Number(country.lmic_calibration)
      : fallbackCountry.lmic_calibration;

  const riskRows = useMemo(
    () =>
      persona.skills.map((skill) => {
        const baseRisk = FREY_OSBORNE[skill.isco] ?? 0.45;
        const calibratedRisk = Math.min(0.95, baseRisk * calibration);
        return {
          ...skill,
          baseRisk,
          calibratedRisk,
          durable: calibratedRisk < 0.35,
        };
      }),
    [persona.skills, calibration]
  );
  const compositeRisk =
    riskRows.reduce((sum, row) => sum + row.calibratedRisk * row.weight, 0) /
    riskRows.reduce((sum, row) => sum + row.weight, 0);
  const band =
    compositeRisk < 0.35 ? "low" : compositeRisk < 0.6 ? "moderate" : "high";
  const projection = WITTGENSTEIN[search.country];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        <PageTitle
          module="Module 02"
          eyebrow="AI Readiness & Displacement Risk Lens"
          description="Based on Frey & Osborne (2013) automation probabilities, calibrated for LMIC context where task composition and economic conditions differ from the US baseline. Projections to 2035 use Wittgenstein Centre education scenarios."
        >
          Your automation risk profile
        </PageTitle>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-tx-2">Persona:</span>
          {PERSONAS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => navigate({ search: (s) => ({ ...s, persona: p }) })}
              className={chip(search.persona === p)}
            >
              {PERSONA_DATA[p].emoji} {PERSONA_DATA[p].name}
            </button>
          ))}
          <span className="ml-0 text-[11px] text-tx-2 md:ml-3">Country:</span>
          {COUNTRIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => navigate({ search: (s) => ({ ...s, country: c }) })}
              className={chip(search.country === c)}
            >
              {STATIC_COUNTRIES[c].flag_emoji} {STATIC_COUNTRIES[c].name}
            </button>
          ))}
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-2xl border border-border-soft bg-bg-3 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="eyebrow mb-1">Composite automation risk</p>
                <h2 className="font-display text-[18px] font-semibold text-tx-0">
                  {persona.name} · {country.name}
                </h2>
              </div>
              <Gauge className={bandColor(band, "icon")} />
            </div>

            <RiskGauge value={compositeRisk} band={band} />

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <Signal
                label="Base model"
                value="Frey-Osborne"
                tone="gold"
                note="Occupation-level probability"
              />
              <Signal
                label="LMIC factor"
                value={`×${calibration.toFixed(2)}`}
                tone="teal"
                note="Capital/labor + infrastructure"
              />
              <Signal
                label="Risk band"
                value={band.toUpperCase()}
                tone={band === "high" ? "coral" : band === "moderate" ? "gold" : "teal"}
                note="Used for pathway priority"
              />
            </div>

            <div className="mt-4 rounded-xl border border-gold/25 bg-gold-soft p-3 text-[11.5px] leading-relaxed text-tx-1">
              <strong className="text-gold">Calibration note:</strong> Frey &
              Osborne scores are adjusted downward in LMIC contexts because task
              bundles, lower capital intensity, and infrastructure constraints
              slow near-term automation. The country multiplier is visible so
              the risk is explainable, not a black box.
            </div>
          </div>

          <div className="rounded-2xl border border-border-soft bg-bg-3 p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow mb-1">Per-skill risk breakdown</p>
                <h2 className="font-display text-[18px] font-semibold text-tx-0">
                  What is exposed, what is durable
                </h2>
              </div>
              <ShieldAlert className="h-5 w-5 text-coral" />
            </div>
            <div className="space-y-3">
              {riskRows.map((row) => (
                <RiskRow key={`${row.isco}-${row.name}`} row={row} />
              ))}
            </div>
          </div>
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-2xl border border-border-soft bg-bg-3 p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow mb-1">Education projections</p>
                <h2 className="font-display text-[18px] font-semibold text-tx-0">
                  Wittgenstein SSP2 · 2025-2035
                </h2>
                <p className="mt-1 text-[11.5px] text-tx-2">
                  Share of the 25-34 population by highest education level in{" "}
                  {country.name}.
                </p>
              </div>
              <GraduationCap className="h-5 w-5 text-teal" />
            </div>
            <div className="space-y-4">
              {projection.map((point) => (
                <ProjectionRow key={point.year} point={point} />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-tx-2">
              <Legend color="bg-gold" label="Primary" />
              <Legend color="bg-sky" label="Secondary" />
              <Legend color="bg-teal" label="Tertiary" />
            </div>
          </div>

          <div className="rounded-2xl border border-border-soft bg-bg-3 p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow mb-1">Adjacent skills</p>
                <h2 className="font-display text-[18px] font-semibold text-tx-0">
                  Increase resilience
                </h2>
              </div>
              <Target className="h-5 w-5 text-teal" />
            </div>
            <div className="grid gap-3">
              {persona.adjacent.map((item) => (
                <AdjacentCard key={item.skill} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-3">
          {persona.pathway.map((step, idx) => (
            <PathwayStep key={step.title} step={step} idx={idx} />
          ))}
        </section>

        <section className="mb-5 rounded-2xl border border-teal/25 bg-teal-soft p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow mb-1 text-teal">Action plan</p>
              <h2 className="font-display text-[18px] font-semibold text-tx-0">
                Pair the risk lens with the skills passport
              </h2>
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-tx-1">
                Run the Skills Engine first, then use this page as the roadmap:
                validate durable skills, choose one adjacent digital skill, and
                share the credential with an employer or training partner.
              </p>
            </div>
            <a
              href="/skills"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-teal px-4 py-2 text-[12px] font-semibold text-bg-0 transition hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              Open Skills Engine
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        <CitationsPanel citations={citationsQ.data ?? []} defaultOpen />
      </div>
    </AppShell>
  );
}

type PersonaSlug = (typeof PERSONAS)[number];
type CountryCode = (typeof COUNTRIES)[number];
type Band = "low" | "moderate" | "high";

interface PersonaSkill {
  name: string;
  isco: string;
  category: string;
  level: number;
  weight: number;
  note: string;
}

interface RiskRowData extends PersonaSkill {
  baseRisk: number;
  calibratedRisk: number;
  durable: boolean;
}

const STATIC_COUNTRIES: Record<
  CountryCode,
  {
    code: CountryCode;
    name: string;
    flag_emoji: string;
    lmic_calibration: number;
  }
> = {
  KE: { code: "KE", name: "Kenya", flag_emoji: "🇰🇪", lmic_calibration: 0.78 },
  GH: { code: "GH", name: "Ghana", flag_emoji: "🇬🇭", lmic_calibration: 0.8 },
  NG: { code: "NG", name: "Nigeria", flag_emoji: "🇳🇬", lmic_calibration: 0.72 },
  ZA: { code: "ZA", name: "South Africa", flag_emoji: "🇿🇦", lmic_calibration: 0.85 },
  RW: { code: "RW", name: "Rwanda", flag_emoji: "🇷🇼", lmic_calibration: 0.7 },
};

const FREY_OSBORNE: Record<string, number> = {
  "7531": 0.57,
  "7318": 0.49,
  "5223": 0.92,
  "7421": 0.51,
  "2521": 0.25,
  "1439": 0.16,
  "6111": 0.54,
  "3142": 0.35,
  "7516": 0.63,
  "3322": 0.45,
  "3331": 0.59,
  "4321": 0.72,
  "2431": 0.67,
  "2359": 0.033,
};

const PERSONA_DATA: Record<
  PersonaSlug,
  {
    name: string;
    emoji: string;
    skills: PersonaSkill[];
    adjacent: Array<{ skill: string; impact: string; desc: string }>;
    pathway: Array<{ title: string; resource: string; outcome: string }>;
  }
> = {
  sarah: {
    name: "Sarah",
    emoji: "🧵",
    skills: [
      {
        name: "Garment construction & tailoring",
        isco: "7531",
        category: "Trade",
        level: 9,
        weight: 1,
        note: "Strong demand, but repetitive stitching tasks can be automated in factories.",
      },
      {
        name: "Hand embroidery & beadwork",
        isco: "7318",
        category: "Creative",
        level: 9,
        weight: 0.9,
        note: "Craft judgment and cultural motifs make this more resilient than basic sewing.",
      },
      {
        name: "Shop and customer management",
        isco: "5223",
        category: "Business",
        level: 6,
        weight: 0.7,
        note: "Retail admin is exposed, but relationship-led selling remains valuable.",
      },
    ],
    adjacent: [
      {
        skill: "Digital pattern design",
        impact: "+34% resilience",
        desc: "CAD pattern tools turn Sarah's design intuition into export-ready, remote-compatible work.",
      },
      {
        skill: "Garment quality control",
        impact: "+41% resilience",
        desc: "Human tactile judgment is hard to automate and maps to higher-value factory roles.",
      },
      {
        skill: "E-commerce operations",
        impact: "+28% resilience",
        desc: "Listing, pricing, photography, and fulfilment unlock direct sales beyond Eldoret.",
      },
    ],
    pathway: [
      {
        title: "Digitize one pattern",
        resource: "YouTube + Valentina Patternmaking",
        outcome: "Creates evidence for remote fashion assistant roles.",
      },
      {
        title: "Add QC micro-credential",
        resource: "ILO garment quality resources",
        outcome: "Moves from production-only to quality assurance.",
      },
      {
        title: "Launch seller profile",
        resource: "Jumia Seller Academy",
        outcome: "Turns local craft demand into regional demand.",
      },
    ],
  },
  james: {
    name: "James",
    emoji: "📱",
    skills: [
      {
        name: "Mobile device repair",
        isco: "7421",
        category: "Technical",
        level: 9,
        weight: 1,
        note: "Hardware diagnosis stays resilient while simple part swaps commoditize.",
      },
      {
        name: "Data recovery",
        isco: "2521",
        category: "Digital",
        level: 7,
        weight: 0.85,
        note: "Higher-complexity problem solving has lower automation exposure.",
      },
      {
        name: "Repair-shop operations",
        isco: "1439",
        category: "Business",
        level: 6,
        weight: 0.7,
        note: "People management and supplier judgment are durable business skills.",
      },
    ],
    adjacent: [
      {
        skill: "CompTIA A+ fundamentals",
        impact: "+31% resilience",
        desc: "Formalizes informal repair expertise for corporate ICT support roles.",
      },
      {
        skill: "Android firmware tooling",
        impact: "+26% resilience",
        desc: "Moves James toward software-side repair and remote support contracts.",
      },
      {
        skill: "Device refurbishment QA",
        impact: "+38% resilience",
        desc: "Quality control and warranty workflows are hard to fully automate.",
      },
    ],
    pathway: [
      {
        title: "Document repair cases",
        resource: "Google Photos + before/after notes",
        outcome: "Builds portfolio evidence for employers.",
      },
      {
        title: "Study A+ modules",
        resource: "Professor Messer free lessons",
        outcome: "Adds recognized language to informal expertise.",
      },
      {
        title: "Package remote support offer",
        resource: "Google Digital Skills for Africa",
        outcome: "Opens higher-paying helpdesk work.",
      },
    ],
  },
  amara: {
    name: "Amara",
    emoji: "🌾",
    skills: [
      {
        name: "Smallholder crop production",
        isco: "6111",
        category: "Agriculture",
        level: 8,
        weight: 1,
        note: "Field work is exposed to mechanization, but local agronomy judgment remains important.",
      },
      {
        name: "Soil testing & agronomy",
        isco: "3142",
        category: "Technical",
        level: 6,
        weight: 0.8,
        note: "Applied diagnosis and field adaptation are durable skills.",
      },
      {
        name: "Post-harvest processing",
        isco: "7516",
        category: "Trade",
        level: 7,
        weight: 0.75,
        note: "Routine packaging is exposed; food safety and quality systems improve resilience.",
      },
    ],
    adjacent: [
      {
        skill: "Digital farm records",
        impact: "+29% resilience",
        desc: "Yield, expense, and buyer records make the cooperative investable.",
      },
      {
        skill: "Food safety certification",
        impact: "+36% resilience",
        desc: "Quality compliance raises the value of processing work.",
      },
      {
        skill: "Extension training delivery",
        impact: "+33% resilience",
        desc: "Teaching other farmers turns know-how into a higher-leverage role.",
      },
    ],
    pathway: [
      {
        title: "Record one harvest cycle",
        resource: "WeFarm / spreadsheet template",
        outcome: "Creates proof for lenders and buyers.",
      },
      {
        title: "Learn food safety basics",
        resource: "FAO free resources",
        outcome: "Improves export and supermarket readiness.",
      },
      {
        title: "Formalize cooperative attestors",
        resource: "TalentGraph peer attestation",
        outcome: "Turns community trust into portable credentials.",
      },
    ],
  },
  kwame: {
    name: "Kwame",
    emoji: "🛒",
    skills: [
      {
        name: "Import/export operations",
        isco: "3322",
        category: "Business",
        level: 8,
        weight: 1,
        note: "Negotiation and supplier judgment lower displacement risk.",
      },
      {
        name: "Customs clearance",
        isco: "3331",
        category: "Technical",
        level: 8,
        weight: 0.85,
        note: "Regulatory knowledge is durable but paperwork workflows can automate.",
      },
      {
        name: "Inventory management",
        isco: "4321",
        category: "Operations",
        level: 7,
        weight: 0.75,
        note: "Stock tracking is highly automatable unless paired with analytics.",
      },
    ],
    adjacent: [
      {
        skill: "Supply-chain analytics",
        impact: "+37% resilience",
        desc: "Moves spreadsheet work into forecasting, procurement, and margin decisions.",
      },
      {
        skill: "Customs brokerage license",
        impact: "+30% resilience",
        desc: "Formal license turns lived trade experience into B2B credibility.",
      },
      {
        skill: "Marketplace performance marketing",
        impact: "+24% resilience",
        desc: "Adds measurable demand generation to cross-border sourcing.",
      },
    ],
    pathway: [
      {
        title: "Clean inventory data",
        resource: "Google Sheets free course",
        outcome: "Enables reorder points and gross-margin dashboards.",
      },
      {
        title: "Map customs workflows",
        resource: "Ghana Revenue Authority materials",
        outcome: "Prepares for brokerage or logistics coordinator roles.",
      },
      {
        title: "Build supplier scorecard",
        resource: "Coursera supply chain audit",
        outcome: "Turns negotiation skill into repeatable operations.",
      },
    ],
  },
};

const WITTGENSTEIN: Record<
  CountryCode,
  Array<{ year: number; primary: number; secondary: number; tertiary: number }>
> = {
  KE: [
    { year: 2025, primary: 38, secondary: 46, tertiary: 16 },
    { year: 2027, primary: 36, secondary: 48, tertiary: 16 },
    { year: 2029, primary: 34, secondary: 50, tertiary: 16 },
    { year: 2031, primary: 31, secondary: 52, tertiary: 17 },
    { year: 2035, primary: 29, secondary: 53, tertiary: 18 },
  ],
  GH: [
    { year: 2025, primary: 32, secondary: 52, tertiary: 16 },
    { year: 2027, primary: 30, secondary: 53, tertiary: 17 },
    { year: 2029, primary: 28, secondary: 54, tertiary: 18 },
    { year: 2031, primary: 26, secondary: 56, tertiary: 18 },
    { year: 2035, primary: 24, secondary: 57, tertiary: 19 },
  ],
  NG: [
    { year: 2025, primary: 45, secondary: 44, tertiary: 11 },
    { year: 2027, primary: 43, secondary: 45, tertiary: 12 },
    { year: 2029, primary: 40, secondary: 47, tertiary: 13 },
    { year: 2031, primary: 37, secondary: 49, tertiary: 14 },
    { year: 2035, primary: 35, secondary: 51, tertiary: 14 },
  ],
  RW: [
    { year: 2025, primary: 41, secondary: 51, tertiary: 8 },
    { year: 2027, primary: 39, secondary: 53, tertiary: 8 },
    { year: 2029, primary: 36, secondary: 55, tertiary: 9 },
    { year: 2031, primary: 33, secondary: 58, tertiary: 9 },
    { year: 2035, primary: 30, secondary: 60, tertiary: 10 },
  ],
  ZA: [
    { year: 2025, primary: 18, secondary: 55, tertiary: 27 },
    { year: 2027, primary: 17, secondary: 56, tertiary: 27 },
    { year: 2029, primary: 15, secondary: 57, tertiary: 28 },
    { year: 2031, primary: 14, secondary: 58, tertiary: 28 },
    { year: 2035, primary: 13, secondary: 58, tertiary: 29 },
  ],
};

function chip(active: boolean) {
  return [
    "rounded-full border px-3 py-1 text-[11px] font-medium transition",
    active
      ? "border-gold bg-gold-soft text-gold"
      : "border-border bg-bg-3 text-tx-1 hover:border-gold-glow hover:text-tx-0",
  ].join(" ");
}

function RiskGauge({ value, band }: { value: number; band: Band }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative grid h-44 w-44 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${bandColor(band, "raw")} ${pct * 3.6}deg, oklch(1 0 0 / 0.08) 0deg)`,
        }}
      >
        <div className="grid h-32 w-32 place-items-center rounded-full border border-border-soft bg-bg-2 text-center">
          <div>
            <p className={`font-mono text-[34px] font-bold ${bandColor(band, "text")}`}>
              {pct}%
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-tx-2">
              {band} risk
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 max-w-sm text-center text-[11.5px] leading-relaxed text-tx-1">
        {band === "low"
          ? "Resilient profile: deepen evidence and target higher-value credentials."
          : band === "moderate"
            ? "Moderate exposure: add one adjacent digital or quality-control skill."
            : "High exposure: prioritize reskilling paths before matching to opportunities."}
      </p>
    </div>
  );
}

function RiskRow({ row }: { row: RiskRowData }) {
  const pct = Math.round(row.calibratedRisk * 100);
  const band: Band = row.calibratedRisk < 0.35 ? "low" : row.calibratedRisk < 0.6 ? "moderate" : "high";
  return (
    <article className="rounded-xl border border-border-soft bg-bg-4 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[12px] font-semibold text-tx-0">{row.name}</h3>
          <p className="mt-0.5 text-[10px] text-tx-2">
            ISCO-{row.isco} · {row.category} · Level {row.level}/10
          </p>
        </div>
        <span className={`font-mono text-[13px] font-bold ${bandColor(band, "text")}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg-2">
        <div
          className={bandColor(band, "bg")}
          style={{ width: `${pct}%`, height: "100%" }}
        />
      </div>
      <div className="mt-2 flex items-start gap-2 text-[10.5px] leading-relaxed text-tx-1">
        {row.durable ? (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
        ) : (
          <BrainCircuit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
        )}
        <span>
          {row.note} Base {Math.round(row.baseRisk * 100)}% → LMIC-calibrated{" "}
          {pct}%.
        </span>
      </div>
    </article>
  );
}

function Signal({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone: "gold" | "teal" | "coral";
  note: string;
}) {
  const color =
    tone === "gold" ? "text-gold" : tone === "teal" ? "text-teal" : "text-coral";
  return (
    <div className="rounded-xl border border-border-soft bg-bg-4 p-3">
      <p className="text-[10px] text-tx-2">{label}</p>
      <p className={`mt-1 font-mono text-[13px] font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-[9.5px] text-tx-2">{note}</p>
    </div>
  );
}

function ProjectionRow({
  point,
}: {
  point: { year: number; primary: number; secondary: number; tertiary: number };
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10.5px]">
        <span className="font-mono font-bold text-tx-1">{point.year}</span>
        <span className="text-tx-2">
          P {point.primary}% · S {point.secondary}% · T {point.tertiary}%
        </span>
      </div>
      <div className="flex h-4 overflow-hidden rounded-full border border-border-soft bg-bg-2">
        <div className="bg-gold" style={{ width: `${point.primary}%` }} />
        <div className="bg-sky" style={{ width: `${point.secondary}%` }} />
        <div className="bg-teal" style={{ width: `${point.tertiary}%` }} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

function AdjacentCard({
  item,
}: {
  item: { skill: string; impact: string; desc: string };
}) {
  return (
    <article className="rounded-xl border border-border-soft bg-bg-4 p-3 transition hover:border-teal/40">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-[12px] font-semibold text-tx-0">{item.skill}</h3>
        <span className="shrink-0 rounded-full bg-teal-soft px-2 py-0.5 font-mono text-[9px] font-bold text-teal">
          {item.impact}
        </span>
      </div>
      <p className="text-[10.5px] leading-relaxed text-tx-1">{item.desc}</p>
    </article>
  );
}

function PathwayStep({
  step,
  idx,
}: {
  step: { title: string; resource: string; outcome: string };
  idx: number;
}) {
  return (
    <article className="rounded-2xl border border-border-soft bg-bg-3 p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gold-soft font-mono text-[12px] font-bold text-gold">
          {idx + 1}
        </span>
        <h3 className="font-display text-[14px] font-semibold text-tx-0">
          {step.title}
        </h3>
      </div>
      <p className="flex items-center gap-2 text-[11px] font-medium text-teal">
        <BookOpen className="h-3.5 w-3.5" />
        {step.resource}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-tx-1">{step.outcome}</p>
    </article>
  );
}

function bandColor(
  band: Band,
  mode: "text" | "bg" | "icon" | "raw"
): string {
  const map = {
    low: {
      text: "text-teal",
      bg: "bg-teal",
      icon: "h-5 w-5 text-teal",
      raw: "oklch(0.800 0.130 180)",
    },
    moderate: {
      text: "text-gold",
      bg: "bg-gold",
      icon: "h-5 w-5 text-gold",
      raw: "oklch(0.770 0.140 75)",
    },
    high: {
      text: "text-coral",
      bg: "bg-coral",
      icon: "h-5 w-5 text-coral",
      raw: "oklch(0.720 0.180 22)",
    },
  } satisfies Record<Band, Record<typeof mode, string>>;
  return map[band][mode];
}
