/**
 * Client-side loader for the nightly security findings history.
 *
 * Fetches from the authenticated /api/security/history/* server route with a
 * Supabase bearer token. Non-admins get 403; the UI shows a permission
 * message rather than a silent blank list.
 *
 * Two behaviours matter for the UI:
 *  - Schema failures are returned as data (`{ ok: false, issues }`), never
 *    thrown, so one malformed artifact can't blank the whole page.
 *  - Responses are cached in memory keyed by ETag and revalidated with
 *    `If-None-Match`, so repeated authorized reads are cheap (304, no body).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  FindingStatusSchema,
  HistoryFindingSchema,
  HistoryIndexSchema,
  HistoryRunSchema,
  validateHistoryArtifact,
  type FindingStatus,
  type HistoryFinding,
  type HistoryIndex,
  type HistoryRun,
  type ValidationIssue,
} from "./history-schema";

export {
  FindingStatusSchema,
  HistoryFindingSchema,
  HistoryIndexSchema,
  HistoryRunSchema,
};
export type { FindingStatus, HistoryFinding, HistoryIndex, HistoryRun, ValidationIssue };

const BASE = "/api/security/history";

export class HistoryAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "HistoryAccessError";
  }
}

export type ArtifactResult<T> =
  | { ok: true; data: T; fromCache: boolean }
  | { ok: false; issues: ValidationIssue[] };

interface CacheEntry {
  etag: string;
  body: string;
}
const cache = new Map<string, CacheEntry>();

/** Test seam: drop the in-memory ETag cache. */
export function clearHistoryCache(): void {
  cache.clear();
}

async function fetchArtifact(file: string): Promise<{ body: string; fromCache: boolean }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new HistoryAccessError("Sign in required", 401);

  const cached = cache.get(file);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (cached) headers["If-None-Match"] = cached.etag;

  const resp = await fetch(`${BASE}/${file}`, { cache: "no-store", headers });

  if (resp.status === 304 && cached) return { body: cached.body, fromCache: true };
  if (resp.status === 401 || resp.status === 403) {
    cache.delete(file);
    throw new HistoryAccessError(
      resp.status === 401 ? "Sign in required" : "Admin role required",
      resp.status,
    );
  }
  if (!resp.ok) throw new Error(`Request for ${file} failed (${resp.status})`);

  const body = await resp.text();
  const etag = resp.headers.get("etag");
  if (etag) cache.set(file, { etag, body });
  return { body, fromCache: false };
}

function parseArtifact<T>(file: string, body: string): ArtifactResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (e) {
    return {
      ok: false,
      issues: [{ path: "(root)", pointer: "/", message: `Invalid JSON: ${String(e)}` }],
    };
  }
  const result = validateHistoryArtifact(file, json);
  if (!result.ok) return { ok: false, issues: result.issues };
  return { ok: true, data: json as T, fromCache: false };
}

export async function loadHistoryIndexResult(): Promise<ArtifactResult<HistoryIndex>> {
  const { body, fromCache } = await fetchArtifact("index.json");
  const parsed = parseArtifact<HistoryIndex>("index.json", body);
  return parsed.ok ? { ...parsed, fromCache } : parsed;
}

export async function loadHistoryRunResult(runId: string): Promise<ArtifactResult<HistoryRun>> {
  if (!/^[a-zA-Z0-9._-]+$/.test(runId)) {
    return {
      ok: false,
      issues: [{ path: "runId", pointer: "/runId", message: "invalid runId" }],
    };
  }
  const { body, fromCache } = await fetchArtifact(`${runId}.json`);
  const parsed = parseArtifact<HistoryRun>(`${runId}.json`, body);
  return parsed.ok ? { ...parsed, fromCache } : parsed;
}

/** Throwing variants kept for callers that treat malformed data as fatal. */
export async function loadHistoryIndex(): Promise<HistoryIndex> {
  const r = await loadHistoryIndexResult();
  if (!r.ok) throw new Error("Malformed index.json");
  return r.data;
}

export async function loadHistoryRun(runId: string): Promise<HistoryRun> {
  const r = await loadHistoryRunResult(runId);
  if (!r.ok) throw new Error(`Malformed run ${runId}`);
  return r.data;
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

export type DiffRow = ReturnType<typeof diffRuns>[number];

/** Row transition label used by filters and the CSV export. */
export function transitionOf(row: DiffRow): "added" | "removed" | "unchanged" {
  if (row.a && !row.b) return "removed";
  if (!row.a && row.b) return "added";
  return "unchanged";
}
