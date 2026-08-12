/**
 * Schema gate for security-history artifacts.
 *
 * Malformed entries must fail before anything is rendered or served, so these
 * cases lock in the exact rejection surface of the shared schema module.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { validateHistoryArtifact, formatIssues } from "@/lib/security/history-schema";

const NOW = "2026-08-12T04:51:11.745Z";

const validFinding = {
  fingerprint: "abc123def456",
  scanner: "vitest:rls",
  internal_id: "rls_missing",
  rule: "R1",
  resource: "public.profiles",
  severity: "high",
  status: "new",
  firstSeen: NOW,
  lastSeen: NOW,
};

const validRun = {
  runId: "run-123",
  timestamp: NOW,
  totals: { new: 1, recurring: 0 },
  findings: [validFinding],
};

describe("history artifact schema", () => {
  it("accepts a well-formed run file", () => {
    expect(validateHistoryArtifact("run-123.json", validRun).ok).toBe(true);
  });

  it("accepts an empty run with no findings", () => {
    expect(
      validateHistoryArtifact("run-1.json", { ...validRun, totals: {}, findings: [] }).ok,
    ).toBe(true);
  });

  it("rejects a run missing runId", () => {
    const { runId: _omit, ...noRunId } = validRun;
    const result = validateHistoryArtifact("run-123.json", noRunId);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === "runId")).toBe(true);
  });

  it("rejects an unsafe runId token", () => {
    const result = validateHistoryArtifact("run.json", { ...validRun, runId: "../etc/passwd" });
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown finding status", () => {
    const result = validateHistoryArtifact("run.json", {
      ...validRun,
      findings: [{ ...validFinding, status: "totally-new" }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("status"))).toBe(true);
  });

  it("rejects non-numeric totals", () => {
    const result = validateHistoryArtifact("run.json", {
      ...validRun,
      totals: { new: "many" },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects negative totals", () => {
    const result = validateHistoryArtifact("run.json", { ...validRun, totals: { new: -2 } });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-ISO timestamp", () => {
    const result = validateHistoryArtifact("run.json", { ...validRun, timestamp: "yesterday" });
    expect(result.ok).toBe(false);
  });

  it("rejects a finding without a fingerprint", () => {
    const { fingerprint: _omit, ...noFp } = validFinding;
    const result = validateHistoryArtifact("run.json", { ...validRun, findings: [noFp] });
    expect(result.ok).toBe(false);
  });

  it("accepts a well-formed index.json", () => {
    expect(
      validateHistoryArtifact("index.json", {
        runs: [{ runId: "run-123", timestamp: NOW, totals: { new: 0 } }],
      }).ok,
    ).toBe(true);
  });

  it("rejects a malformed index.json entry", () => {
    const result = validateHistoryArtifact("index.json", {
      runs: [{ runId: "run-123", totals: { new: 0 } }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("timestamp"))).toBe(true);
  });

  it("formats issues with the file name for CI output", () => {
    const result = validateHistoryArtifact("index.json", { runs: [{}] });
    expect(formatIssues("index.json", result.issues)).toContain("index.json →");
  });
});

describe("committed artifacts", () => {
  const dir = resolve(process.cwd(), "src/security-history");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it("has at least one committed artifact", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s conforms to the schema", (file) => {
    const data = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const result = validateHistoryArtifact(file, data);
    if (!result.ok) console.error(formatIssues(file, result.issues));
    expect(result.ok).toBe(true);
  });
});
