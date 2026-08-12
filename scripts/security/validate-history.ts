#!/usr/bin/env bun
/**
 * CI gate: validate every committed security-history artifact against the
 * shared JSON schema. Exits non-zero on the first malformed file so a bad
 * artifact can never reach the rendering step or the admin UI.
 *
 *   bun run security:validate
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { validateHistoryArtifact, formatIssues } from "../../src/lib/security/history-schema.ts";

const HISTORY = resolve(process.cwd(), "src/security-history");

if (!existsSync(HISTORY)) {
  console.log("[validate-history] no src/security-history directory — nothing to validate");
  process.exit(0);
}

const files = readdirSync(HISTORY).filter((f) => f.endsWith(".json"));
let failures = 0;

for (const file of files) {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(join(HISTORY, file), "utf8"));
  } catch (e) {
    failures++;
    console.error(`[validate-history] ${file}: invalid JSON — ${(e as Error).message}`);
    continue;
  }
  const result = validateHistoryArtifact(file, data);
  if (!result.ok) {
    failures++;
    console.error(`[validate-history] ${file}: schema validation failed`);
    console.error(formatIssues(file, result.issues));
  }
}

if (failures > 0) {
  console.error(`[validate-history] ${failures} of ${files.length} artifact(s) invalid`);
  process.exit(1);
}

console.log(`[validate-history] ${files.length} artifact(s) valid`);
