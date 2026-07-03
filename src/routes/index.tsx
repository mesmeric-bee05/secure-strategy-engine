import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles, ShieldCheck, BarChart3, Globe2, LockKeyhole } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";
import { CitationsPanel } from "@/components/CitationsPanel";
import { listCountries } from "@/lib/server-fns/opportunities.functions";
import { getCitations } from "@/lib/server-fns/citations.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TalentGraph Africa — Overview · UNMAPPED" },
      {
        name: "description",
        content:
          "Map informal-economy skills in Sub-Saharan Africa to ISCO-08, see automation risk, and surface global opportunities. Built for the World Bank Unmapped challenge.",
      },
      { property: "og:title", content: "TalentGraph Africa — Overview" },
      {
        property: "og:description",
        content:
          "AI + cryptographic credentials for the 600M unmapped informal workers of Sub-Saharan Africa.",
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
  component: OverviewPage,
});

const MODULES = [
  {
    num: "01",
    to: "/skills" as const,
    title: "Skills Signal Engine",
    color: "gold" as const,
    icon: Sparkles,
    description:
      "Voice or text input → AI maps to ISCO-08 / ESCO taxonomy → portable, border-crossing skill profile",
    bullet: "Portable across borders & sectors · Human-readable output",
  },
  {
    num: "02",
    to: "/readiness" as const,
    title: "AI Readiness Lens",
    color: "coral" as const,
    icon: BarChart3,
    description:
      "Frey-Osborne automation risk scores calibrated for LMIC context · 2035 projections · Durable skill recommendations",
    bullet: "Frey & Osborne (2013) + Wittgenstein 2025-2035",
  },
  {
    num: "03",
    to: "/opportunities" as const,
    title: "Opportunity Dashboard",
    color: "teal" as const,
    icon: Globe2,
    description:
      "Real ILO econometric signals · Honest, grounded matching · Dual interface: Youth + Policymaker",
    bullet: "ILO ILOSTAT wages · World Bank WDI · Sector growth data",
  },
  {
    num: "04",
    to: "/security" as const,
    title: "Security & Trust Layer",
    color: "lav" as const,
    icon: LockKeyhole,
    description:
      "Prompt-injection guard, rate limiting, append-only audit logs, signed credentials, and fairness review controls",
    bullet: "Zero PII in logs · ECDSA attestations · CSP + RLS controls",
  },
];

