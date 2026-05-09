// Structured JSON logger for edge functions. Picked up by Cloud log drains.
export type Severity = "info" | "warn" | "error";

export interface LogEvent {
  fn: string;
  requestId: string;
  status: number;
  latencyMs: number;
  severity?: Severity;
  userId?: string | null;
  model?: string;
  errorCode?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

export function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}

export function logEvent(e: LogEvent): void {
  const severity: Severity = e.severity ?? (e.status >= 500 ? "error" : e.status >= 400 ? "warn" : "info");
  const line = JSON.stringify({ ts: new Date().toISOString(), severity, ...e });
  if (severity === "error") console.error(line);
  else if (severity === "warn") console.warn(line);
  else console.log(line);
}
