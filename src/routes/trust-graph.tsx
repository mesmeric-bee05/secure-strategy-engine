import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  syncTrustGraph,
  findTrustedMatches,
  getTrustSubgraph,
} from "@/lib/trust-graph/trust-graph.functions";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export const Route = createFileRoute("/trust-graph")({
  head: () => ({
    meta: [
      { title: "Trust graph · TalentGraph Africa" },
      {
        name: "description",
        content:
          "Neo4j-backed trust graph linking users, verified skills, attestations and opportunities.",
      },
    ],
  }),
  component: TrustGraphPage,
});

type Match = {
  id: string;
  title: string;
  employer: string | null;
  location: string | null;
  matchedSkills: string[];
  evidenceCount: number;
  trustScore: number;
};

type Sub = {
  nodes: Array<{ id: string; label: string; kind: string }>;
  edges: Array<{ from: string; to: string; kind: string }>;
};

function TrustGraphPage() {
  const { t } = useTranslation();
  const sync = useServerFn(syncTrustGraph);
  const match = useServerFn(findTrustedMatches);
  const sub = useServerFn(getTrustSubgraph);
  const [matches, setMatches] = useState<Match[]>([]);
  const [graph, setGraph] = useState<Sub>({ nodes: [], edges: [] });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [m, g] = await Promise.all([match({ data: { limit: 10 } }), sub({})]);
      setMatches(m.matches as Match[]);
      setGraph(g as Sub);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const runSync = async () => {
    setBusy(true);
    try {
      const r = await sync({});
      toast.success(
        `Synced ${r.users} users, ${r.skills} skills, ${r.attestations} attestations, ${r.opportunities} opportunities`,
      );
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg-0 px-6 py-10 text-tx-0">
      <header className="mb-8">
        <p className="eyebrow text-gold">Trust graph · Neo4j</p>
        <h1 className="font-display text-3xl">Verified skill paths</h1>
        <p className="mt-2 max-w-2xl text-sm text-tx-1">
          A graph of users, verified skills, attestations, and opportunities.
          Matches are ranked by the cumulative trust weight of the evidence
          backing each skill.
        </p>
        <button
          onClick={runSync}
          disabled={busy}
          className="mt-3 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-bg-0 disabled:opacity-50"
        >
          Sync graph (admin)
        </button>
      </header>

      <section className="mb-10">
        <h2 className="font-display text-xl">Top trusted matches</h2>
        {busy && <p className="text-sm text-tx-1">{t("common.loading")}</p>}
        <ul className="mt-3 space-y-2">
          {matches.length === 0 && !busy && (
            <li className="text-sm text-tx-1">
              No matches yet — sync the graph or add verified skills.
            </li>
          )}
          {matches.map((m) => (
            <li
              key={m.id}
              className="rounded border border-white/10 bg-bg-1 p-3 text-sm"
            >
              <div className="flex justify-between">
                <span className="font-semibold text-tx-0">{m.title}</span>
                <span className="text-xs text-gold">
                  trust {m.trustScore.toFixed(2)} · {m.evidenceCount} evidence
                </span>
              </div>
              <div className="mt-1 text-xs text-tx-1">
                {m.employer ?? "—"} · {m.location ?? "—"}
              </div>
              <div className="mt-1 text-xs text-tx-1">
                via: {m.matchedSkills.join(", ")}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl">Your subgraph</h2>
        <p className="text-xs text-tx-1">
          {graph.nodes.length} nodes · {graph.edges.length} edges
        </p>
        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {graph.nodes.map((n) => (
            <li
              key={n.id}
              className="rounded border border-white/5 bg-bg-1 px-2 py-1 text-xs"
            >
              <span className="mr-2 rounded bg-gold/20 px-1 text-gold">
                {n.kind}
              </span>
              {n.label}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
