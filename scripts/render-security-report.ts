#!/usr/bin/env bun
/**
 * Renders reports/*.json into:
 *   - reports/index.html                (human-readable summary)
 *   - src/security-history/<runId>.json (fingerprinted findings, RBAC-gated)
 *   - src/security-history/latest.json  (alias for the most recent run)
 *   - src/security-history/index.json   (updated run list)
 *
 * Artifacts live under src/ (not public/) so they are only accessible via the
 * authenticated /api/security/history/* server route.
 *
 * Fingerprinting means the same underlying finding gets the same ID across
 * nightly runs so the Findings History UI can dedupe and diff.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  dedupe,
  diffAgainstPrevious,
  withFingerprint,
  type RawFinding,
  type DiffedFinding,
} from "./security/fingerprint.ts";
import {
  validateHistoryArtifact,
  formatIssues,
} from "../src/lib/security/history-schema.ts";

const ROOT = process.cwd();
const REPORTS = resolve(ROOT, "reports");
const HISTORY = resolve(ROOT, "src/security-history");
mkdirSync(REPORTS, { recursive: true });
mkdirSync(HISTORY, { recursive: true });


// --- 1. Load raw JSON reports and normalize into RawFinding[] -----------
const rawFindings: RawFinding[] = [];
for (const file of readdirSync(REPORTS).filter((f) => f.endsWith(".json"))) {
  try {
    const parsed = JSON.parse(readFileSync(join(REPORTS, file), "utf8"));
    if (Array.isArray(parsed?.testResults)) {
      for (const tr of parsed.testResults) {
        for (const a of tr.assertionResults ?? []) {
          if (a.status === "failed") {
            rawFindings.push({
              scanner: `vitest:${file.replace(/\.json$/, "")}`,
              rule: a.fullName ?? a.title,
              resource: tr.name,
              severity: "high",
              message: (a.failureMessages ?? []).join("\n").slice(0, 500),
            });
          }
        }
      }
    }
    if (parsed?.advisories && typeof parsed.advisories === "object") {
      for (const [id, adv] of Object.entries<Record<string, unknown>>(parsed.advisories)) {
        rawFindings.push({
          scanner: "bun-audit",
          internal_id: String(id),
          rule: String(adv.title ?? ""),
          resource: String(adv.module_name ?? ""),
          severity: String(adv.severity ?? "info"),
          message: String(adv.overview ?? "").slice(0, 500),
        });
      }
    }
    if (Array.isArray(parsed?.findings)) {
      for (const f of parsed.findings) rawFindings.push(f as RawFinding);
    }
  } catch {
    // skip malformed
  }
}

// --- 2. Load accepted allowlist ---------------------------------------
const acceptedPath = resolve(ROOT, "docs/security/findings.accepted.json");
const accepted = existsSync(acceptedPath)
  ? (JSON.parse(readFileSync(acceptedPath, "utf8")).findings ?? [])
  : [];

// --- 3. Fingerprint + diff against previous run -----------------------
const currentFingerprinted = dedupe(rawFindings.map(withFingerprint));
const previousPath = join(HISTORY, "latest.json");
const previous: DiffedFinding[] = existsSync(previousPath)
  ? (JSON.parse(readFileSync(previousPath, "utf8")).findings ?? [])
  : [];

const diffed = diffAgainstPrevious(currentFingerprinted, previous, accepted);

const totals = diffed.reduce<Record<string, number>>((acc, f) => {
  acc[f.status] = (acc[f.status] ?? 0) + 1;
  return acc;
}, {});

const runId = process.env.GITHUB_RUN_ID
  ? `run-${process.env.GITHUB_RUN_ID}`
  : `local-${Date.now()}`;
const timestamp = new Date().toISOString();

const runPayload = { runId, timestamp, totals, findings: diffed };

/**
 * Fail the run BEFORE writing anything if the payload is malformed — a bad
 * artifact must never land in src/security-history/ or the HTML report.
 */
function assertValid(fileName: string, payload: unknown): void {
  const result = validateHistoryArtifact(fileName, payload);
  if (!result.ok) {
    console.error(`[render-security-report] schema validation failed for ${fileName}`);
    console.error(formatIssues(fileName, result.issues));
    process.exit(1);
  }
}

assertValid(`${runId}.json`, runPayload);
writeFileSync(join(HISTORY, `${runId}.json`), JSON.stringify(runPayload, null, 2));
writeFileSync(previousPath, JSON.stringify(runPayload, null, 2));

// Update index
const indexPath = join(HISTORY, "index.json");
const existingIndex = existsSync(indexPath)
  ? (JSON.parse(readFileSync(indexPath, "utf8")).runs ?? [])
  : [];
const nextIndex = [
  ...existingIndex.filter((r: { runId: string }) => r.runId !== runId),
  { runId, timestamp, totals },
]
  .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  .slice(0, 60); // keep last 60 runs
assertValid("index.json", { runs: nextIndex });
writeFileSync(indexPath, JSON.stringify({ runs: nextIndex }, null, 2));

// --- 4. HTML summary --------------------------------------------------
function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

const rowsHtml = diffed
  .map(
    (f) => `<tr class="status-${f.status}">
      <td><code>${escape(f.fingerprint.slice(0, 12))}</code></td>
      <td><b>${escape(f.status.toUpperCase())}</b></td>
      <td>${escape(f.scanner)}</td>
      <td>${escape(f.internal_id ?? f.rule ?? "")}</td>
      <td>${escape(f.resource ?? "")}</td>
      <td>${escape(f.severity ?? "")}</td>
    </tr>`,
  )
  .join("");

const totalsHtml = Object.entries(totals)
  .map(([k, v]) => `<span class="pill pill-${k}">${escape(k)}: ${v}</span>`)
  .join(" ");

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Security nightly — ${escape(runId)}</title>
<style>
  body{font:14px/1.5 system-ui,sans-serif;max-width:1200px;margin:2rem auto;padding:0 1rem;color:#111}
  h1{border-bottom:1px solid #ddd;padding-bottom:.5rem}
  .pill{display:inline-block;padding:.15rem .5rem;border-radius:999px;font-size:12px;margin-right:.25rem;background:#eee}
  .pill-new{background:#fee2e2;color:#991b1b}
  .pill-recurring{background:#fef3c7;color:#92400e}
  .pill-accepted{background:#ede9fe;color:#5b21b6}
  .pill-ignored{background:#e5e7eb;color:#374151}
  .pill-resolved{background:#dcfce7;color:#166534}
  table{width:100%;border-collapse:collapse;margin-top:1rem}
  th,td{padding:.5rem;border-bottom:1px solid #eee;text-align:left;font-size:13px}
  th{background:#fafafa}
  tr.status-new{background:#fef2f2}
  tr.status-resolved{background:#f0fdf4}
</style></head>
<body>
  <h1>Security nightly report</h1>
  <p><b>Run</b>: <code>${escape(runId)}</code> · <b>Generated</b>: ${escape(timestamp)}</p>
  <p>${totalsHtml || "No findings."}</p>
  <table>
    <thead><tr><th>Fingerprint</th><th>Status</th><th>Scanner</th><th>Rule / ID</th><th>Resource</th><th>Severity</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body></html>`;

writeFileSync(join(REPORTS, "index.html"), html);
console.log(
  `[render-security-report] run=${runId} totals=${JSON.stringify(totals)} → reports/index.html + src/security-history/${runId}.json`,
);
