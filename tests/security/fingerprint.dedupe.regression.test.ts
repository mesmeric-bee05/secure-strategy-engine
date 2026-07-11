/**
 * Regression: stable fingerprinting de-duplicates recurring findings and
 * artifacts only add truly new fingerprints between runs.
 */
import { describe, it, expect } from "vitest";
import {
  fingerprintFinding,
  dedupe,
  diffAgainstPrevious,
  withFingerprint,
  type RawFinding,
  type DiffedFinding,
} from "../../scripts/security/fingerprint";

function fp<T extends RawFinding>(list: T[]) {
  return list.map(withFingerprint);
}

describe("fingerprint dedupe regression", () => {
  it("A: identical findings across two runs are all recurring, no new", () => {
    const items: RawFinding[] = [
      { scanner: "s", internal_id: "a", resource: "r1" },
      { scanner: "s", internal_id: "b", resource: "r2" },
    ];
    const runA = fp(items);
    const runB = fp(items);
    const diffed = diffAgainstPrevious(
      runB,
      runA.map<DiffedFinding>((f) => ({
        ...f,
        status: "recurring",
        firstSeen: "2026-01-01T00:00:00Z",
        lastSeen: "2026-01-01T00:00:00Z",
      })),
      [],
      "2026-01-02T00:00:00Z",
    );
    const statuses = diffed.map((d) => d.status).sort();
    expect(statuses).toEqual(["recurring", "recurring"]);
    expect(new Set(runB.map((f) => f.fingerprint))).toEqual(
      new Set(runA.map((f) => f.fingerprint)),
    );
  });

  it("B: adding one novel finding yields exactly one new fingerprint", () => {
    const prev = fp([{ scanner: "s", internal_id: "a" }, { scanner: "s", internal_id: "b" }]);
    const current = fp([
      { scanner: "s", internal_id: "a" },
      { scanner: "s", internal_id: "b" },
      { scanner: "s", internal_id: "c-new" },
    ]);
    const diffed = diffAgainstPrevious(
      current,
      prev.map<DiffedFinding>((f) => ({
        ...f,
        status: "recurring",
        firstSeen: "2026-01-01T00:00:00Z",
        lastSeen: "2026-01-01T00:00:00Z",
      })),
      [],
    );
    const newOnes = diffed.filter((d) => d.status === "new");
    expect(newOnes).toHaveLength(1);
    expect(newOnes[0].internal_id).toBe("c-new");
    expect(diffed.filter((d) => d.status === "recurring")).toHaveLength(2);
  });

  it("C: whitespace/casing/reordering variants collapse to one fingerprint", () => {
    const a = { scanner: "SUPA", internal_id: "  X_1  ", resource: "public.foo", severity: "HIGH" };
    const b = { scanner: "supa", internal_id: "x_1", resource: "public.foo", severity: "high" };
    const c = { scanner: "supa", internal_id: "x_1", resource: "public.foo", severity: "high" };
    const set = new Set([fingerprintFinding(a), fingerprintFinding(b), fingerprintFinding(c)]);
    expect(set.size).toBe(1);
    expect(dedupe([a, b, c])).toHaveLength(1);
  });

  it("D: artifact invariant — new fingerprints in run N+1 are exactly those classified 'new'", () => {
    const prev = fp([
      { scanner: "s", internal_id: "keep-1" },
      { scanner: "s", internal_id: "resolve-me" },
    ]);
    const current = fp([
      { scanner: "s", internal_id: "keep-1" },
      { scanner: "s", internal_id: "brand-new" },
    ]);
    const prevFps = new Set(prev.map((f) => f.fingerprint));
    const currentFps = new Set(current.map((f) => f.fingerprint));
    const diffed = diffAgainstPrevious(
      current,
      prev.map<DiffedFinding>((f) => ({
        ...f,
        status: "recurring",
        firstSeen: "2026-01-01T00:00:00Z",
        lastSeen: "2026-01-01T00:00:00Z",
      })),
      [],
    );
    const newFps = new Set(diffed.filter((d) => d.status === "new").map((d) => d.fingerprint));
    const trulyNew = new Set([...currentFps].filter((f) => !prevFps.has(f)));
    expect(newFps).toEqual(trulyNew);

    // Resolved: in previous, absent from current.
    const resolvedFps = diffed.filter((d) => d.status === "resolved").map((d) => d.fingerprint);
    const expectedResolved = [...prevFps].filter((f) => !currentFps.has(f));
    expect(resolvedFps.sort()).toEqual(expectedResolved.sort());
  });
});
