/**
 * Tiny client-only "last error" bus shared between RouteErrorBoundary and any
 * page that wants to surface a compact summary panel (e.g. /skills).
 *
 * Stores the most recent error in sessionStorage so it survives the boundary's
 * own retry/unmount cycle, and emits a `talentgraph:last-error` event so
 * subscribers can update without polling.
 *
 * Errors older than `MAX_AGE_MS` (24h) are considered stale and surfaced as
 * `expired` so the UI can render a muted "Expired" state instead of a fresh
 * alert. Stale records are also auto-cleared on next read.
 */

export interface LastErrorRecord {
  /** Local error id — useful for the user to copy/paste in support requests. */
  id: string;
  module: string;
  route: string;
  message: string;
  /** ISO timestamp. */
  at: string;
  /** True when the record is older than MAX_AGE_MS. */
  expired?: boolean;
}

const KEY = "talentgraph:last-error";
const EVT = "talentgraph:last-error";
/** Maximum age before a record is considered stale. */
export const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

function safeWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

function isExpired(rec: Pick<LastErrorRecord, "at">): boolean {
  const ts = Date.parse(rec.at);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > MAX_AGE_MS;
}

export function recordLastError(
  input: Omit<LastErrorRecord, "id" | "at" | "expired">
): LastErrorRecord {
  const rec: LastErrorRecord = {
    ...input,
    id: `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  const w = safeWindow();
  if (!w) return rec;
  try {
    w.sessionStorage.setItem(KEY, JSON.stringify(rec));
    w.dispatchEvent(new CustomEvent(EVT, { detail: rec }));
  } catch {
    /* sessionStorage may be disabled — silently degrade */
  }
  return rec;
}

export function readLastError(): LastErrorRecord | null {
  const w = safeWindow();
  if (!w) return null;
  try {
    const raw = w.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastErrorRecord;
    if (isExpired(parsed)) {
      // Auto-purge stale records so they don't accumulate, but surface one
      // final "expired" payload so the UI can show the expired pill briefly.
      try {
        w.sessionStorage.removeItem(KEY);
      } catch {
        /* noop */
      }
      return { ...parsed, expired: true };
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearLastError(): void {
  const w = safeWindow();
  if (!w) return;
  try {
    w.sessionStorage.removeItem(KEY);
    w.dispatchEvent(new CustomEvent(EVT, { detail: null }));
  } catch {
    /* noop */
  }
}

export function subscribeLastError(
  cb: (rec: LastErrorRecord | null) => void
): () => void {
  const w = safeWindow();
  if (!w) return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<LastErrorRecord | null>).detail ?? null;
    if (detail && isExpired(detail)) {
      cb({ ...detail, expired: true });
      return;
    }
    cb(detail);
  };
  w.addEventListener(EVT, handler);
  return () => w.removeEventListener(EVT, handler);
}
