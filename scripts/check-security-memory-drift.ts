#!/usr/bin/env bun
/**
 * Fails CI when docs/security/security-memory.md changes without a paired update
 * to the RLS invariants fixture, findings.accepted.json, or a new migration.
 * Symmetric: findings.accepted.json changes require a memory update too.
 */
import { execSync } from "node:child_process";

const MEMORY = "docs/security/security-memory.md";
const ACCEPTED = "docs/security/findings.accepted.json";
const RLS_FIXTURE = "tests/security/__fixtures__/rls.expected.json";
const MIGRATIONS_PREFIX = "supabase/migrations/";

function diffBase(): string {
  const baseRef = process.env.GITHUB_BASE_REF;
  if (baseRef) {
    try {
      execSync(`git fetch --no-tags --depth=50 origin ${baseRef}`, { stdio: "ignore" });
      return `origin/${baseRef}`;
    } catch {
      // fall through
    }
  }
  try {
    execSync("git rev-parse HEAD~1", { stdio: "ignore" });
    return "HEAD~1";
  } catch {
    return ""; // no history — skip
  }
}

const base = diffBase();
if (!base) {
  console.log("[security-memory-drift] no git base to diff against; skipping");
  process.exit(0);
}

const raw = execSync(`git diff --name-only ${base}...HEAD`, { encoding: "utf8" });
const changed = new Set(raw.split("\n").filter(Boolean));

const memoryChanged = changed.has(MEMORY);
const acceptedChanged = changed.has(ACCEPTED);
const fixtureChanged = changed.has(RLS_FIXTURE);
const migrationAdded = [...changed].some((f) => f.startsWith(MIGRATIONS_PREFIX));

const failures: string[] = [];

if (memoryChanged && !(acceptedChanged || fixtureChanged || migrationAdded)) {
  failures.push(
    `${MEMORY} changed but none of ${ACCEPTED}, ${RLS_FIXTURE}, or a new ${MIGRATIONS_PREFIX}* file changed.`,
  );
}
if (acceptedChanged && !memoryChanged) {
  failures.push(`${ACCEPTED} changed but ${MEMORY} did not.`);
}

if (failures.length) {
  console.error("[security-memory-drift] paired-update rule violated:");
  for (const f of failures) console.error(" - " + f);
  console.error(
    "Update security-memory.md and the corresponding invariants/findings file together.",
  );
  process.exit(1);
}

console.log("[security-memory-drift] ok");
