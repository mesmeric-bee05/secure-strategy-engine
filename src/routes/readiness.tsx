import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Sparkles, ShieldCheck, AlertTriangle, ArrowRight } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";
import { CitationsPanel } from "@/components/CitationsPanel";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { getCitations } from "@/server/citations.functions";
import { getReadinessReport } from "@/server/readiness.functions";
import { listCountries } from "@/server/opportunities.functions";
import { listPersonas } from "@/server/skills.functions";
import {
  bandFor,
  bandLabel,
  projectionDelta,
  type RiskBand,
  type SkillRisk,
} from "@/lib/readiness";
import { COUNTRY_CODES } from "./opportunities";

const SearchSchema = z.object({
  country: z.enum(COUNTRY_CODES).default("KE").catch("KE"),
  persona: z.enum(["sarah", "james", "amara", "kwame"]).optional().catch(undefined),
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
          "Per-skill automation risk based on Frey & Osborne (2013), calibrated for LMIC context, with Wittgenstein 2025-2035 education projections and adjacent durable skill recommendations.",
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
  loaderDeps: ({ search }) => ({
    country: search.country,
    persona: search.persona,
  }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery({
      queryKey: ["citations", deps.country],
      queryFn: () => getCitations({ data: { countryCode: deps.country } }),
    });
    void context.queryClient.prefetchQuery({
      queryKey: ["personas"],
      queryFn: () => listPersonas(),
    });
    void context.queryClient.prefetchQuery({
      queryKey: ["countries"],
      queryFn: () => listCountries(),
    });
  },
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <RouteErrorBoundary error={error} reset={reset} module="AI Readiness Lens" />
    </AppShell>
  ),
  component: ReadinessPage,
});

/* -------------------------------------------------------------------------- */
/* Demo persona ISCO seeds                                                     */
/* -------------------------------------------------------------------------- */
/*
 * Module 02 needs a profile to render against. Until users have an
 * authenticated, server-saved skill profile we let visitors load one of the
 * four demo personas. The seeds mirror what `extractSkills` typically
 * returns — they are intentionally short so the gauge stays legible.
 */
const PERSONA_DEMO_PROFILES: Record<
  "sarah" | "james" | "amara" | "kwame",
  Array<{ skill_name: string; isco_code: string; proficiency_level: number }>
> = {
  sarah: [
    { skill_name: "Garment construction & tailoring", isco_code: "7531", proficiency_level: 9 },
    { skill_name: "Hand embroidery & beadwork", isco_code: "7318", proficiency_level: 9 },
    { skill_name: "Customer negotiation", isco_code: "5223", proficiency_level: 7 },
    { skill_name: "Small business management", isco_code: "1439", proficiency_level: 6 },
  ],
  james: [
    { skill_name: "Mobile-device repair", isco_code: "7421", proficiency_level: 9 },
    { skill_name: "Customer service", isco_code: "5230", proficiency_level: 7 },
    { skill_name: "Sales & merchandising", isco_code: "3322", proficiency_level: 6 },
    { skill_name: "Team leadership", isco_code: "1439", proficiency_level: 5 },
  ],
  amara: [
    { skill_name: "Smallholder crop production", isco_code: "6111", proficiency_level: 9 },
    { skill_name: "Mixed-farming operations", isco_code: "6121", proficiency_level: 7 },
    { skill_name: "Cooperative leadership", isco_code: "1439", proficiency_level: 6 },
    { skill_name: "Negotiation & sales", isco_code: "3322", proficiency_level: 6 },
  ],
  kwame: [
    { skill_name: "Cross-border trading", isco_code: "3322", proficiency_level: 8 },
    { skill_name: "Logistics coordination", isco_code: "8322", proficiency_level: 6 },
    { skill_name: "Customer service", isco_code: "5223", proficiency_level: 7 },
    { skill_name: "Languages & translation", isco_code: "2643", proficiency_level: 7 },
  ],
};

