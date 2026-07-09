/**
 * Stable finding fingerprinting.
 *
 * A fingerprint is a SHA-256 over a canonical tuple of the identifying
 * fields of a finding. Same underlying issue -> same fingerprint across
 * nightly runs, even if the scanner re-orders results or reformats prose.
 */
import { createHash } from "node:crypto";

export interface RawFinding {
  scanner: string;
  internal_id?: string;
  rule?: string;
  resource?: string;
  severity?: string;
  evidence?: string;
  message?: string;
  status?: string;
}

export interface FingerprintedFinding extends RawFinding {
  fingerprint: string;
}

function norm(v: unknown): string {
  if (v == null) return "";
  return String(v).trim().toLowerCase().replace(/\s+/g, " ");
}

/** Deterministic canonical string used to derive a fingerprint. */
export function canonicalKey(f: RawFinding): string {
  // Prefer internal_id when present — the scanner already de-dupes on it.
  const id = norm(f.internal_id);
  const rule = norm(f.rule);
  const resource = norm(f.resource);
  const scanner = norm(f.scanner);
  const severity = norm(f.severity);
  if (id) return [scanner, id, resource, severity].join("|");
  // Fallback: (scanner, rule, resource, sha256(evidence))
  const evidenceHash = createHash("sha256")
    .update(norm(f.evidence) || norm(f.message))
    .digest("hex")
    .slice(0, 16);
  return [scanner, rule, resource, severity, `ev:${evidenceHash}`].join("|");
}

export function fingerprintFinding(f: RawFinding): string {
  return createHash("sha256").update(canonicalKey(f)).digest("hex").slice(0, 24);
}

export function withFingerprint<T extends RawFinding>(f: T): T & { fingerprint: string } {
  return { ...f, fingerprint: fingerprintFinding(f) };
}

/**
 * De-duplicate a list of findings, keeping the first occurrence of each
 * fingerprint. Deterministic order preserved.
 */
export function dedupe<T extends RawFinding>(findings: T[]): (T & { fingerprint: string })[] {
  const seen = new Set<string>();
  const out: (T & { fingerprint: string })[] = [];
  for (const f of findings) {
    const withFp = withFingerprint(f);
    if (seen.has(withFp.fingerprint)) continue;
    seen.add(withFp.fingerprint);
    out.push(withFp);
  }
  return out;
}

export type FindingStatus = "new" | "recurring" | "accepted" | "ignored" | "resolved";

export interface DiffedFinding extends FingerprintedFinding {
  status: FindingStatus;
  firstSeen: string; // ISO date
  lastSeen: string; // ISO date
}

/**
 * Diff a fresh run against the previous run + the accepted/ignored allowlist.
 */
export function diffAgainstPrevious(
  current: FingerprintedFinding[],
  previous: DiffedFinding[],
  accepted: { fingerprint?: string; internal_id?: string; status: string }[],
  now = new Date().toISOString(),
): DiffedFinding[] {
  const prevByFp = new Map(previous.map((p) => [p.fingerprint, p]));
  const currentFps = new Set(current.map((c) => c.fingerprint));
  const acceptedIds = new Set(
    accepted.filter((a) => a.status === "accepted").map((a) => a.internal_id ?? a.fingerprint),
  );
  const ignoredIds = new Set(
    accepted.filter((a) => a.status === "ignored").map((a) => a.internal_id ?? a.fingerprint),
  );

  const out: DiffedFinding[] = [];

  for (const c of current) {
    const prev = prevByFp.get(c.fingerprint);
    let status: FindingStatus = "new";
    if (c.internal_id && acceptedIds.has(c.internal_id)) status = "accepted";
    else if (c.internal_id && ignoredIds.has(c.internal_id)) status = "ignored";
    else if (prev) status = "recurring";
    out.push({
      ...c,
      status,
      firstSeen: prev?.firstSeen ?? now,
      lastSeen: now,
    });
  }

  // Include resolved findings (in previous but not in current) so history
  // pages can show the transition.
  for (const p of previous) {
    if (!currentFps.has(p.fingerprint)) {
      out.push({ ...p, status: "resolved", lastSeen: p.lastSeen });
    }
  }

  return out;
}
