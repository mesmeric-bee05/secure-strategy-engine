import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, History, ShieldOff, Sparkles } from "lucide-react";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";
import {
  logSecurityHistoryCsvExport,
  logSecurityHistoryView,
} from "@/lib/server-fns/security.functions";
import { downloadCsv, safeFileToken, toCsv, type CsvColumn } from "@/lib/security/csv";
import {
  loadHistoryIndexResult,
  loadHistoryRunResult,
  diffRuns,
  transitionOf,
  HistoryAccessError,
  type DiffRow,
  type FindingStatus,
  type HistoryIndex,
  type HistoryRun,
  type ValidationIssue,
} from "@/lib/security/history";

const ALL_STATUSES: FindingStatus[] = ["new", "recurring", "accepted", "ignored", "resolved"];
const ALL_TRANSITIONS = ["added", "removed", "unchanged"] as const;
const PAGE_SIZES = [25, 50, 100] as const;

const csvList = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").filter(Boolean) : []));

const searchSchema = z.object({
  status: csvList,
  transition: csvList,
  scanner: z.string().optional().catch(undefined),
  severity: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().catch(25),
});

export const Route = createFileRoute("/security/findings-history")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => {
    const parsed = searchSchema.safeParse(search);
    return parsed.success
      ? parsed.data
      : { status: [], transition: [], page: 1, pageSize: 25 as number };
  },
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
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [index, setIndex] = useState<HistoryIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState<null | { status: number; message: string }>(null);
  const [runs, setRuns] = useState<Record<string, HistoryRun>>({});
  const [invalid, setInvalid] = useState<Record<string, ValidationIssue[]>>({});
  const [indexIssues, setIndexIssues] = useState<ValidationIssue[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const handleError = (e: unknown) => {
    if (e instanceof HistoryAccessError) {
      setAccessDenied({ status: e.status, message: e.message });
      return;
    }
    setError(String(e));
  };

  // Audit the page view exactly once per mount (best-effort, never blocking).
  const viewLogged = useRef(false);
  useEffect(() => {
    if (viewLogged.current) return;
    viewLogged.current = true;
    void logSecurityHistoryView().catch(() => {
      /* audit is best-effort; UI must not break */
    });
  }, []);

  useEffect(() => {
    loadHistoryIndexResult()
      .then((res) => {
        if (!res.ok) {
          setIndexIssues(res.issues);
          return;
        }
        setIndex(res.data);
        const latest = [...res.data.runs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setSelected(latest.slice(0, 2).map((r) => r.runId));
      })
      .catch(handleError);
  }, []);

  useEffect(() => {
    if (accessDenied) return;
    for (const runId of selected) {
      if (runs[runId] || invalid[runId]) continue;
      loadHistoryRunResult(runId)
        .then((res) => {
          if (!res.ok) {
            setInvalid((m) => ({ ...m, [runId]: res.issues }));
            return;
          }
          setRuns((r) => ({ ...r, [runId]: res.data }));
        })
        .catch(handleError);
    }
  }, [selected, runs, invalid, accessDenied]);

  const [runA, runB] = selected;
  const allRows = useMemo(() => {
    if (!runA || !runB || !runs[runA] || !runs[runB]) return [];
    return diffRuns(runs[runA], runs[runB]);
  }, [runA, runB, runs]);

  const scanners = useMemo(
    () => uniq(allRows.map((r) => r.a?.scanner ?? r.b?.scanner)),
    [allRows],
  );
  const severities = useMemo(
    () => uniq(allRows.flatMap((r) => [r.a?.severity, r.b?.severity])),
    [allRows],
  );

  const statusFilter = search.status as string[];
  const transitionFilter = search.transition as string[];
  const query = (search.q ?? "").trim().toLowerCase();

  const filtered = useMemo(
    () =>
      allRows.filter((row) => {
        const statuses = [row.a?.status, row.b?.status].filter(Boolean) as string[];
        if (statusFilter.length && !statuses.some((s) => statusFilter.includes(s))) return false;
        if (transitionFilter.length && !transitionFilter.includes(transitionOf(row))) return false;
        if (search.scanner && (row.a?.scanner ?? row.b?.scanner) !== search.scanner) return false;
        if (
          search.severity &&
          ![row.a?.severity, row.b?.severity].includes(search.severity as string)
        )
          return false;
        if (query) {
          const haystack = [
            row.fingerprint,
            row.a?.rule,
            row.b?.rule,
            row.a?.internal_id,
            row.b?.internal_id,
            row.a?.resource,
            row.b?.resource,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      }),
    [allRows, statusFilter, transitionFilter, search.scanner, search.severity, query],
  );

  const pageSize = PAGE_SIZES.includes(search.pageSize as (typeof PAGE_SIZES)[number])
    ? (search.pageSize as number)
    : 25;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, search.page), pageCount);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const setSearch = useCallback(
    (patch: Record<string, unknown>) => {
      void navigate({
        search: (prev: Record<string, unknown>) => ({ ...prev, page: 1, ...patch }),
        replace: true,
      });
    },
    [navigate],
  );

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const hasFilters =
    statusFilter.length > 0 ||
    transitionFilter.length > 0 ||
    Boolean(search.scanner) ||
    Boolean(search.severity) ||
    Boolean(query);

  const onExport = () => {
    const csv = toCsv(filtered, CSV_COLUMNS);
    downloadCsv(`findings-${safeFileToken(runA ?? "a")}-vs-${safeFileToken(runB ?? "b")}.csv`, csv);
    void logSecurityHistoryCsvExport({ data: { rowCount: filtered.length } }).catch(() => {
      /* audit is best-effort */
    });
  };

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

        {accessDenied && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-gold/40 bg-bg-4 p-4 text-[13px] text-tx-0"
          >
            <p className="font-semibold text-gold">Access restricted</p>
            <p className="mt-1 text-tx-1">
              {accessDenied.status === 401
                ? "Sign in with a Security admin account to view nightly findings."
                : "Your account doesn't have the Security admin role required to view findings history."}
            </p>
          </div>
        )}

        {error && !accessDenied && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-coral/40 bg-coral-soft p-3 text-[12px] text-coral"
          >
            Couldn’t load findings history: {error}
          </div>
        )}

        {indexIssues && <SchemaErrorCard file="index.json" issues={indexIssues} />}
        {Object.entries(invalid).map(([runId, issues]) => (
          <SchemaErrorCard key={runId} file={`${runId}.json`} issues={issues} />
        ))}

        <section className="mb-5 rounded-2xl border border-border-soft bg-bg-3 p-5">
          <div className="mb-3 flex items-center gap-2 text-tx-0">
            <History className="h-4 w-4 text-gold" aria-hidden />
            <h2 className="font-display text-[16px] font-semibold">Runs</h2>
            <span className="ml-auto font-mono text-[10px] text-tx-2">
              {index?.runs.length ?? 0} archived
            </span>
          </div>

          {!index && !error && !indexIssues && <p className="text-[12px] text-tx-2">Loading…</p>}
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
                        <tr
                          key={r.runId}
                          data-testid={`run-row-${r.runId}`}
                          className="border-t border-border-soft"
                        >
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
                          <td className="p-2 text-right text-gold">{r.totals.recurring ?? 0}</td>
                          <td className="p-2 text-right text-lavender">{r.totals.accepted ?? 0}</td>
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

            {/* ---- Filter bar ---- */}
            <div
              data-testid="filters-bar"
              className="mb-4 space-y-3 rounded-xl border border-border-soft bg-bg-4 p-3"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[10px] uppercase tracking-wider text-tx-2">Status</span>
                {ALL_STATUSES.map((s) => (
                  <FilterChip
                    key={s}
                    label={STATUS_META[s].label}
                    testId={`filter-status-${s}`}
                    active={statusFilter.includes(s)}
                    onClick={() =>
                      setSearch({ status: toggleIn(statusFilter, s).join(",") || undefined })
                    }
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[10px] uppercase tracking-wider text-tx-2">Change</span>
                {ALL_TRANSITIONS.map((t) => (
                  <FilterChip
                    key={t}
                    label={t}
                    testId={`filter-transition-${t}`}
                    active={transitionFilter.includes(t)}
                    onClick={() =>
                      setSearch({
                        transition: toggleIn(transitionFilter, t).join(",") || undefined,
                      })
                    }
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-[10.5px] text-tx-2">
                  Scanner
                  <select
                    aria-label="Filter by scanner"
                    value={search.scanner ?? ""}
                    onChange={(e) => setSearch({ scanner: e.target.value || undefined })}
                    className="rounded border border-border-soft bg-bg-3 px-2 py-1 text-[11px] text-tx-1"
                  >
                    <option value="">All</option>
                    {scanners.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-1 text-[10.5px] text-tx-2">
                  Severity
                  <select
                    aria-label="Filter by severity"
                    value={search.severity ?? ""}
                    onChange={(e) => setSearch({ severity: e.target.value || undefined })}
                    className="rounded border border-border-soft bg-bg-3 px-2 py-1 text-[11px] text-tx-1"
                  >
                    <option value="">All</option>
                    {severities.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <input
                  type="search"
                  aria-label="Search findings"
                  placeholder="Search rule, id, resource…"
                  value={search.q ?? ""}
                  onChange={(e) => setSearch({ q: e.target.value || undefined })}
                  className="min-w-[200px] flex-1 rounded border border-border-soft bg-bg-3 px-2 py-1 text-[11px] text-tx-1 placeholder:text-tx-2"
                />

                <button
                  type="button"
                  onClick={() =>
                    setSearch({
                      status: undefined,
                      transition: undefined,
                      scanner: undefined,
                      severity: undefined,
                      q: undefined,
                    })
                  }
                  disabled={!hasFilters}
                  data-testid="clear-filters"
                  className="rounded border border-border-soft px-2 py-1 text-[11px] text-tx-1 disabled:opacity-40"
                >
                  Clear filters
                </button>

                <button
                  type="button"
                  onClick={onExport}
                  disabled={filtered.length === 0}
                  data-testid="download-csv"
                  title={
                    filtered.length === 0
                      ? "No findings match the current filters"
                      : "Export the filtered findings as CSV"
                  }
                  className="inline-flex items-center gap-1 rounded border border-gold/50 bg-gold/10 px-2 py-1 text-[11px] font-semibold text-gold disabled:opacity-40"
                >
                  <Download className="h-3 w-3" aria-hidden /> Download CSV
                </button>
              </div>

              <p
                role="status"
                aria-live="polite"
                data-testid="filter-count"
                className="font-mono text-[10.5px] text-tx-2"
              >
                Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, filtered.length)} of {filtered.length} findings
                {allRows.length !== filtered.length ? ` (filtered from ${allRows.length})` : ""}
              </p>
            </div>

            {allRows.length === 0 && <p className="text-[12px] text-tx-2">Loading run details…</p>}
            {allRows.length > 0 && filtered.length === 0 && (
              <p data-testid="no-matches" className="text-[12px] text-tx-2">
                No findings match the current filters.
              </p>
            )}

            <div className="space-y-2">
              {pageRows.map((row) => (
                <article
                  key={row.fingerprint}
                  data-testid={`diff-row-${row.fingerprint}`}
                  data-transition={transitionOf(row)}
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
                  <StatusCell finding={row.a} label={runA} run="a" />
                  <StatusCell finding={row.b} label={runB} run="b" />
                </article>
              ))}
            </div>

            {/* ---- Pagination ---- */}
            {filtered.length > 0 && (
              <div
                data-testid="pagination"
                className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-tx-2"
              >
                <label className="flex items-center gap-1">
                  Rows
                  <select
                    aria-label="Rows per page"
                    value={pageSize}
                    onChange={(e) => setSearch({ pageSize: Number(e.target.value) })}
                    className="rounded border border-border-soft bg-bg-3 px-2 py-1 text-tx-1"
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  data-testid="page-prev"
                  disabled={page <= 1}
                  onClick={() => setSearch({ page: page - 1 })}
                  className="rounded border border-border-soft px-2 py-1 text-tx-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <span data-testid="page-label" className="font-mono">
                  Page {page} of {pageCount}
                </span>
                <button
                  type="button"
                  data-testid="page-next"
                  disabled={page >= pageCount}
                  onClick={() => setSearch({ page: page + 1 })}
                  className="rounded border border-border-soft px-2 py-1 text-tx-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

function uniq(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();
}

function FilterChip({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
        active
          ? "border-gold bg-gold/15 text-gold"
          : "border-border-soft bg-bg-3 text-tx-2 hover:text-tx-1"
      }`}
    >
      {label}
    </button>
  );
}

function SchemaErrorCard({ file, issues }: { file: string; issues: ValidationIssue[] }) {
  return (
    <div
      role="alert"
      data-testid={`schema-error-${file}`}
      className="mb-4 rounded-xl border border-coral/40 bg-coral-soft p-4 text-[12px]"
    >
      <p className="font-semibold text-coral">
        {file} failed schema validation — this artifact was skipped
      </p>
      <ul className="mt-2 space-y-1 font-mono text-[10.5px] text-tx-1">
        {issues.slice(0, 25).map((i, n) => (
          <li key={`${i.pointer}-${n}`}>
            <span className="text-gold">{i.pointer}</span> — {i.message}
            {i.code ? ` (${i.code})` : ""}
          </li>
        ))}
      </ul>
      {issues.length > 25 && (
        <p className="mt-1 text-[10.5px] text-tx-2">…and {issues.length - 25} more.</p>
      )}
    </div>
  );
}

const CSV_COLUMNS: ReadonlyArray<CsvColumn<DiffRow>> = [
  { header: "fingerprint", value: (r) => r.fingerprint },
  { header: "scanner", value: (r) => r.a?.scanner ?? r.b?.scanner },
  { header: "rule", value: (r) => r.a?.rule ?? r.b?.rule },
  { header: "internal_id", value: (r) => r.a?.internal_id ?? r.b?.internal_id },
  { header: "resource", value: (r) => r.a?.resource ?? r.b?.resource },
  { header: "severity", value: (r) => r.a?.severity ?? r.b?.severity },
  { header: "status_a", value: (r) => r.a?.status ?? "absent" },
  { header: "status_b", value: (r) => r.b?.status ?? "absent" },
  { header: "firstSeen", value: (r) => r.a?.firstSeen ?? r.b?.firstSeen },
  { header: "lastSeen", value: (r) => r.b?.lastSeen ?? r.a?.lastSeen },
  { header: "transition", value: (r) => transitionOf(r) },
];

function StatusCell({
  finding,
  label,
  run,
}: {
  finding?: { status: FindingStatus; resource?: string; severity?: string };
  label: string;
  run: "a" | "b";
}) {
  if (!finding) {
    return (
      <div
        data-run={run}
        data-status="absent"
        className="rounded border border-border-soft bg-bg-3 p-2 text-[10.5px] text-tx-2"
      >
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
    <div
      data-run={run}
      data-status={finding.status}
      className="rounded border border-border-soft bg-bg-3 p-2 text-[10.5px] text-tx-1"
    >
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

const STATUS_META: Record<
  FindingStatus,
  { label: string; className: string; icon: typeof AlertTriangle }
> = {
  new: { label: "NEW", className: "text-coral", icon: Sparkles },
  recurring: { label: "RECURRING", className: "text-gold", icon: AlertTriangle },
  accepted: { label: "ACCEPTED", className: "text-lavender", icon: ShieldOff },
  ignored: { label: "IGNORED", className: "text-tx-2", icon: ShieldOff },
  resolved: { label: "RESOLVED", className: "text-teal", icon: CheckCircle2 },
};
