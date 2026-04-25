import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { MapPin, Users, Briefcase, BarChart3 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";
import { CitationsPanel, CitationChip } from "@/components/CitationsPanel";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import {
  listCountries,
  listOpportunities,
  matchOpportunities,
  type OpportunityCardDTO,
} from "@/server/opportunities.functions";
import { getCitations } from "@/server/citations.functions";

export const COUNTRY_CODES = ["KE", "GH", "NG", "ZA", "RW"] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];
export const PERSONA_SLUGS = ["sarah", "james", "amara", "kwame"] as const;
export type PersonaSlug = (typeof PERSONA_SLUGS)[number];

export const SearchSchema = z.object({
  country: z.enum(COUNTRY_CODES).optional().catch(undefined),
  view: z.enum(["youth", "policymaker"]).default("youth").catch("youth"),
  persona: z.enum(PERSONA_SLUGS).optional().catch(undefined),
});
export type OpportunitiesSearch = z.infer<typeof SearchSchema>;

/** Strongly-typed deps surfaced to the loader. */
export interface OpportunitiesLoaderDeps {
  country: CountryCode | undefined;
}

export const Route = createFileRoute("/opportunities")({
  validateSearch: SearchSchema,
  head: () => ({
    meta: [
      {
        title:
          "Opportunity Dashboard — Real ILO signals · TalentGraph Africa",
      },
      {
        name: "description",
        content:
          "Honest, grounded matching of skills to real opportunities. Youth view for job seekers; Policymaker view for program officers — backed by ILO ILOSTAT and World Bank data.",
      },
      {
        property: "og:title",
        content: "Opportunity Dashboard · TalentGraph Africa",
      },
      {
        property: "og:description",
        content:
          "Real labour-market signals + AI-grounded opportunity matching for Sub-Saharan Africa.",
      },
    ],
  }),
  loaderDeps: ({ search }): OpportunitiesLoaderDeps => ({
    country: search.country,
  }),
  loader: ({ context, deps }) => {
    const { country } = deps;
    void context.queryClient.prefetchQuery({
      queryKey: ["countries"],
      queryFn: () => listCountries(),
    });
    void context.queryClient.prefetchQuery({
      queryKey: ["opportunities", country ?? null],
      queryFn: () =>
        listOpportunities({
          data: { countryCode: country, limit: 24 },
        }),
    });
  },
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <RouteErrorBoundary
        error={error}
        reset={reset}
        module="Opportunity Dashboard"
      />
    </AppShell>
  ),
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setCountry = (country: typeof search.country) =>
    navigate({ search: (s) => ({ ...s, country }) });
  const setView = (view: "youth" | "policymaker") =>
    navigate({ search: (s) => ({ ...s, view }) });
  const setPersona = (persona: typeof search.persona) =>
    navigate({ search: (s) => ({ ...s, persona }) });

  const countriesQ = useQuery({
    queryKey: ["countries"],
    queryFn: () => listCountries(),
  });
  const opportunitiesQ = useQuery({
    queryKey: ["opportunities", search.country ?? null],
    queryFn: () =>
      listOpportunities({
        data: { countryCode: search.country, limit: 24 },
      }),
  });
  const matchedQ = useQuery({
    queryKey: ["matched", search.persona ?? null, search.country ?? null],
    queryFn: () =>
      matchOpportunities({
        data: {
          personaSlug: search.persona,
          countryCode: search.country,
          limit: 12,
        },
      }),
    enabled: !!search.persona,
  });
  const citationsQ = useQuery({
    queryKey: ["citations", search.country ?? null],
    queryFn: () => getCitations({ data: { countryCode: search.country } }),
  });

  const country = countriesQ.data?.find((c) => c.code === search.country);

  const PERSONAS = [
    { slug: "sarah" as const, label: "🧵 Sarah" },
    { slug: "james" as const, label: "📱 James" },
    { slug: "amara" as const, label: "🌾 Amara" },
    { slug: "kwame" as const, label: "🛒 Kwame" },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        <PageTitle
          module="Module 03"
          eyebrow="Opportunity Dashboard"
          description="Not aspirational matching. Real econometric signals visible at every step — youth unemployment, minimum wage, informality, human capital — plus opportunity cards drawn from real listings."
        >
          Real signals. Realistic paths.
        </PageTitle>

        {/* Country filter */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-tx-2">Country:</span>
          <button
            type="button"
            onClick={() => setCountry(undefined)}
            className={chip(!search.country)}
          >
            All
          </button>
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

        {/* Econometric strip */}
        {country && (
          <section className="mb-5 grid gap-px overflow-hidden rounded-xl border border-border-soft bg-border-soft sm:grid-cols-4">
            <Eco
              tone="coral"
              value={fmtPct(country.youth_unemployment_pct)}
              label="Youth unemployment (15–24)"
              chip="ILO ILOSTAT"
              source={country.unemployment_source ?? undefined}
            />
            <Eco
              tone="gold"
              value={
                country.min_wage_monthly_usd
                  ? `$${Number(country.min_wage_monthly_usd).toFixed(0)}`
                  : "—"
              }
              label="National min wage (monthly)"
              chip="ILO WCLD"
              source={country.wage_source ?? undefined}
            />
            <Eco
              tone="lav"
              value={fmtPct(country.informal_share_pct)}
              label="Informal employment share"
              chip="ILO"
              source={country.informal_source ?? undefined}
            />
            <Eco
              tone="teal"
              value={
                country.human_capital_index
                  ? Number(country.human_capital_index).toFixed(2)
                  : "—"
              }
              label="Human Capital Index"
              chip="WB HCI"
              source={country.hci_source ?? undefined}
            />
          </section>
        )}

        {/* View toggle */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-tx-2">Viewing as:</span>
          <button
            type="button"
            onClick={() => setView("youth")}
            className={tab(search.view === "youth", "gold")}
          >
            <Users className="h-3.5 w-3.5" />
            Youth / Job Seeker
          </button>
          <button
            type="button"
            onClick={() => setView("policymaker")}
            className={tab(search.view === "policymaker", "teal")}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Policymaker / Program Officer
          </button>
        </div>

        {search.view === "youth" ? (
          <>
            {/* Persona to match against */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-tx-2">Match against:</span>
              {PERSONAS.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() =>
                    setPersona(search.persona === p.slug ? undefined : p.slug)
                  }
                  className={chip(search.persona === p.slug)}
                >
                  {p.label}
                </button>
              ))}
              {search.persona && (
                <span className="text-[10px] text-tx-2">
                  → using persona's skill seeds (ISCO + keyword overlap)
                </span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {(search.persona
                ? matchedQ.data ?? []
                : opportunitiesQ.data ?? []
              ).map((o) => (
                <OpportunityCard key={o.id} o={o} matched={!!search.persona} />
              ))}
              {!opportunitiesQ.isLoading &&
                (opportunitiesQ.data ?? []).length === 0 && (
                  <div className="rounded-xl border border-border-soft bg-bg-3 p-6 text-center text-[12px] text-tx-2">
                    No opportunities seeded for this country yet.
                  </div>
                )}
            </div>
          </>
        ) : (
          <PolicymakerView
            opportunities={opportunitiesQ.data ?? []}
            country={country?.name ?? "all countries"}
          />
        )}

        <CitationsPanel citations={citationsQ.data ?? []} />
      </div>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Bits                                                                       */
/* -------------------------------------------------------------------------- */

function chip(active: boolean) {
  return [
    "rounded-full border px-3 py-1 text-[11px] font-medium transition",
    active
      ? "border-gold bg-gold-soft text-gold"
      : "border-border bg-bg-3 text-tx-1 hover:border-gold-glow hover:text-tx-0",
  ].join(" ");
}

function tab(active: boolean, tone: "gold" | "teal") {
  const onActive =
    tone === "gold"
      ? "border-gold-glow bg-gold-soft text-gold"
      : "border-teal/40 bg-teal-soft text-teal";
  return [
    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11.5px] font-medium transition",
    active ? onActive : "border-border bg-bg-3 text-tx-1 hover:bg-bg-4",
  ].join(" ");
}

function Eco({
  tone,
  value,
  label,
  chip,
  source,
}: {
  tone: "gold" | "teal" | "coral" | "lav";
  value: string;
  label: string;
  chip: string;
  source?: string;
}) {
  const color =
    tone === "gold"
      ? "text-gold"
      : tone === "teal"
        ? "text-teal"
        : tone === "coral"
          ? "text-coral"
          : "text-lavender";
  return (
    <div className="bg-bg-2 px-4 py-3">
      <p className={`font-mono text-[20px] font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-[10.5px] text-tx-1">{label}</p>
      {source && (
        <p className="mt-1 line-clamp-1 text-[8.5px] italic text-tx-2" title={source}>
          Source: {source}
        </p>
      )}
      <span className="mt-1 inline-block">
        <CitationChip label={chip} title={source} />
      </span>
    </div>
  );
}

function OpportunityCard({ o, matched }: { o: OpportunityCardDTO; matched: boolean }) {
  const matchTone =
    (o.match_pct ?? 0) >= 80
      ? "border-teal text-teal"
      : (o.match_pct ?? 0) >= 60
        ? "border-gold text-gold"
        : "border-border-strong text-tx-1";
  return (
    <article className="rounded-xl border border-border-soft bg-bg-3 p-4 transition hover:-translate-y-[1px] hover:border-gold-glow">
      <div className="flex items-start gap-3">
        {matched && (
          <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded border-[1.5px] ${matchTone}`}>
            <span className="font-mono text-[14px] font-bold leading-none">
              {o.match_pct ?? 0}
            </span>
            <span className="mt-0.5 text-[7px] font-bold uppercase tracking-wider">
              MATCH
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold leading-tight text-tx-0">
            {o.title}
          </h3>
          <p className="mt-0.5 text-[11px] text-tx-2">
            {o.employer ?? "—"} · {o.location ?? "—"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(o.required_skills ?? []).slice(0, 4).map((s) => (
              <span
                key={s}
                className="rounded-full border border-border bg-bg-2 px-1.5 py-0.5 text-[9px] text-tx-1"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border-soft pt-3">
        <span className="font-mono text-[13px] font-bold text-gold">
          {fmtSalary(o)}
          <span className="ml-1 font-body text-[9px] font-normal text-tx-2">
            / {o.salary_period ?? "month"}
          </span>
        </span>
        {o.is_remote && (
          <span className="rounded-full border border-teal/40 bg-teal-soft px-2 py-0.5 text-[9px] font-bold text-teal">
            REMOTE
          </span>
        )}
        {o.growth_pct !== null && o.growth_pct !== undefined && (
          <span className="rounded-full bg-teal-soft px-2 py-0.5 font-mono text-[9px] font-bold text-teal">
            +{Number(o.growth_pct).toFixed(1)}%
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-tx-2">
          <MapPin className="h-3 w-3" />
          {o.country_code ?? "—"}
        </span>
      </div>
      {o.source && (
        <p className="mt-2 text-[9px] italic text-tx-2">
          Source: {o.source_citation ?? o.source}
        </p>
      )}
    </article>
  );
}

function PolicymakerView({
  opportunities,
  country,
}: {
  opportunities: OpportunityCardDTO[];
  country: string;
}) {
  // Compute supply/demand by ISCO major group as a quick proxy.
  const buckets = new Map<string, number>();
  for (const o of opportunities) {
    for (const code of o.required_isco_codes ?? []) {
      const major = code.charAt(0);
      buckets.set(major, (buckets.get(major) ?? 0) + 1);
    }
  }
  const max = Math.max(1, ...Array.from(buckets.values()));

  const MAJOR: Record<string, string> = {
    "1": "Managers",
    "2": "Professionals",
    "3": "Technicians",
    "4": "Clerical",
    "5": "Service & sales",
    "6": "Agriculture",
    "7": "Trades & crafts",
    "8": "Operators",
    "9": "Elementary",
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border-soft bg-bg-3 p-4">
        <h3 className="mb-3 font-display text-[14px] font-semibold text-tx-0">
          Demand by ISCO major group · {country}
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
          {Object.entries(MAJOR).map(([code, label]) => {
            const v = buckets.get(code) ?? 0;
            const intensity = v / max;
            return (
              <div
                key={code}
                className="rounded-md border border-border-soft p-2"
                style={{
                  background: `oklch(0.770 0.140 75 / ${0.05 + intensity * 0.35})`,
                }}
              >
                <p className="font-mono text-[9px] text-tx-2">ISCO-{code}</p>
                <p className="text-[11px] font-semibold text-tx-0">{label}</p>
                <p className="font-mono text-[12px] font-bold text-gold">
                  {v}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] italic text-tx-2">
          Heatmap derived from `opportunities.required_isco_codes` for the
          selected country. Future iterations layer in skill-supply counts from
          the user-side `skills` table.
        </p>
      </section>

      <section className="rounded-xl border border-border-soft bg-bg-3 p-4">
        <h3 className="mb-3 font-display text-[14px] font-semibold text-tx-0">
          Recommended interventions
        </h3>
        <ul className="space-y-2">
          <Intervention
            icon={<Briefcase className="h-4 w-4" />}
            title="Targeted upskilling — Trades & Crafts"
            body="Where craft skills cluster (ISCO-7), pair informal apprenticeships with ESCO-aligned micro-credentials so they map to global hiring pipelines."
            cite="Frey & Osborne (2013) · ILO Future of Work"
          />
          <Intervention
            icon={<Users className="h-4 w-4" />}
            title="Cooperative formalization grants"
            body="Smallholder cooperatives (ISCO-6) become attestor networks once 3-attestation rule is met — unlocking export market access."
            cite="World Bank WDI 2023"
          />
          <Intervention
            icon={<BarChart3 className="h-4 w-4" />}
            title="Remote-work bridge programs"
            body="High-growth digital opportunities (ISCO-2) skew remote — invest in connectivity & soft-skill pathways for ISCO-3/5 transitions."
            cite="ILO ILOSTAT 2023"
          />
        </ul>
      </section>
    </div>
  );
}

function Intervention({
  icon,
  title,
  body,
  cite,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cite: string;
}) {
  return (
    <li className="flex gap-3 rounded-md border border-border-soft bg-bg-4 p-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold">
        {icon}
      </span>
      <div>
        <p className="text-[12px] font-semibold text-tx-0">{title}</p>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-tx-1">{body}</p>
        <p className="mt-1 font-mono text-[9px] text-teal">+ Source: {cite}</p>
      </div>
    </li>
  );
}

function fmtPct(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toFixed(1)}%`;
}
function fmtSalary(o: OpportunityCardDTO) {
  if (!o.salary_min && !o.salary_max) return "—";
  const cur = o.currency ?? "";
  const fmt = (n: number) => n.toLocaleString();
  if (o.salary_min && o.salary_max && o.salary_min !== o.salary_max) {
    return `${cur} ${fmt(o.salary_min)}–${fmt(o.salary_max)}`;
  }
  return `${cur} ${fmt(o.salary_max ?? o.salary_min!)}`;
}