function OverviewPage() {
  const { data: countries = [] } = useQuery({
    queryKey: ["countries"],
    queryFn: () => listCountries(),
  });
  const { data: citations = [] } = useQuery({
    queryKey: ["citations", null],
    queryFn: () => getCitations({ data: {} }),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-10">
        {/* Hero */}
        <section className="anim-fade-in-up rounded-2xl border border-gold/30 bg-gradient-to-br from-bg-2 via-bg-1 to-bg-0 p-8 shadow-[0_0_60px_-20px_oklch(0.770_0.140_75/0.35)] md:p-12">
          <div className="eyebrow mb-3 flex items-center gap-2">
            <span className="rounded border border-gold-glow bg-gold-soft px-2 py-0.5 font-mono">
              World Bank · Challenge 05
            </span>
            <span>UNMAPPED</span>
          </div>
          <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-tight text-tx-0 md:text-[56px]">
            Make the{" "}
            <span className="bg-gradient-to-r from-gold via-[oklch(0.82_0.16_75)] to-gold bg-clip-text text-transparent">
              600 million
            </span>{" "}
            visible.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-tx-1">
            TalentGraph Africa maps informal-economy skills to ISO occupation codes, surfaces real
            global opportunities, and anchors verified credentials cryptographically — so a
            seamstress in Eldoret becomes visible to an employer in London.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/skills"
              search={{ persona: "sarah" }}
              className="group inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2.5 text-[13px] font-semibold text-bg-0 shadow-[0_4px_16px_oklch(0.770_0.140_75/0.35)] transition hover:translate-y-[-1px]"
            >
              <Sparkles className="h-4 w-4" />
              Demo Sarah in 90 seconds
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/opportunities"
              className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-bg-3 px-5 py-2.5 text-[13px] font-medium text-tx-0 transition hover:border-gold-glow hover:bg-gold-soft hover:text-gold"
            >
              <Globe2 className="h-4 w-4" />
              Explore the Opportunity Dashboard
            </Link>
          </div>
        </section>

        {/* Country signals */}
        <section className="anim-fade-in-up delay-2 mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[14px] font-semibold tracking-tight text-tx-0">
              Country signals
            </h2>
            <p className="text-[11px] text-tx-2">Real figures · ILO ILOSTAT · World Bank WDI/HCI</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {countries.map((c) => (
              <div key={c.code} className="rounded-xl border border-border-soft bg-bg-3 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[18px]">{c.flag_emoji}</span>
                  <span className="text-[12px] font-semibold text-tx-0">{c.name}</span>
                </div>
                <Stat label="Youth unemployment" tone="coral">
                  {fmtPct(c.youth_unemployment_pct)}
                </Stat>
                <Stat label="Min wage / mo" tone="gold">
                  {c.min_wage_monthly_usd ? `$${Number(c.min_wage_monthly_usd).toFixed(0)}` : "—"}
                </Stat>
                <Stat label="Informal share" tone="lav">
                  {fmtPct(c.informal_share_pct)}
                </Stat>
                <Stat label="HCI" tone="teal">
                  {c.human_capital_index ? Number(c.human_capital_index).toFixed(2) : "—"}
                </Stat>
              </div>
            ))}
          </div>
        </section>

        {/* Modules */}
        <section className="anim-fade-in-up delay-3 mt-10">
          <PageTitle module="Product" eyebrow="Three modules">
            What you'll explore
          </PageTitle>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {MODULES.map((m) => {
              const Icon = m.icon;
              const tone = TONE_CLASSES[m.color];
              return (
                <Link
                  key={m.num}
                  to={m.to}
                  className={`group block rounded-xl border ${tone.border} bg-bg-3 p-5 transition hover:translate-y-[-2px] hover:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.6)]`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${tone.chip}`}
                    >
                      MODULE {m.num}
                    </span>
                    <Icon className={`h-5 w-5 ${tone.icon}`} />
                  </div>
                  <h3 className="font-display text-[18px] font-semibold leading-tight text-tx-0">
                    {m.title}
                  </h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-tx-1">{m.description}</p>
                  <p className={`mt-3 text-[10.5px] font-medium ${tone.icon}`}>✓ {m.bullet}</p>
                  <span
                    className={`mt-4 inline-flex items-center gap-1 text-[11px] font-semibold ${tone.icon}`}
                  >
                    Open module
                    <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Trust strip */}
        <section className="anim-fade-in-up delay-4 mt-10 grid gap-3 sm:grid-cols-3">
          <TrustItem
            icon={<ShieldCheck className="h-4 w-4 text-teal" />}
            title="Cryptographic peer attestation"
            body="ECDSA signatures via Web Crypto · 3-attestation rule"
          />
          <TrustItem
            icon={<ShieldCheck className="h-4 w-4 text-gold" />}
            title="Append-only credential anchors"
            body="SHA-256 + platform signature · public verifier · QR shareable"
          />
          <TrustItem
            icon={<ShieldCheck className="h-4 w-4 text-lavender" />}
            title="Fairness audit on every batch"
            body="Demographic parity check · flags >15% deviation for review"
          />
        </section>

        <CitationsPanel citations={citations} defaultOpen={false} />
      </div>
    </AppShell>
  );
}

const TONE_CLASSES = {
  gold: {
    border: "border-gold/30",
    chip: "border-gold-glow bg-gold-soft text-gold",
    icon: "text-gold",
  },
  teal: {
    border: "border-teal/30",
    chip: "border-teal/40 bg-teal-soft text-teal",
    icon: "text-teal",
  },
  coral: {
    border: "border-coral/30",
    chip: "border-coral/40 bg-coral-soft text-coral",
    icon: "text-coral",
  },
  lav: {
    border: "border-lavender/30",
    chip: "border-lavender/40 bg-lavender-soft text-lavender",
    icon: "text-lavender",
  },
};

function Stat({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "gold" | "teal" | "coral" | "lav";
  children: React.ReactNode;
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
    <div className="flex items-center justify-between border-t border-border-soft py-1 first:border-t-0">
      <span className="text-[10px] text-tx-2">{label}</span>
      <span className={`font-mono text-[11px] font-bold ${color}`}>{children}</span>
    </div>
  );
}

function TrustItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border-soft bg-bg-3 p-4">
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <span className="text-[12px] font-semibold text-tx-0">{title}</span>
      </div>
      <p className="text-[11.5px] leading-relaxed text-tx-2">{body}</p>
    </div>
  );
}

function fmtPct(v: number | string | null) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toFixed(1)}%`;
}
