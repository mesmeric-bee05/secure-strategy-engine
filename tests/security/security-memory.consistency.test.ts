import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import rlsExpected from "./__fixtures__/rls.expected.json";

const ROOT = resolve(__dirname, "../..");
const MEMORY_PATH = resolve(ROOT, "docs/security/security-memory.md");
const ACCEPTED_PATH = resolve(ROOT, "docs/security/findings.accepted.json");

type AcceptedFinding = {
  scanner: string;
  internal_id: string;
  status: "accepted" | "ignored" | "fixed";
  resource?: string;
  reason: string;
};
type AcceptedFile = { findings: AcceptedFinding[] };

const memoryExists = existsSync(MEMORY_PATH);
const acceptedExists = existsSync(ACCEPTED_PATH);

describe("security memory consistency", () => {
  it("security-memory.md exists (required in CI)", () => {
    expect(memoryExists, `missing ${MEMORY_PATH}`).toBe(true);
  });

  it("findings.accepted.json exists (required in CI)", () => {
    expect(acceptedExists, `missing ${ACCEPTED_PATH}`).toBe(true);
  });

  if (!memoryExists || !acceptedExists) return;

  const memory = readFileSync(MEMORY_PATH, "utf8");
  const accepted = JSON.parse(readFileSync(ACCEPTED_PATH, "utf8")) as AcceptedFile;

  it("has required sections", () => {
    for (const section of ["## Access model", "## What should never happen", "## Accepted risks"]) {
      expect(memory, `missing section ${section}`).toContain(section);
    }
  });

  it("every table in rls.expected.json is named in security-memory.md", () => {
    for (const table of Object.keys(rlsExpected.tables)) {
      expect(memory, `table ${table} not mentioned in security memory`).toMatch(
        new RegExp(`\\b${table}\\b`),
      );
    }
  });

  it("every policy listed in memory maps to a policy in rls.expected.json", () => {
    // Extract backtick-quoted identifiers that look like policy names (contain _).
    const backticked = Array.from(memory.matchAll(/`([a-z][a-z0-9_]+)`/g)).map((m) => m[1]);
    const policyLike = backticked.filter((n) => n.includes("_") && !n.endsWith("()"));
    const allKnownPolicies = new Set(Object.values(rlsExpected.tables).flat());
    // Only assert on names that look like RLS policies (start with a table prefix we know).
    const tableNames = Object.keys(rlsExpected.tables);
    const referenced = policyLike.filter(
      (n) => tableNames.some((t) => n.startsWith(t)) && !tableNames.includes(n),
    );
    for (const name of referenced) {
      expect(allKnownPolicies, `memory references unknown policy \`${name}\``).toContain(name);
    }
  });

  it("every accepted/ignored finding is named in security-memory.md", () => {
    for (const f of accepted.findings) {
      if (f.status === "fixed") continue;
      expect(f.reason.trim().length, `${f.internal_id} missing reason`).toBeGreaterThan(0);
      expect(
        memory,
        `finding ${f.scanner}:${f.internal_id} not mentioned under Accepted risks`,
      ).toContain(f.internal_id);
    }
  });

  it("every ACCEPTED/IGNORED entry in memory appears in findings.accepted.json", () => {
    const acceptedSection = memory.split("## Accepted risks")[1] ?? "";
    const ids = Array.from(acceptedSection.matchAll(/\*\*[a-z_]+:([a-z0-9_]+)\*\*/gi)).map(
      (m) => m[1],
    );
    const known = new Set(accepted.findings.map((f) => f.internal_id));
    for (const id of ids) {
      expect(known, `memory lists ${id} but it's not in findings.accepted.json`).toContain(id);
    }
  });
});
