import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, CheckCircle2, Circle, Clock, ExternalLink, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  PHASES,
  STACK,
  FEATURES,
  SECURITY,
  STATS,
  type Phase,
  type PhaseTone,
  type PhaseStatus,
} from "@/lib/dashboard-content";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Build Dashboard — TalentGraph Africa" },
      {
        name: "description",
        content:
          "Phases, tech stack, signature features, and the security checklist behind TalentGraph Africa's UNMAPPED build.",
      },
      { property: "og:title", content: "Build Dashboard — TalentGraph Africa" },
      {
        property: "og:description",
        content:
          "How TalentGraph Africa was built: 6 phases, the full stack, 10 feature commitments, 9 security checks.",
      },
    ],
  }),
  component: DashboardPage,
});

const TABS = [
  { id: "phases", label: "Phases" },
  { id: "stack", label: "Tech stack" },
  { id: "features", label: "Features" },
  { id: "security", label: "Security" },
  { id: "status", label: "Status" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function DashboardPage() {
  const [tab, setTab] = useState<TabId>("phases");

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] px-8 py-10">
        <p className="eyebrow mb-1.5">Build dashboard · World Bank · Challenge 05</p>
        <h1 className="font-display text-[26px] font-bold tracking-tight text-tx-0">
          How TalentGraph Africa was built
        </h1>
        <p className="mt-2 max-w-[680px] text-[13px] leading-relaxed text-tx-1">
          A live index of the six build phases, the full stack, the ten signature features, and the
          security checklist that gates every release. Source of truth: the architecture brief and
          security memory — kept in sync via the regression workflow.
        </p>

        <section className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border-soft bg-bg-3 p-4"
            >
              <div className={`font-mono text-[24px] font-bold ${toneText(s.tone)}`}>{s.value}</div>
              <div className="mt-1 text-[10.5px] leading-snug text-tx-1">{s.label}</div>
            </div>
          ))}
        </section>

        <div className="mt-7 flex gap-1 overflow-x-auto border-b border-border-soft">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                "whitespace-nowrap border-b-2 px-4 py-2 text-[13px] transition",
                tab === t.id
                  ? "border-gold font-semibold text-gold"
                  : "border-transparent text-tx-2 hover:text-tx-1",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "phases" && <PhasesPanel />}
          {tab === "stack" && <StackPanel />}
          {tab === "features" && <FeaturesPanel />}
          {tab === "security" && <SecurityPanel />}
          {tab === "status" && <StatusPanel />}
        </div>
      </div>
    </AppShell>
  );
}

function PhasesPanel() {
  const [open, setOpen] = useState<Set<number>>(() => new Set([1]));
  return (
    <ul className="flex flex-col gap-2.5">
      {PHASES.map((p) => (
        <PhaseCard
          key={p.num}
          phase={p}
          open={open.has(p.num)}
          onToggle={() =>
            setOpen((prev) => {
              const next = new Set(prev);
              next.has(p.num) ? next.delete(p.num) : next.add(p.num);
              return next;
            })
          }
        />
      ))}
    </ul>
  );
}

