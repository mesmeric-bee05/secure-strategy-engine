/**
 * Single source of truth for the shape of nightly security-history artifacts.
 *
 * Shared by:
 *  - scripts/render-security-report.ts (validates before writing)
 *  - scripts/security/validate-history.ts (CI gate over committed artifacts)
 *  - src/routes/api/security/history.$file.ts (server route)
 *  - src/lib/security/history.ts (client loader)
 *
 * Keep this module dependency-free apart from zod so Bun scripts can import it
 * directly without the Vite `@/` alias.
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

const IsoTimestamp = z
  .string()
  .min(20)
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "not an ISO timestamp" });

const RunId = z
  .string()
  .min(3)
  .regex(/^[a-zA-Z0-9._-]+$/, "runId must be a safe filename token");

export const TotalsSchema = z.record(
  z.string(),
  z.number().int().nonnegative("totals must be non-negative integers"),
);

export const HistoryFindingSchema = z.object({
  fingerprint: z.string().min(4),
  scanner: z.string().min(1),
  internal_id: z.string().optional(),
  rule: z.string().optional(),
  resource: z.string().optional(),
  severity: z.string().optional(),
  message: z.string().optional(),
  status: FindingStatusSchema,
  firstSeen: IsoTimestamp,
  lastSeen: IsoTimestamp,
});
export type HistoryFinding = z.infer<typeof HistoryFindingSchema>;

export const HistoryRunSchema = z.object({
  runId: RunId,
  timestamp: IsoTimestamp,
  totals: TotalsSchema,
  findings: z.array(HistoryFindingSchema),
});
export type HistoryRun = z.infer<typeof HistoryRunSchema>;

export const HistoryIndexSchema = z.object({
  runs: z
    .array(
      z.object({
        runId: RunId,
        timestamp: IsoTimestamp,
        totals: TotalsSchema,
      }),
    )
    .default([]),
});
export type HistoryIndex = z.infer<typeof HistoryIndexSchema>;

export interface ValidationIssue {
  path: string;
  /** RFC 6901 JSON pointer, e.g. `/findings/12/severity`. */
  pointer: string;
  message: string;
  /** Zod issue code (e.g. `invalid_type`, `too_small`), useful for UI hints. */
  code?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

/** Convert a zod path array into an RFC 6901 JSON pointer. */
export function toJsonPointer(path: ReadonlyArray<string | number | symbol>): string {
  if (path.length === 0) return "";
  return (
    "/" +
    path
      .map((p) => String(p).replace(/~/g, "~0").replace(/\//g, "~1"))
      .join("/")
  );
}

function toIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => ({
    path: i.path.length ? i.path.join(".") : "(root)",
    pointer: toJsonPointer(i.path) || "/",
    message: i.message,
    code: i.code,
  }));
}

/** Validate one artifact by filename convention (index.json vs a run file). */
export function validateHistoryArtifact(fileName: string, data: unknown): ValidationResult {
  const schema = fileName === "index.json" ? HistoryIndexSchema : HistoryRunSchema;
  const parsed = schema.safeParse(data);
  return parsed.success ? { ok: true, issues: [] } : { ok: false, issues: toIssues(parsed.error) };
}

export function formatIssues(fileName: string, issues: ValidationIssue[]): string {
  return issues.map((i) => `  ${fileName} → ${i.pointer}: ${i.message}`).join("\n");
}

