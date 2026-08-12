#!/usr/bin/env bun
/**
 * One-command local security re-scan.
 *
 *   bun run security:rescan
 *
 * Runs the same pipeline the nightly CI job runs:
 *   1. Type-check scripts + source
 *   2. Vitest security suite (RLS invariants + memory consistency)
 *   3. Collect findings into reports/*.json
 *   4. Render HTML + JSON artifacts into ./.security-out
 *   5. Print a summary table (new / recurring / accepted / ignored / resolved)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve(process.cwd(), ".security-out");
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(resolve(process.cwd(), "reports"), { recursive: true });

function run(label, cmd, args, opts = {}) {
  process.stdout.write(`\n▶ ${label}\n  $ ${cmd} ${args.join(" ")}\n`);
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    process.stderr.write(`✖ ${label} failed (exit ${r.status})\n`);
    process.exit(r.status ?? 1);
  }
  return r.status === 0;
}

run("Typecheck", "bunx", ["tsgo", "--noEmit"]);
run(
  "Vitest security suite",
  "bunx",
  [
    "vitest",
    "run",
    "tests/security/security-memory.consistency.test.ts",
    "--reporter=json",
    "--outputFile=reports/security-memory.json",
  ],
  { allowFail: true },
);
run(
  "Dependency audit",
  "bun",
  ["pm", "audit", "--json"],
  { allowFail: true },
);
run(
  "Collect findings",
  "bun",
  ["scripts/security/collect.ts", "--out=reports/collected.json"],
);
run("Render HTML report", "bun", ["scripts/render-security-report.ts"]);
run("Validate history artifacts", "bun", ["scripts/security/validate-history.ts"]);

// Copy artifacts to .security-out/ for easy download
if (existsSync("reports")) cpSync("reports", OUT_DIR, { recursive: true });

// Summary
try {
  const latest = resolve(process.cwd(), "src/security-history/latest.json");
  if (existsSync(latest)) {
    const parsed = JSON.parse(readFileSync(latest, "utf8"));
    const counts = { new: 0, recurring: 0, accepted: 0, ignored: 0, resolved: 0 };
    for (const f of parsed.findings ?? []) {
      counts[f.status] = (counts[f.status] ?? 0) + 1;
    }
    process.stdout.write(
      `\n✅ security:rescan complete\n` +
        `   new       ${counts.new}\n` +
        `   recurring ${counts.recurring}\n` +
        `   accepted  ${counts.accepted}\n` +
        `   ignored   ${counts.ignored}\n` +
        `   resolved  ${counts.resolved}\n` +
        `   artifacts → ${OUT_DIR}\n`,
    );
    if (counts.new > 0) {
      process.stderr.write(`\n⚠  ${counts.new} NEW finding(s). Review .security-out/ before pushing.\n`);
      process.exit(2);
    }
  } else {
    process.stdout.write(`\n✅ security:rescan complete (no history baseline yet)\n   artifacts → ${OUT_DIR}\n`);
  }
} catch (e) {
  process.stderr.write(`\n(couldn't compute summary: ${e?.message ?? e})\n`);
}