function PhaseCard({
  phase,
  open,
  onToggle,
}: {
  phase: Phase;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl border border-border-soft bg-bg-3 px-5 py-4 text-left transition hover:border-border"
      >
        <span
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
            toneDot(phase.tone),
          ].join(" ")}
        >
          {phase.num}
        </span>
        <span className="flex-1 font-display text-[14px] font-semibold text-tx-0">
          {phase.title}
        </span>
        <StatusBadge status={phase.status} />
        <span className="font-mono text-[10.5px] text-tx-2">{phase.time}</span>
        <ChevronDown
          className={`h-4 w-4 text-tx-2 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="ml-10 mt-2.5 flex flex-col gap-1.5 border-l border-border-soft pl-4">
          {phase.tasks.map((t) => (
            <li key={t.label} className="text-[12.5px] leading-relaxed text-tx-1">
              <strong className="text-tx-0">{t.label}:</strong>{" "}
              <span className="text-tx-1">{t.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function StackPanel() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {STACK.map((cat) => (
        <div
          key={cat.category}
          className="rounded-xl border border-border-soft bg-bg-3 p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${toneBg(cat.tone)}`} />
            <h3 className="font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-tx-0">
              {cat.category}
            </h3>
          </div>
          <ul className="flex flex-col gap-2">
            {cat.items.map((i) => (
              <li
                key={i.name}
                className="flex items-baseline justify-between gap-3 border-b border-border-soft py-1.5 last:border-b-0"
              >
                <span className="text-[12px] font-semibold text-tx-0">{i.name}</span>
                <span className="font-mono text-[10px] text-tx-2">{i.why}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FeaturesPanel() {
  return (
    <ul className="flex flex-col gap-2.5">
      {FEATURES.map((f) => {
        const body = (
          <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-soft font-mono text-[12px] font-bold text-gold">
              {f.num.toString().padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-display text-[13.5px] font-semibold text-tx-0">
                  {f.title}
                </span>
                {f.route && <ExternalLink className="h-3 w-3 text-tx-2" />}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-tx-1">
                {f.desc}
              </span>
            </span>
            <StatusBadge status={f.status} />
          </>
        );
        const className =
          "flex items-start gap-3 rounded-xl border border-border-soft bg-bg-3 px-4 py-3 transition hover:border-border";
        return (
          <li key={f.num}>
            {f.route ? (
              <Link to={f.route} className={className}>
                {body}
              </Link>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SecurityPanel() {
  return (
    <ul className="flex flex-col gap-2">
      {SECURITY.map((s) => (
        <li
          key={s.letter + s.title}
          className="flex items-start gap-3 rounded-xl border border-border-soft bg-bg-3 px-4 py-3"
        >
          <span
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-bold",
              secTone(s.tone),
            ].join(" ")}
          >
            {s.letter}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-[13px] font-semibold text-tx-0">{s.title}</span>
              <ShieldCheck className="h-3.5 w-3.5 text-teal" />
            </div>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-tx-1">{s.desc}</p>
          </div>
          <StatusBadge status={s.status} />
        </li>
      ))}
    </ul>
  );
}

function StatusPanel() {
  return (
    <div className="rounded-xl border border-border-soft bg-bg-3 p-6 text-[12.5px] leading-relaxed text-tx-1">
      <h3 className="font-display text-[14px] font-semibold text-tx-0">Release health</h3>
      <p className="mt-2">
        Tests, regressions, and scan deltas are gated on every PR. The full security posture is
        documented in <code className="font-mono text-gold">docs/security/findings-2026-06-12.md</code>{" "}
        and the RLS invariants are pinned in{" "}
        <code className="font-mono text-gold">tests/security/__fixtures__/rls.expected.json</code>.
      </p>
      <p className="mt-3">
        The build roadmap distilled from the architecture brief lives under{" "}
        <code className="font-mono text-gold">docs/roadmap/</code> — start at{" "}
        <code className="font-mono text-gold">00-overview.md</code>.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: PhaseStatus }) {
  if (status === "shipped") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-teal/30 bg-teal-soft px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-teal">
        <CheckCircle2 className="h-3 w-3" /> Shipped
      </span>
    );
  }
  if (status === "in-progress") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/30 bg-gold-soft px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-gold">
        <Clock className="h-3 w-3" /> In progress
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-bg-4 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-tx-2">
      <Circle className="h-3 w-3" /> Planned
    </span>
  );
}

function toneText(tone: "gold" | "teal" | "coral" | "lavender"): string {
  switch (tone) {
    case "gold": return "text-gold";
    case "teal": return "text-teal";
    case "coral": return "text-coral";
    case "lavender": return "text-lavender";
  }
}

function toneBg(tone: PhaseTone): string {
  switch (tone) {
    case "blue": return "bg-sky";
    case "teal": return "bg-teal";
    case "purple": return "bg-lavender";
    case "amber": return "bg-gold";
    case "coral": return "bg-coral";
    case "green": return "bg-emerald";
  }
}

function toneDot(tone: PhaseTone): string {
  switch (tone) {
    case "blue": return "bg-sky/20 text-sky";
    case "teal": return "bg-teal-soft text-teal";
    case "purple": return "bg-lavender-soft text-lavender";
    case "amber": return "bg-gold-soft text-gold";
    case "coral": return "bg-coral-soft text-coral";
    case "green": return "bg-emerald/15 text-emerald";
  }
}

function secTone(tone: "red" | "amber" | "blue" | "teal" | "purple"): string {
  switch (tone) {
    case "red": return "bg-coral-soft text-coral";
    case "amber": return "bg-gold-soft text-gold";
    case "blue": return "bg-sky/15 text-sky";
    case "teal": return "bg-teal-soft text-teal";
    case "purple": return "bg-lavender-soft text-lavender";
  }
}