const PERSONAS = [
  { slug: "sarah" as const, label: "🧵 Sarah", country: "KE" as const },
  { slug: "james" as const, label: "📱 James", country: "KE" as const },
  { slug: "amara" as const, label: "🌾 Amara", country: "NG" as const },
  { slug: "kwame" as const, label: "🛒 Kwame", country: "GH" as const },
];

function ReadinessPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setCountry = (country: typeof search.country) =>
    navigate({ search: (s) => ({ ...s, country }) });
  const setPersona = (persona: typeof search.persona) =>
    navigate({ search: (s) => ({ ...s, persona }) });

  const skills = search.persona ? PERSONA_DEMO_PROFILES[search.persona] : [];

  const reportQ = useQuery({
    queryKey: ["readiness", search.country, search.persona ?? "none"],
    queryFn: () =>
      getReadinessReport({
        data: {
          countryCode: search.country,
          skills,
          iscoCodes: skills.map((s) => s.isco_code),
        },
      }),
  });
  const countriesQ = useQuery({
    queryKey: ["countries"],
    queryFn: () => listCountries(),
  });
  const citationsQ = useQuery({
    queryKey: ["citations", search.country],
    queryFn: () => getCitations({ data: { countryCode: search.country } }),
  });

  const report = reportQ.data;
  const composite = report?.compositeRisk ?? null;
  const compositeBand: RiskBand | null = composite === null ? null : bandFor(composite);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        <PageTitle
          module="Module 02"
          eyebrow="AI Readiness & Displacement Risk Lens"
          description="Frey & Osborne (2013) automation probabilities, calibrated for LMIC context where task composition and capital costs differ from the US baseline. Wittgenstein Centre SSP2 education projections show where each region is heading."
        >
          Your automation risk profile
        </PageTitle>

        {/* Country + persona controls */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-tx-2">Country:</span>
            {(countriesQ.data ?? []).map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setCountry(c.code as never)}
                className={chip(search.country === c.code)}
              >
                {c.flag_emoji} {c.name}
              </button>
            ))}
          </div>
          <span className="hidden h-4 w-px bg-border-soft sm:block" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-tx-2">Profile:</span>
            <button
              type="button"
              onClick={() => setPersona(undefined)}
              className={chip(!search.persona)}
            >
              No profile
            </button>
            {PERSONAS.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => {
                  setPersona(p.slug);
                  setCountry(p.country);
                }}
                className={chip(search.persona === p.slug)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {!search.persona && (
          <div className="mb-6 rounded-xl border border-gold-glow bg-gold-soft/40 p-4 text-[12.5px] leading-relaxed text-tx-1">
            <p className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span>
                <strong className="text-tx-0">Pick a demo profile</strong> above to see the risk
                gauge populate, or build your own profile in the{" "}
                <Link
                  to="/skills"
                  className="underline decoration-gold-glow underline-offset-2 hover:text-gold"
                >
                  Skills Engine
                </Link>{" "}
                first. The country selector controls the LMIC calibration multiplier and the
                education projection curves.
              </span>
            </p>
          </div>
        )}

        {reportQ.isLoading && (
          <div className="rounded-xl border border-border-soft bg-bg-3 p-6 text-center text-[12px] text-tx-2">
            Loading risk model…
          </div>
        )}

        {report && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* LEFT — Composite gauge + per-skill rows */}
            <div className="flex flex-col gap-5">
              <CompositeGaugeCard
                composite={composite}
                band={compositeBand}
                country={report.country}
              />

              <PerSkillRiskList risks={report.skillRisks} />
            </div>

            {/* RIGHT — Projections + adjacent skills */}
            <div className="flex flex-col gap-5">
              <ProjectionsCard country={report.country.name} rows={report.projections} />
              <AdjacentSkillsCard
                adjacent={report.adjacent}
                userIscoCodes={new Set(report.skillRisks.map((r) => r.iscoCode))}
              />
            </div>
          </div>
        )}

        <CitationsPanel citations={citationsQ.data ?? []} defaultOpen={false} />
      </div>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Composite gauge — semicircular SVG                                          */
