/**
 * Tiny client-only "last error" bus shared between RouteErrorBoundary and any
 * page that wants to surface a compact summary panel (e.g. /skills).
 *
 * Stores the most recent error in sessionStorage so it survives the boundary's
 * own retry/unmount cycle, and emits a `talentgraph:last-error` event so
 * subscribers can update without polling.
 */

export interface LastErrorRecord {
  /** Local error id — useful for the user to copy/paste in support requests. */
  id: string;
  module: string;
  route: string;
  message: string;
  /** ISO timestamp. */
  at: string;
}

const KEY = "talentgraph:last-error";
const EVT = "talentgraph:last-error";

function safeWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

export function recordLastError(
  input: Omit<LastErrorRecord, "id" | "at">
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
    return JSON.parse(raw) as LastErrorRecord;
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
    cb(detail);
  };
  w.addEventListener(EVT, handler);
  return () => w.removeEventListener(EVT, handler);
}
