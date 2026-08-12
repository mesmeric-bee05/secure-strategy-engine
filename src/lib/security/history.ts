/**
 * Client-side loader for the nightly security findings history.
 *
 * Fetches from the authenticated /api/security/history/* server route with a
 * Supabase bearer token. Non-admins get 403; the UI shows a permission
 * message rather than a silent blank list.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  FindingStatusSchema,
  HistoryFindingSchema,
  HistoryIndexSchema,
  HistoryRunSchema,
  type FindingStatus,
  type HistoryFinding,
  type HistoryIndex,
  type HistoryRun,
} from "./history-schema";

export {
  FindingStatusSchema,
  HistoryFindingSchema,
  HistoryIndexSchema,
  HistoryRunSchema,
};
export type { FindingStatus, HistoryFinding, HistoryIndex, HistoryRun };

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

async function authorizedFetch(path: string): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new HistoryAccessError("Sign in required", 401);
  return fetch(`${BASE}/${path}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function loadHistoryIndex(): Promise<HistoryIndex> {
  const resp = await authorizedFetch("index.json");
  if (resp.status === 401 || resp.status === 403) {
    throw new HistoryAccessError(
      resp.status === 401 ? "Sign in required" : "Admin role required",
      resp.status,
    );
  }
  if (!resp.ok) return { runs: [] };
  return HistoryIndexSchema.parse(await resp.json());
}

export async function loadHistoryRun(runId: string): Promise<HistoryRun> {
  if (!/^[a-zA-Z0-9._-]+$/.test(runId)) throw new Error("invalid runId");
  const resp = await authorizedFetch(`${runId}.json`);
  if (resp.status === 401 || resp.status === 403) {
    throw new HistoryAccessError(
      resp.status === 401 ? "Sign in required" : "Admin role required",
      resp.status,
    );
  }
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
