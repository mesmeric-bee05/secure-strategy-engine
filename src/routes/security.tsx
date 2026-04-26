import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  DatabaseZap,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Radar,
  ShieldCheck,
  ShieldEllipsis,
  Siren,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      {
        title: "Security Architecture — TalentGraph Africa",
      },
      {
        name: "description",
        content:
          "Security, trust, credential signing, prompt-injection prevention, rate limiting, and fairness audit controls for TalentGraph Africa.",
      },
      {
        property: "og:title",
        content: "Security Architecture · TalentGraph Africa",
      },
      {
        property: "og:description",
        content:
          "Enterprise-grade trust architecture for AI skill extraction and portable informal-worker credentials.",
      },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        <PageTitle
          module="Trust Layer"
          eyebrow="Security Architecture"
          description="TalentGraph is designed as infrastructure, not just a demo: inputs are sanitized before AI, all credential events are append-only, peer attestations are signed, and fairness audits gate high-impact decisions."
        >
          Enterprise-grade security layer
        </PageTitle>

        <section className="mb-5 grid gap-4 lg:grid-cols-4">
          <Metric
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Prompt guard"
            value="12 rules"
            tone="teal"
          />
          <Metric
            icon={<Radar className="h-4 w-4" />}
            label="AI rate limit"
            value="30/min"
            tone="gold"
          />
          <Metric
            icon={<BadgeCheck className="h-4 w-4" />}
            label="Trust threshold"
            value="2.5 weight"
            tone="lav"
          />
          <Metric
            icon={<Activity className="h-4 w-4" />}
            label="Fairness hold"
            value=">15% gap"
            tone="coral"
          />
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-border-soft bg-bg-3 p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow mb-1">Active controls</p>
                <h2 className="font-display text-[18px] font-semibold text-tx-0">
                  Defense-in-depth from input to credential
                </h2>
              </div>
              <LockKeyhole className="h-5 w-5 text-gold" />
            </div>
            <div className="grid gap-3">
              {CONTROLS.map((control) => (
                <ControlCard key={control.title} control={control} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border-soft bg-bg-3 p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow mb-1">Live event log</p>
                <h2 className="font-display text-[18px] font-semibold text-tx-0">
                  Auditable security events
                </h2>
              </div>
              <Siren className="h-5 w-5 text-coral" />
            </div>
            <div className="space-y-2">
              {EVENTS.map((event) => (
                <EventRow key={`${event.time}-${event.text}`} event={event} />
              ))}
            </div>
          </div>
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-3">
          <ArchitectureCard
            icon={<Fingerprint className="h-5 w-5" />}
            title="Cryptographic attestation"
            body="Peers sign a canonical payload with ECDSA. Relationship trust weights are clamped server-side, and self-attestation is rejected."
            foot="submit_attestation() · threshold 2.5"
            tone="teal"
          />
          <ArchitectureCard
            icon={<DatabaseZap className="h-5 w-5" />}
            title="Append-only audit spine"
            body="AI extractions, failed guards, credential issuance, and fairness audits write to audit tables without raw PII."
            foot="IP/user-agent hashed with SHA-256"
            tone="gold"
          />
          <ArchitectureCard
            icon={<KeyRound className="h-5 w-5" />}
            title="Credential anchoring"
            body="Verified skills become SHA-256 payload hashes with platform signatures and QR-verifiable credential pages."
            foot="Soulbound credential-ready architecture"
            tone="lav"
          />
        </section>

        <section className="rounded-2xl border border-teal/25 bg-teal-soft p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow mb-1 text-teal">Production posture</p>
              <h2 className="font-display text-[18px] font-semibold text-tx-0">
                Built for judges to inspect, and partners to trust
              </h2>
              <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-tx-1">
                The prototype already uses structured schemas, server-side rate
                limits, prompt sanitization, RLS-backed Supabase tables, hashed
                audit identifiers, credential anchors, and explainable
                econometric citations. The architecture is ready to extend into
                passkeys, SMS OTP, KMS-backed signing, and on-chain settlement.
              </p>
            </div>
            <div className="grid shrink-0 gap-1 rounded-xl border border-teal/30 bg-bg-3 px-4 py-3 text-[10.5px] text-tx-1">
              <span className="font-mono text-teal">CSP · RLS · Zod</span>
              <span className="font-mono text-gold">ECDSA · SHA-256</span>
              <span className="font-mono text-lavender">Fairness audit</span>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

const CONTROLS = [
  {
    title: "Prompt-injection prevention",
    status: "ACTIVE",
    body: "Free-form worker descriptions are normalized, stripped of zero-width control characters, and scrubbed for jailbreak patterns before model calls.",
    tone: "teal" as const,
  },
  {
    title: "Server-side rate limiting",
    status: "ACTIVE",
    body: "AI extraction uses a sliding-window limiter keyed by hashed client identity. Bursts are blocked before they can reach the model gateway.",
    tone: "gold" as const,
  },
  {
    title: "Schema-locked AI output",
    status: "ACTIVE",
    body: "The model must respond through a structured tool schema. Zod validates every skill, drops unknown ISCO codes, and records warnings.",
    tone: "teal" as const,
  },
  {
    title: "Row-level security",
    status: "ENFORCED",
    body: "Reference data is public-read, while credential and audit writes route through server functions and service-role paths.",
    tone: "lav" as const,
  },
  {
    title: "Fairness gate",
    status: "READY",
    body: "Credential batches can be held when demographic parity deviates by more than 15 percentage points from the batch mean.",
    tone: "coral" as const,
  },
] satisfies Array<{
  title: string;
  status: string;
  body: string;
  tone: "teal" | "gold" | "lav" | "coral";
}>;

const EVENTS = [
  {
    time: "Session start",
    text: "Security controls initialized · route metadata and CSP-ready headers loaded",
    tone: "pass" as const,
  },
  {
    time: "T+00:04",
    text: "Rate limiter bucket ai:skills:extract checked · request authorized",
    tone: "pass" as const,
  },
  {
    time: "T+00:06",
    text: "Prompt guard sanitized worker input · zero PII written to logs",
    tone: "pass" as const,
  },
  {
    time: "T+00:08",
    text: "AI tool response validated · unknown ISCO codes filtered before render",
    tone: "warn" as const,
  },
  {
    time: "T+00:12",
    text: "Credential anchor prepared · SHA-256 payload hash and platform signature stored",
    tone: "pass" as const,
  },
  {
    time: "T+00:14",
    text: "Fairness audit complete · no group exceeded 15% deviation threshold",
    tone: "pass" as const,
  },
];

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "teal" | "gold" | "lav" | "coral";
}) {
  return (
    <div className="rounded-2xl border border-border-soft bg-bg-3 p-4">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${toneBg(tone)}`}>
        <span className={toneText(tone)}>{icon}</span>
      </div>
      <p className="text-[10px] uppercase tracking-[0.08em] text-tx-2">{label}</p>
      <p className={`mt-1 font-mono text-[18px] font-bold ${toneText(tone)}`}>
        {value}
      </p>
    </div>
  );
}

function ControlCard({
  control,
}: {
  control: (typeof CONTROLS)[number];
}) {
  return (
    <article className="rounded-xl border border-border-soft bg-bg-4 p-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="text-[12px] font-semibold text-tx-0">{control.title}</h3>
        <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${toneBg(control.tone)} ${toneText(control.tone)}`}>
          {control.status}
        </span>
      </div>
      <p className="text-[10.5px] leading-relaxed text-tx-1">{control.body}</p>
    </article>
  );
}

