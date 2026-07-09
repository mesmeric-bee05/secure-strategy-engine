import { describe, it, expect } from "vitest";
import {
  fingerprintFinding,
  canonicalKey,
  dedupe,
  diffAgainstPrevious,
} from "../../scripts/security/fingerprint";

describe("scripts/security/fingerprint", () => {
  it("produces the same fingerprint for equivalent findings", () => {
    const a = { scanner: "bun-audit", internal_id: "GHSA-xxx", resource: "left-pad", severity: "high" };
    const b = { scanner: "BUN-AUDIT", internal_id: " GHSA-xxx ", resource: "left-pad", severity: "high" };
    expect(fingerprintFinding(a)).toBe(fingerprintFinding(b));
  });

  it("differentiates by internal_id", () => {
    const a = { scanner: "s", internal_id: "id-1", resource: "r" };
    const b = { scanner: "s", internal_id: "id-2", resource: "r" };
    expect(fingerprintFinding(a)).not.toBe(fingerprintFinding(b));
  });

  it("falls back to evidence hash when internal_id is absent", () => {
    const a = { scanner: "s", rule: "r", evidence: "leak-x" };
    const b = { scanner: "s", rule: "r", evidence: "leak-x" };
    const c = { scanner: "s", rule: "r", evidence: "different" };
    expect(canonicalKey(a)).toBe(canonicalKey(b));
    expect(canonicalKey(a)).not.toBe(canonicalKey(c));
  });

  it("dedupes preserving first occurrence and order", () => {
    const list = [
      { scanner: "s", internal_id: "a" },
      { scanner: "s", internal_id: "b" },
      { scanner: "s", internal_id: "a" },
      { scanner: "s", internal_id: "c" },
    ];
    const out = dedupe(list);
    expect(out.map((f) => f.internal_id)).toEqual(["a", "b", "c"]);
  });

  it("diffAgainstPrevious classifies new / recurring / accepted / resolved", () => {
    const previous = [
      {
        scanner: "s",
        internal_id: "old-recurring",
        fingerprint: "",
        status: "recurring" as const,
        firstSeen: "2026-01-01T00:00:00Z",
        lastSeen: "2026-01-02T00:00:00Z",
      },
      {
        scanner: "s",
        internal_id: "old-resolved",
        fingerprint: "",
        status: "recurring" as const,
        firstSeen: "2026-01-01T00:00:00Z",
        lastSeen: "2026-01-02T00:00:00Z",
      },
    ].map((f) => ({ ...f, fingerprint: fingerprintFinding(f) }));

    const current = [
      { scanner: "s", internal_id: "old-recurring" },
      { scanner: "s", internal_id: "brand-new" },
      { scanner: "s", internal_id: "known-accepted" },
    ].map((f) => ({ ...f, fingerprint: fingerprintFinding(f) }));

    const diffed = diffAgainstPrevious(
      current,
      previous,
      [{ internal_id: "known-accepted", status: "accepted" }],
      "2026-01-03T00:00:00Z",
    );

    const byId = Object.fromEntries(diffed.map((d) => [d.internal_id, d.status]));
    expect(byId["old-recurring"]).toBe("recurring");
    expect(byId["brand-new"]).toBe("new");
    expect(byId["known-accepted"]).toBe("accepted");
    expect(byId["old-resolved"]).toBe("resolved");
  });
});
