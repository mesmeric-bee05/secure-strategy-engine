#!/usr/bin/env bun
/**
 * Collects security findings from local repository sources and emits a
 * normalized JSON array to stdout (or --out=<path>).
 *
 * Sources:
 *   - docs/security/findings.accepted.json  (allowlist, hand-curated)
 *   - reports/*.json                        (vitest/audit output from CI)
 *
 * This does NOT call any external scanner API; it aggregates what CI has
 * already produced so `render-security-report.ts` can fingerprint + diff.
 */
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { RawFinding } from "./fingerprint.ts";

const ROOT = process.cwd();
const REPORTS_DIR = resolve(ROOT, "reports");
const ACCEPTED_PATH = resolve(ROOT, "docs/security/findings.accepted.json");

const outArg = process.argv.find((a) => a.startsWith("--out="));
const OUT = outArg ? outArg.slice("--out=".length) : "";

function loadAccepted(): RawFinding[] {
  if (!existsSync(ACCEPTED_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(ACCEPTED_PATH, "utf8")) as {
      findings?: Array<Record<string, unknown>>;
    };
    return (raw.findings ?? []).map((f) => ({
      scanner: String(f.scanner ?? "unknown"),
      internal_id: f.internal_id as string | undefined,
      resource: f.resource as string | undefined,
      status: f.status as string | undefined,
      message: (f.reason as string | undefined) ?? "",
      severity: "info",
    }));
  } catch {
    return [];
  }
}

function loadReports(): RawFinding[] {
  if (!existsSync(REPORTS_DIR)) return [];
  const out: RawFinding[] = [];
  for (const name of readdirSync(REPORTS_DIR)) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(readFileSync(join(REPORTS_DIR, name), "utf8"));
      // Vitest JSON reporter: { testResults: [{ assertionResults: [...] }] }
      if (Array.isArray(raw?.testResults)) {
        for (const tr of raw.testResults) {
          for (const a of tr.assertionResults ?? []) {
            if (a.status === "failed") {
              out.push({
                scanner: `vitest:${name.replace(/\.json$/, "")}`,
                rule: a.fullName ?? a.title,
                resource: tr.name,
                severity: "high",
                message: (a.failureMessages ?? []).join("\n").slice(0, 500),
              });
            }
          }
        }
        continue;
      }
      // bun pm audit JSON
      if (raw?.advisories && typeof raw.advisories === "object") {
        for (const [id, adv] of Object.entries<Record<string, unknown>>(raw.advisories)) {
          out.push({
            scanner: "bun-audit",
            internal_id: String(id),
            rule: String(adv.title ?? ""),
            resource: String(adv.module_name ?? ""),
            severity: String(adv.severity ?? "info"),
            message: String(adv.overview ?? "").slice(0, 500),
          });
        }
        continue;
      }
    } catch {
      // ignore malformed
    }
  }
  return out;
}

const findings: RawFinding[] = [...loadReports(), ...loadAccepted()];
const payload = JSON.stringify({ collectedAt: new Date().toISOString(), findings }, null, 2);

if (OUT) {
  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, payload);
  console.log(`[collect] wrote ${findings.length} findings → ${OUT}`);
} else {
  process.stdout.write(payload);
}
