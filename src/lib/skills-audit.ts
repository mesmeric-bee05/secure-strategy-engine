/**
 * Append-only client-side audit log for /skills.
 *
 * Records significant LOCAL events (imports, exports, downloads, storage
 * failures) so the user can review what happened on this device without
 * relying on the browser DevTools or server-side logs.
 *
 * Persistence:
 *   - Primary: localStorage under AUDIT_KEY, capped at MAX_ENTRIES with FIFO
 *     eviction.
 *   - Fallback: in-memory ring buffer when localStorage is unavailable
 *     (private mode, denied). Entries written in fallback mode carry
 *     `scope: "memory"` so the UI can flag them.
 *
 * Privacy:
 *   - We NEVER include draft text in summaries or details.
 *   - Filenames may be included; the user supplied them.
 */

export const AUDIT_KEY = "talentgraph:skills:audit-log";
export const AUDIT_EVT = "talentgraph:skills:audit-log";
export const MAX_ENTRIES = 100;

export type AuditEventKind =
  | "import"
  | "import_rejected"
  | "export"
  | "data_download"
  | "quota_blocked"
  | "privacy_blocked";

export type AuditScope = "localStorage" | "sessionStorage" | "memory";

export interface AuditEvent {
  id: string;
  at: string;
  kind: AuditEventKind;
  scope: AuditScope;
  /** Human-readable, no PII / no draft text. */
  summary: string;
  detail?: {
    filename?: string;
    slugCount?: number;
    bytes?: number;
    reason?: string;
  };
}

export interface AppendEventInput {
  kind: AuditEventKind;
  scope?: AuditScope;
  summary: string;
  detail?: AuditEvent["detail"];
}

const memoryBuffer: AuditEvent[] = [];

function safeWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

function newId(): string {
  return `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readRaw(): AuditEvent[] {
  const w = safeWindow();
  if (!w) return [...memoryBuffer];
  try {
    const raw = w.localStorage.getItem(AUDIT_KEY);
    if (!raw) return [...memoryBuffer];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...memoryBuffer];
    // Merge persisted entries with anything still in the in-memory buffer
    // (e.g. fallback writes that happened before localStorage was probed).
    const seen = new Set<string>();
    const merged: AuditEvent[] = [];
    for (const e of [...parsed, ...memoryBuffer]) {
      if (!e || typeof e !== "object" || typeof e.id !== "string") continue;
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      merged.push(e as AuditEvent);
    }
    return merged;
  } catch {
    return [...memoryBuffer];
  }
}

function writePersisted(entries: AuditEvent[]): boolean {
  const w = safeWindow();
  if (!w) return false;
  try {
    w.localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function appendAuditEvent(input: AppendEventInput): AuditEvent {
  const w = safeWindow();
  const event: AuditEvent = {
    id: newId(),
    at: new Date().toISOString(),
    kind: input.kind,
    // Scope reflects where THIS entry was stored, not where the originating
    // event lived. Default to localStorage; fall back to memory if write fails.
    scope: input.scope ?? "localStorage",
    summary: input.summary,
    ...(input.detail ? { detail: input.detail } : {}),
  };

  const current = readRaw();
  const next = [...current, event].slice(-MAX_ENTRIES);

  const persisted = writePersisted(next);
  if (!persisted) {
    event.scope = "memory";
    // Replace the just-pushed entry with the memory-tagged version.
    next[next.length - 1] = event;
    memoryBuffer.push(event);
    if (memoryBuffer.length > MAX_ENTRIES) {
      memoryBuffer.splice(0, memoryBuffer.length - MAX_ENTRIES);
    }
  }

  if (w) {
    try {
      w.dispatchEvent(new CustomEvent(AUDIT_EVT, { detail: event }));
    } catch {
      /* noop */
    }
  }
  return event;
}

export function readAuditLog(): AuditEvent[] {
  return readRaw()
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function clearAuditLog(): void {
  memoryBuffer.length = 0;
  const w = safeWindow();
  if (w) {
    try {
      w.localStorage.removeItem(AUDIT_KEY);
      w.dispatchEvent(new CustomEvent(AUDIT_EVT, { detail: null }));
    } catch {
      /* noop */
    }
  }
}

export function subscribeAuditLog(cb: () => void): () => void {
  const w = safeWindow();
  if (!w) return () => {};
  const handler = () => cb();
  w.addEventListener(AUDIT_EVT, handler);
  return () => w.removeEventListener(AUDIT_EVT, handler);
}
