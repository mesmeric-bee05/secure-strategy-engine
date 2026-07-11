import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, History, ShieldOff, Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";
import {
  loadHistoryIndex,
  loadHistoryRun,
  diffRuns,
  HistoryAccessError,
  type FindingStatus,
  type HistoryIndex,
  type HistoryRun,
} from "@/lib/security/history";

export const Route = createFileRoute("/security/findings-history")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Findings History — TalentGraph Security" },
      {
        name: "description",
        content:
          "Browse nightly security scan reports and see each finding’s status side by side (new, recurring, accepted, ignored, resolved). Admin-only.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FindingsHistoryPage,
});




function FindingsHistoryPage() {
  const [index, setIndex] = useState<HistoryIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<null | { status: number; message: string }>(null);
  const [runs, setRuns] = useState<Record<string, HistoryRun>>({});
  const [selected, setSelected] = useState<string[]>([]);

  const handleError = (e: unknown) => {
    if (e instanceof HistoryAccessError) {
      setAccessDenied({ status: e.status, message: e.message });
      return;
    }
    setError(String(e));
  };

  useEffect(() => {
    loadHistoryIndex()
      .then((idx) => {
        setIndex(idx);
        const latest = [...idx.runs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setSelected(latest.slice(0, 2).map((r) => r.runId));
      })
      .catch(handleError);
  }, []);

  useEffect(() => {
    if (accessDenied) return;
    for (const runId of selected) {
      if (runs[runId]) continue;
      loadHistoryRun(runId)
        .then((run) => setRuns((r) => ({ ...r, [runId]: run })))
        .catch(handleError);
    }
  }, [selected, runs, accessDenied]);


  const [runA, runB] = selected;
  const diffRows = useMemo(() => {
    if (!runA || !runB || !runs[runA] || !runs[runB]) return [];
    return diffRuns(runs[runA], runs[runB]);
  }, [runA, runB, runs]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        <PageTitle
          module="Trust Layer"
          eyebrow="Findings History"
          description="Every nightly security scan is fingerprinted and archived here. Compare two runs side by side to spot new issues, watch recurring risk, and confirm resolutions."
        >
          Nightly findings archive
        </PageTitle>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-coral/40 bg-coral-soft p-3 text-[12px] text-coral"
          >
            Couldn’t load findings history: {error}
          </div>
        )}

        <section className="mb-5 rounded-2xl border border-border-soft bg-bg-3 p-5">
          <div className="mb-3 flex items-center gap-2 text-tx-0">
            <History className="h-4 w-4 text-gold" aria-hidden />
            <h2 className="font-display text-[16px] font-semibold">Runs</h2>
            <span className="ml-auto font-mono text-[10px] text-tx-2">
              {index?.runs.length ?? 0} archived
            </span>
          </div>

          {!index && !error && <p className="text-[12px] text-tx-2">Loading…</p>}
          {index && index.runs.length === 0 && (
            <p className="text-[12px] text-tx-2">
              No nightly runs archived yet. Trigger the workflow or run
              <code className="mx-1 rounded bg-bg-4 px-1 font-mono">bun run security:rescan</code>.
            </p>
          )}

          {index && index.runs.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border-soft">
              <table className="w-full text-left text-[11.5px]">
                <thead className="sticky top-0 bg-bg-4 text-[10px] uppercase tracking-wider text-tx-2">
                  <tr>
                    <th className="p-2">Compare</th>
                    <th className="p-2">Run</th>
                    <th className="p-2">Timestamp</th>
                    <th className="p-2 text-right">New</th>
                    <th className="p-2 text-right">Recurring</th>
                    <th className="p-2 text-right">Accepted</th>
                    <th className="p-2 text-right">Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {index.runs
                    .slice()
                    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                    .map((r) => {
                      const checked = selected.includes(r.runId);
                      return (
                        <tr key={r.runId} className="border-t border-border-soft">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              aria-label={`Include run ${r.runId} in comparison`}
                              checked={checked}
                              onChange={(e) => {
                                setSelected((sel) => {
                                  if (e.target.checked) {
                                    return [...sel, r.runId].slice(-2);
                                  }
                                  return sel.filter((s) => s !== r.runId);
                                });
                              }}
                            />
                          </td>
                          <td className="p-2 font-mono text-tx-1">{r.runId}</td>
                          <td className="p-2 text-tx-2">{r.timestamp}</td>
                          <td className="p-2 text-right text-coral">{r.totals.new ?? 0}</td>
                          <td className="p-2 text-right text-gold">
                            {r.totals.recurring ?? 0}
                          </td>
                          <td className="p-2 text-right text-lavender">
                            {r.totals.accepted ?? 0}
                          </td>
                          <td className="p-2 text-right text-teal">{r.totals.resolved ?? 0}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {runA && runB && (
          <section className="rounded-2xl border border-border-soft bg-bg-3 p-5">
            <h2 className="mb-3 font-display text-[16px] font-semibold text-tx-0">
              <span className="text-tx-2">Side-by-side:</span>{" "}
              <span className="font-mono text-teal">{runA}</span>{" "}
              <span className="text-tx-2">vs</span>{" "}
              <span className="font-mono text-gold">{runB}</span>
            </h2>

            {diffRows.length === 0 && (
              <p className="text-[12px] text-tx-2">Loading run details…</p>
            )}

            <div className="space-y-2">
              {diffRows.map((row) => (
                <article
                  key={row.fingerprint}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-border-soft bg-bg-4 p-3 md:grid-cols-[220px_1fr_1fr]"
                >
                  <div>
                    <p className="font-mono text-[10px] text-tx-2">{row.fingerprint.slice(0, 12)}</p>
                    <p className="mt-1 text-[11px] text-tx-1">
                      {row.a?.rule ?? row.b?.rule ?? row.a?.internal_id ?? row.b?.internal_id}
                    </p>
                    <p className="mt-1 font-mono text-[9.5px] text-tx-2">
                      {row.a?.scanner ?? row.b?.scanner}
                    </p>
                  </div>
                  <StatusCell finding={row.a} label={runA} />
                  <StatusCell finding={row.b} label={runB} />
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function StatusCell({
  finding,
  label,
}: {
  finding?: { status: FindingStatus; resource?: string; severity?: string };
  label: string;
}) {
  if (!finding) {
    return (
      <div className="rounded border border-border-soft bg-bg-3 p-2 text-[10.5px] text-tx-2">
        <span className="font-mono text-[9.5px]">{label}</span>
        <div className="mt-1 inline-flex items-center gap-1 text-teal">
          <CheckCircle2 className="h-3 w-3" aria-hidden /> Not present
        </div>
      </div>
    );
  }
  const meta = STATUS_META[finding.status];
  const Icon = meta.icon;
  return (
    <div className="rounded border border-border-soft bg-bg-3 p-2 text-[10.5px] text-tx-1">
      <span className="font-mono text-[9.5px] text-tx-2">{label}</span>
      <div className={`mt-1 inline-flex items-center gap-1 ${meta.className}`}>
        <Icon className="h-3 w-3" aria-hidden /> {meta.label}
      </div>
      {finding.resource && (
        <p className="mt-1 font-mono text-[9.5px] text-tx-2">{finding.resource}</p>
      )}
      {finding.severity && (
        <p className="mt-0.5 font-mono text-[9.5px] text-tx-2">severity: {finding.severity}</p>
      )}
    </div>
  );
}

const STATUS_META: Record<FindingStatus, { label: string; className: string; icon: typeof AlertTriangle }> = {
  new: { label: "NEW", className: "text-coral", icon: Sparkles },
  recurring: { label: "RECURRING", className: "text-gold", icon: AlertTriangle },
  accepted: { label: "ACCEPTED", className: "text-lavender", icon: ShieldOff },
  ignored: { label: "IGNORED", className: "text-tx-2", icon: ShieldOff },
  resolved: { label: "RESOLVED", className: "text-teal", icon: CheckCircle2 },
};