/* -------------------------------------------------------------------------- */

function CompositeGaugeCard({
  composite,
  band,
  country,
}: {
  composite: number | null;
  band: RiskBand | null;
  country: { code: string; name: string; flag_emoji: string | null; lmic_calibration: number };
}) {
  const tone =
    band === "durable"
      ? "text-teal"
      : band === "moderate"
        ? "text-gold"
        : band === "exposed"
          ? "text-coral"
          : "text-tx-2";

  return (
    <section className="rounded-2xl border border-border-soft bg-bg-3 p-5">
      <header className="mb-1 flex items-center justify-between gap-2">
        <h2 className="font-display text-[14px] font-semibold text-tx-0">
          Composite automation risk
        </h2>
        <span className="text-[10px] text-tx-2">
          {country.flag_emoji} {country.name}
        </span>
      </header>
      <p className="mb-3 text-[11.5px] leading-relaxed text-tx-2">
        Proficiency-weighted across mapped skills. Frey-Osborne base score is multiplied by{" "}
        <strong className="font-mono text-tx-1">{country.lmic_calibration.toFixed(2)}</strong> for{" "}
        {country.name}'s LMIC labour-market context.
      </p>

      <div className="grid items-center gap-4 sm:grid-cols-[160px_1fr]">
        <Gauge value={composite} band={band} />
        <div>
          <p className={`font-display text-[42px] font-bold leading-none ${tone}`}>
            {composite === null ? "—" : `${Math.round(composite * 100)}%`}
          </p>
          <p className={`mt-1 text-[12px] font-semibold ${tone}`}>
            {band ? bandLabel(band) : "Add skills to a profile to compute"}
          </p>
          <ul className="mt-3 space-y-1 text-[10.5px] text-tx-2">
            <li>
              <span className="inline-block h-2 w-2 rounded-sm bg-teal align-middle" /> &lt; 35% ·
              Durable
            </li>
            <li>
              <span className="inline-block h-2 w-2 rounded-sm bg-gold align-middle" /> 35–60% ·
              Moderate
            </li>
            <li>
              <span className="inline-block h-2 w-2 rounded-sm bg-coral align-middle" /> ≥ 60% ·
              Exposed
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Gauge({ value, band }: { value: number | null; band: RiskBand | null }) {
  const v = value ?? 0;
  const angle = -Math.PI + Math.PI * v;
  const cx = 80;
  const cy = 80;
  const r = 64;
  const x = cx + Math.cos(angle) * r;
  const y = cy + Math.sin(angle) * r;
  const color =
    band === "durable"
      ? "oklch(0.800 0.130 180)"
      : band === "moderate"
        ? "oklch(0.770 0.140 75)"
        : band === "exposed"
          ? "oklch(0.720 0.180 22)"
          : "oklch(0.500 0.035 255)";

  // Arc from 180° → 360° drawn as 3 colored segments for context.
  const arcAt = (frac: number, color: string, w = 14) => {
    const a = -Math.PI + Math.PI * frac;
    const ax = cx + Math.cos(a) * r;
    const ay = cy + Math.sin(a) * r;
    return { ax, ay, color, w };
  };
  const segDurable = arcAt(0.35, "oklch(0.800 0.130 180 / 0.7)");
  const segModerate = arcAt(0.6, "oklch(0.770 0.140 75 / 0.7)");
  const segExposed = arcAt(1, "oklch(0.720 0.180 22 / 0.7)");

  return (
    <svg viewBox="0 0 160 100" className="h-[100px] w-full max-w-[160px]">
      {/* track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="oklch(1 0 0 / 0.06)"
        strokeWidth={14}
        strokeLinecap="round"
      />
      {/* segments */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${segDurable.ax} ${segDurable.ay}`}
        fill="none"
        stroke={segDurable.color}
        strokeWidth={14}
        strokeLinecap="round"
      />
      <path
        d={`M ${segDurable.ax} ${segDurable.ay} A ${r} ${r} 0 0 1 ${segModerate.ax} ${segModerate.ay}`}
        fill="none"
        stroke={segModerate.color}
        strokeWidth={14}
        strokeLinecap="round"
      />
      <path
        d={`M ${segModerate.ax} ${segModerate.ay} A ${r} ${r} 0 0 1 ${segExposed.ax} ${segExposed.ay}`}
        fill="none"
        stroke={segExposed.color}
        strokeWidth={14}
        strokeLinecap="round"
      />
      {/* needle */}
      {value !== null && (
        <>
          <line
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={5} fill={color} />
        </>
      )}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Per-skill risk rows                                                         */
/* -------------------------------------------------------------------------- */

function PerSkillRiskList({ risks }: { risks: SkillRisk[] }) {
  if (risks.length === 0) {
    return (
      <section className="rounded-2xl border border-border-soft bg-bg-3 p-5 text-[12px] text-tx-2">
        Pick a persona above to populate per-skill risk.
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-border-soft bg-bg-3 p-5">
      <h2 className="mb-3 font-display text-[14px] font-semibold text-tx-0">Per-skill risk</h2>
      <ul className="space-y-2">
        {risks.map((r, i) => (
          <li
            key={`${r.iscoCode}-${i}`}
            className="anim-fade-in rounded-lg border border-border-soft bg-bg-4 p-3"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-semibold text-tx-0">{r.skillName}</p>
                <p className="text-[10px] text-tx-2">
                  ISCO-{r.iscoCode} · proficiency {r.proficiency}/10
                </p>
              </div>
              <RiskPill risk={r} />
            </div>
            {r.calibratedProbability !== null && r.rawProbability !== null && (
              <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-3">
                <RiskBar raw={r.rawProbability} calibrated={r.calibratedProbability} />
                <p className="font-mono text-[10px] text-tx-2">
                  {Math.round(r.rawProbability * 100)}% raw
                  <span className="mx-1">→</span>
                  <span
                    className={
                      r.band === "durable"
                        ? "text-teal"
                        : r.band === "moderate"
                          ? "text-gold"
                          : "text-coral"
                    }
                  >
                    {Math.round(r.calibratedProbability * 100)}% calibrated
                  </span>
                </p>
              </div>
            )}
            {!r.hasData && (
              <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-tx-2">
                <AlertTriangle className="h-3 w-3 text-coral" />
                No Frey-Osborne row for ISCO-{r.iscoCode} yet — surfaced as "no-data" so we don't
                fabricate a score.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RiskPill({ risk }: { risk: SkillRisk }) {
  if (!risk.band) {
    return (
      <span className="rounded-full border border-border-strong bg-bg-2 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-tx-2">
        No data
      </span>
    );
  }
  const cls =
    risk.band === "durable"
      ? "border-teal/40 bg-teal-soft text-teal"
      : risk.band === "moderate"
        ? "border-gold-glow bg-gold-soft text-gold"
        : "border-coral/40 bg-coral-soft text-coral";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${cls}`}
    >
      {risk.band}
    </span>
  );
}

function RiskBar({ raw, calibrated }: { raw: number; calibrated: number }) {
  return (
    <div
      className="relative h-2 w-full overflow-hidden rounded-full bg-bg-2"
      role="img"
      aria-label={`Risk: raw ${Math.round(raw * 100)}%, calibrated ${Math.round(calibrated * 100)}%`}
    >
      <div
        className="absolute inset-y-0 left-0 bg-tx-2/30"
        style={{ width: `${Math.round(raw * 100)}%` }}
      />
      <div
        className={`absolute inset-y-0 left-0 ${
          calibrated < 0.35 ? "bg-teal" : calibrated < 0.6 ? "bg-gold" : "bg-coral"
        }`}
        style={{ width: `${Math.round(calibrated * 100)}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Wittgenstein projections                                                    */
/* -------------------------------------------------------------------------- */

function ProjectionsCard({
  country,
  rows,
}: {
  country: string;
  rows: Array<{
    year: number;
    primary_pct: number | null;
    secondary_pct: number | null;
    tertiary_pct: number | null;
  }>;
}) {
  const delta = useMemo(() => projectionDelta(rows), [rows]);

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-border-soft bg-bg-3 p-5 text-[12px] text-tx-2">
        No Wittgenstein SSP2 projections seeded for {country} yet.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border-soft bg-bg-3 p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-[14px] font-semibold text-tx-0">
          Education projections · {country}
        </h2>
        <span className="text-[10px] text-tx-2">Wittgenstein SSP2</span>
      </header>

      {delta && (
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <DeltaStat label="Primary" pp={delta.primaryPP} tone="lav" />
          <DeltaStat label="Secondary" pp={delta.secondaryPP} tone="gold" />
          <DeltaStat label="Tertiary" pp={delta.tertiaryPP} tone="teal" />
        </div>
      )}

      <ProjectionChart rows={rows} />
      <p className="mt-2 text-[10px] italic text-tx-2">
        Source: Wittgenstein Centre SSP2 · % of population by highest education attainment.
      </p>
    </section>
  );
}

function DeltaStat({
  label,
  pp,
  tone,
}: {
  label: string;
  pp: number;
  tone: "gold" | "teal" | "coral" | "lav";
}) {
  const color =
    tone === "gold"
      ? "text-gold"
      : tone === "teal"
        ? "text-teal"
        : tone === "coral"
          ? "text-coral"
          : "text-lavender";
  const sign = pp > 0 ? "+" : "";
  return (
    <div className="rounded-md border border-border-soft bg-bg-4 p-2">
      <p className="text-[9.5px] uppercase tracking-wider text-tx-2">{label}</p>
      <p className={`font-mono text-[15px] font-bold ${color}`}>
        {sign}
        {pp.toFixed(1)}pp
      </p>
    </div>
  );
}

function ProjectionChart({
  rows,
}: {
  rows: Array<{
    year: number;
    primary_pct: number | null;
    secondary_pct: number | null;
    tertiary_pct: number | null;
  }>;
}) {
  const W = 480;
  const H = 160;
  const pad = { l: 28, r: 12, t: 8, b: 24 };
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const years = sorted.map((r) => r.year);
  const x0 = Math.min(...years);
  const x1 = Math.max(...years);
  const xScale = (y: number) => pad.l + ((y - x0) / Math.max(1, x1 - x0)) * (W - pad.l - pad.r);
  const yScale = (v: number | null) => {
    const pct = v ?? 0;
    return pad.t + (1 - pct / 100) * (H - pad.t - pad.b);
  };

  const series = [
    {
      key: "primary",
      label: "Primary",
      color: "oklch(0.750 0.130 290)",
      values: sorted.map((r) => r.primary_pct),
    },
    {
      key: "secondary",
      label: "Secondary",
      color: "oklch(0.770 0.140 75)",
      values: sorted.map((r) => r.secondary_pct),
    },
    {
      key: "tertiary",
      label: "Tertiary",
      color: "oklch(0.800 0.130 180)",
      values: sorted.map((r) => r.tertiary_pct),
    },
  ];

  return (
    <div className="overflow-hidden rounded-md border border-border-soft bg-bg-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[160px] w-full">
        {/* gridlines (25/50/75) */}
        {[25, 50, 75].map((g) => (
          <line
            key={g}
            x1={pad.l}
            x2={W - pad.r}
            y1={yScale(g)}
            y2={yScale(g)}
            stroke="oklch(1 0 0 / 0.05)"
            strokeWidth={1}
          />
        ))}
        {/* y-axis labels */}
        {[0, 25, 50, 75, 100].map((g) => (
          <text
            key={g}
            x={pad.l - 4}
            y={yScale(g) + 3}
            textAnchor="end"
            style={{ fontSize: 9, fontFamily: "Space Mono", fill: "oklch(0.500 0.035 255)" }}
          >
            {g}
          </text>
        ))}
        {/* x-axis labels */}
        {years.map((y) => (
          <text
            key={y}
            x={xScale(y)}
            y={H - 6}
            textAnchor="middle"
            style={{ fontSize: 9, fontFamily: "Space Mono", fill: "oklch(0.500 0.035 255)" }}
          >
            {y}
          </text>
        ))}
        {/* lines */}
        {series.map((s) => {
          const path = sorted
            .map((r, i) => {
              const v = s.values[i];
              if (v === null || v === undefined) return null;
              const x = xScale(r.year);
              const y = yScale(v);
              return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .filter(Boolean)
            .join(" ");
          return (
            <g key={s.key}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} />
              {sorted.map((r, i) => {
                const v = s.values[i];
                if (v === null || v === undefined) return null;
                return <circle key={i} cx={xScale(r.year)} cy={yScale(v)} r={3} fill={s.color} />;
              })}
            </g>
          );
        })}
        {/* Legend */}
        {series.map((s, i) => (
          <g key={s.key} transform={`translate(${pad.l + i * 110}, ${pad.t + 4})`}>
            <rect width={10} height={3} fill={s.color} y={3} />
            <text
              x={14}
              y={8}
              style={{
                fontSize: 9,
                fontFamily: "DM Sans",
                fill: "oklch(0.700 0.030 250)",
              }}
            >
              {s.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Adjacent skills                                                             */
/* -------------------------------------------------------------------------- */

function AdjacentSkillsCard({
  adjacent,
  userIscoCodes,
}: {
  adjacent: Array<{ name: string; isco_code: string; rationale: string; resilience_score: number }>;
  userIscoCodes: Set<string>;
}) {
  const filtered = adjacent.filter((a) => !userIscoCodes.has(a.isco_code));
  return (
    <section className="rounded-2xl border border-border-soft bg-bg-3 p-5">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-[14px] font-semibold text-tx-0">
          <ShieldCheck className="h-4 w-4 text-teal" />
          Adjacent durable skills
        </h2>
        <span className="text-[10px] text-tx-2">
          {filtered.length} new · {adjacent.length - filtered.length} already on profile
        </span>
      </header>
      <p className="mb-3 text-[11.5px] leading-relaxed text-tx-2">
        Adding these to a profile lowers composite risk because their Frey-Osborne scores sit inside
        the durable band even at full LMIC calibration.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {filtered.map((a) => (
          <li key={a.isco_code} className="rounded-lg border border-border-soft bg-bg-4 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-tx-0">{a.name}</p>
              <span className="rounded-full border border-teal/40 bg-teal-soft px-1.5 py-0.5 font-mono text-[9px] font-bold text-teal">
                ISCO-{a.isco_code}
              </span>
            </div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-tx-2">{a.rationale}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 rounded bg-bg-2">
                <div
                  className="h-1 rounded bg-teal"
                  style={{ width: `${Math.round(a.resilience_score * 100)}%` }}
                />
              </div>
              <span className="font-mono text-[9.5px] text-tx-1">
                {Math.round(a.resilience_score * 100)}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <Link
        to="/skills"
        className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-gold hover:underline"
      >
        Add adjacent skills in the Skills Engine <ArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function chip(active: boolean) {
  return [
    "rounded-full border px-3 py-1 text-[11px] font-medium transition",
    active
      ? "border-gold bg-gold-soft text-gold"
      : "border-border bg-bg-3 text-tx-1 hover:border-gold-glow hover:text-tx-0",
  ].join(" ");
}
