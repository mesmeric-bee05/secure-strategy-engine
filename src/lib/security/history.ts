/**
 * Client-side loader for the nightly security findings history.
 *
 * Reads static JSON published under /security/history/*.json by the
 * nightly workflow. Fully typed via Zod so a schema drift surfaces in the
 * UI as an inline error, not a silent blank list.
 */
import { z } from "zod";

export const FindingStatusSchema = z.enum([
  "new",
  "recurring",
  "accepted",
  "ignored",
  "resolved",
]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export const HistoryFindingSchema = z.object({
  fingerprint: z.string().min(4),
  scanner: z.string(),
  internal_id: z.string().optional(),
  rule: z.string().optional(),
  resource: z.string().optional(),
  severity: z.string().optional(),
  message: z.string().optional(),
  status: FindingStatusSchema,
  firstSeen: z.string(),
  lastSeen: z.string(),
});
export type HistoryFinding = z.infer<typeof HistoryFindingSchema>;

export const HistoryRunSchema = z.object({
  runId: z.string(),
  timestamp: z.string(),
  totals: z.record(z.string(), z.number()),
  findings: z.array(HistoryFindingSchema),
});
export type HistoryRun = z.infer<typeof HistoryRunSchema>;

export const HistoryIndexSchema = z.object({
  runs: z
    .array(
      z.object({
        runId: z.string(),
        timestamp: z.string(),
        totals: z.record(z.string(), z.number()),
      }),
    )
    .default([]),
});
export type HistoryIndex = z.infer<typeof HistoryIndexSchema>;

const BASE = "/security/history";

export async function loadHistoryIndex(): Promise<HistoryIndex> {
  const resp = await fetch(`${BASE}/index.json`, { cache: "no-store" });
  if (!resp.ok) return { runs: [] };
  return HistoryIndexSchema.parse(await resp.json());
}

export async function loadHistoryRun(runId: string): Promise<HistoryRun> {
  const resp = await fetch(`${BASE}/${encodeURIComponent(runId)}.json`, { cache: "no-store" });
  if (!resp.ok) throw new Error(`Run ${runId} not found`);
  return HistoryRunSchema.parse(await resp.json());
}

/** Diff two runs by fingerprint; returns per-fingerprint side-by-side rows. */
export function diffRuns(a: HistoryRun, b: HistoryRun) {
  const byFp = new Map<string, { a?: HistoryFinding; b?: HistoryFinding }>();
  for (const f of a.findings) byFp.set(f.fingerprint, { a: f });
  for (const f of b.findings) {
    const existing = byFp.get(f.fingerprint) ?? {};
    existing.b = f;
    byFp.set(f.fingerprint, existing);
  }
  return Array.from(byFp.entries()).map(([fingerprint, sides]) => ({ fingerprint, ...sides }));
}