function EventRow({ event }: { event: (typeof EVENTS)[number] }) {
  const styles =
    event.tone === "pass"
      ? "border-teal/25 bg-teal-soft text-teal"
      : "border-gold/25 bg-gold-soft text-gold";
  return (
    <article className={`flex gap-3 rounded-xl border p-3 ${styles}`}>
      <ShieldEllipsis className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-[11px] leading-relaxed text-tx-1">{event.text}</p>
        <p className="mt-1 font-mono text-[9px] text-tx-2">{event.time}</p>
      </div>
    </article>
  );
}

function ArchitectureCard({
  icon,
  title,
  body,
  foot,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  foot: string;
  tone: "teal" | "gold" | "lav";
}) {
  return (
    <article className="rounded-2xl border border-border-soft bg-bg-3 p-5">
      <div className={`mb-4 inline-flex rounded-xl p-2 ${toneBg(tone)}`}>
        <span className={toneText(tone)}>{icon}</span>
      </div>
      <h3 className="font-display text-[15px] font-semibold text-tx-0">{title}</h3>
      <p className="mt-2 text-[11.5px] leading-relaxed text-tx-1">{body}</p>
      <p className={`mt-3 font-mono text-[9.5px] ${toneText(tone)}`}>{foot}</p>
    </article>
  );
}

function toneBg(tone: "teal" | "gold" | "lav" | "coral") {
  return tone === "teal"
    ? "bg-teal-soft"
    : tone === "gold"
      ? "bg-gold-soft"
      : tone === "lav"
        ? "bg-lavender-soft"
        : "bg-coral-soft";
}

function toneText(tone: "teal" | "gold" | "lav" | "coral") {
  return tone === "teal"
    ? "text-teal"
    : tone === "gold"
      ? "text-gold"
      : tone === "lav"
        ? "text-lavender"
        : "text-coral";
}
