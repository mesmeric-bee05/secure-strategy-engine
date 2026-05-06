/**
 * Per-persona draft persistence tests for the pure helpers in
 * `@/lib/skills-drafts`. These cover the logic the /skills route relies on
 * without needing to mount the TanStack Router shell.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  DRAFT_MAP_KEY,
  LANG_MAP_KEY,
  LEGACY_DRAFT_KEY,
  LEGACY_LANG_KEY,
  buildExport,
  hasUnsavedChanges,
  parseImport,
  readJSONMap,
  unsavedCount,
} from "@/lib/skills-drafts";

describe("skills-drafts: per-persona persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("isolates drafts per persona slug and restores them on re-read", () => {
    const initial: Record<string, string> = {};
    const afterSarah = { ...initial, sarah: "screen repair, motherboards" };
    const afterJames = { ...afterSarah, james: "smallholder farming" };

    window.localStorage.setItem(DRAFT_MAP_KEY, JSON.stringify(afterJames));
    const restored = readJSONMap<string>(DRAFT_MAP_KEY, LEGACY_DRAFT_KEY);

    expect(restored.sarah).toBe("screen repair, motherboards");
    expect(restored.james).toBe("smallholder farming");
    // Other personas remain undefined / not auto-populated.
    expect(restored.amara).toBeUndefined();
  });

  it("migrates legacy single-key draft into the 'default' bucket", () => {
    window.localStorage.setItem(LEGACY_DRAFT_KEY, "old free-text draft");
    const map = readJSONMap<string>(DRAFT_MAP_KEY, LEGACY_DRAFT_KEY);
    expect(map).toEqual({ default: "old free-text draft" });
  });

  it("migrates legacy single-key language into the 'default' bucket", () => {
    window.localStorage.setItem(LEGACY_LANG_KEY, "sw-KE");
    const map = readJSONMap<string>(LANG_MAP_KEY, LEGACY_LANG_KEY);
    expect(map).toEqual({ default: "sw-KE" });
  });

  it("returns {} on malformed JSON without throwing", () => {
    window.localStorage.setItem(DRAFT_MAP_KEY, "{not json");
    const map = readJSONMap<string>(DRAFT_MAP_KEY, LEGACY_DRAFT_KEY);
    expect(map).toEqual({});
  });

  it("hasUnsavedChanges reflects diff vs saved snapshot per slug", () => {
    const current = { sarah: "edited", james: "same" };
    const saved = { sarah: "original", james: "same" };
    expect(hasUnsavedChanges(current, saved, "sarah")).toBe(true);
    expect(hasUnsavedChanges(current, saved, "james")).toBe(false);
    expect(hasUnsavedChanges(current, saved, "missing")).toBe(false);
  });

  it("unsavedCount counts only diverging slugs", () => {
    const current = { sarah: "a", james: "b", amara: "c" };
    const saved = { sarah: "a", james: "B", amara: "c" };
    expect(unsavedCount(current, saved)).toBe(1);
  });

  it("buildExport snapshots both maps with version + timestamp", () => {
    const exp = buildExport({
      drafts: { sarah: "x" },
      languages: { sarah: "en-US" },
      now: new Date("2026-01-15T10:30:00Z"),
    });
    expect(exp.version).toBe(1);
    expect(exp.exportedAt).toBe("2026-01-15T10:30:00.000Z");
    expect(exp.drafts).toEqual({ sarah: "x" });
    expect(exp.languages).toEqual({ sarah: "en-US" });
  });

  it("parseImport drops unknown languages but keeps drafts", () => {
    const parsed = parseImport({
      version: 1,
      exportedAt: new Date().toISOString(),
      drafts: { sarah: "x", james: "y" },
      languages: { sarah: "en-US", james: "klingon-XX" },
    });
    expect(parsed.drafts).toEqual({ sarah: "x", james: "y" });
    expect(parsed.languages).toEqual({ sarah: "en-US" });
    expect(parsed.droppedLanguages).toEqual(["james=klingon-XX"]);
  });

  it("parseImport throws on wrong version", () => {
    expect(() =>
      parseImport({
        version: 2,
        exportedAt: new Date().toISOString(),
        drafts: {},
        languages: {},
      }),
    ).toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* Hardened parseImport                                                        */
/* -------------------------------------------------------------------------- */
import { friendlyImportError } from "@/lib/skills-drafts";

describe("parseImport: hardened shape validation", () => {
  const baseValid = () => ({
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    drafts: {},
    languages: {},
  });

  it("rejects drafts that is an array", () => {
    expect(() => parseImport({ ...baseValid(), drafts: ["a", "b"] as unknown })).toThrow();
  });

  it("rejects drafts with a non-string value", () => {
    expect(() =>
      parseImport({ ...baseValid(), drafts: { sarah: 123 as unknown as string } }),
    ).toThrow();
  });

  it("rejects languages that is null", () => {
    expect(() => parseImport({ ...baseValid(), languages: null as unknown as object })).toThrow();
  });

  it("strips __proto__ rather than allowing prototype pollution", () => {
    const malicious = JSON.parse(
      `{"version":1,"exportedAt":"2026-01-01T00:00:00.000Z","drafts":{"__proto__":"x","sarah":"ok"},"languages":{}}`,
    );
    const parsed = parseImport(malicious);
    expect(parsed.drafts).toEqual({ sarah: "ok" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects unknown top-level keys (strict)", () => {
    expect(() => parseImport({ ...baseValid(), evil: "extra" } as unknown)).toThrow();
  });

  it("drops empty/whitespace-only drafts", () => {
    const parsed = parseImport({
      ...baseValid(),
      drafts: { sarah: "", james: "   ", amara: "real text" },
    });
    expect(parsed.drafts).toEqual({ amara: "real text" });
  });

  it("rejects slug keys with disallowed characters", () => {
    expect(() =>
      parseImport({
        ...baseValid(),
        drafts: { "has space": "x" },
      }),
    ).toThrow();
  });
});

describe("friendlyImportError", () => {
  it("describes JSON syntax errors", () => {
    expect(friendlyImportError(new SyntaxError("bad json"))).toMatch(/not valid JSON/i);
  });

  it("describes version mismatch", () => {
    let caught: unknown;
    try {
      parseImport({
        version: 2,
        exportedAt: new Date().toISOString(),
        drafts: {},
        languages: {},
      });
    } catch (e) {
      caught = e;
    }
    expect(friendlyImportError(caught)).toMatch(/version/i);
  });

  it("describes drafts shape errors", () => {
    let caught: unknown;
    try {
      parseImport({
        version: 1,
        exportedAt: new Date().toISOString(),
        drafts: ["a"] as unknown,
        languages: {},
      });
    } catch (e) {
      caught = e;
    }
    expect(friendlyImportError(caught)).toMatch(/drafts/i);
  });

  it("falls back to a generic string for unknown errors", () => {
    expect(friendlyImportError(new Error("boom"))).toMatch(/boom/);
    expect(friendlyImportError(undefined)).toMatch(/Could not import/i);
  });
});

/* -------------------------------------------------------------------------- */
/* pickDefaultAction                                                           */
/* -------------------------------------------------------------------------- */
import { pickDefaultAction } from "@/lib/skills-drafts";

describe("pickDefaultAction", () => {
  it("overwrites when current is empty", () => {
    expect(pickDefaultAction({ incomingText: "hi", currentText: "" })).toBe("overwrite");
  });
  it("keeps when content is identical", () => {
    expect(pickDefaultAction({ incomingText: "same", currentText: "same" })).toBe("keep");
  });
  it("overwrites when incoming exportedAt is strictly newer", () => {
    expect(
      pickDefaultAction({
        incomingText: "new",
        currentText: "old",
        incomingExportedAt: "2026-05-05T10:00:00Z",
        currentSavedAt: "2026-05-04T10:00:00Z",
      }),
    ).toBe("overwrite");
  });
  it("keeps when incoming is older", () => {
    expect(
      pickDefaultAction({
        incomingText: "x",
        currentText: "y",
        incomingExportedAt: "2026-01-01T00:00:00Z",
        currentSavedAt: "2026-05-01T00:00:00Z",
      }),
    ).toBe("keep");
  });
  it("falls back to keep when timestamps are missing", () => {
    expect(pickDefaultAction({ incomingText: "a", currentText: "b" })).toBe("keep");
  });
});

/* -------------------------------------------------------------------------- */
/* assertSafeText matrix                                                       */
/* -------------------------------------------------------------------------- */
import { assertSafeText, SafeTextError } from "@/lib/skills-drafts";

describe("assertSafeText", () => {
  it("accepts plain unicode text", () => {
    expect(() => assertSafeText("Hello 你好 — café")).not.toThrow();
  });
  it.each([
    ["control char", "before\u0001after"],
    ["script tag", "<script>x</script>"],
    ["svg onload", "<svg onload=alert(1)>"],
    ["javascript URL", "click javascript:alert(1)"],
    ["event handler", '<img onerror="x">'],
    ["data:html", "data:text/html,<x>"],
  ])("rejects %s", (_, payload) => {
    expect(() => assertSafeText(payload)).toThrow(SafeTextError);
  });
  it("rejects non-string input", () => {
    expect(() => assertSafeText(123 as unknown)).toThrow(SafeTextError);
  });
});

import {
  LOCAL_DATA_DUMP_VERSION,
  buildLocalDataDump,
  parseLocalDataDump,
} from "@/lib/skills-drafts";

describe("local-data dump: schemaVersion + parser", () => {
  it("buildLocalDataDump emits a top-level schemaVersion", () => {
    const dump = buildLocalDataDump({ drafts: { sarah: "hi" }, languages: {} });
    expect(dump.schemaVersion).toBe(LOCAL_DATA_DUMP_VERSION);
    expect(dump.schemaVersion).toBe(1);
  });

  it("parseLocalDataDump round-trips a freshly built dump", () => {
    const dump = buildLocalDataDump({ drafts: { sarah: "hi" }, languages: {} });
    const result = parseLocalDataDump(JSON.parse(JSON.stringify(dump)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dump.schemaVersion).toBe(1);
  });

  it("rejects an unknown schemaVersion", () => {
    const r = parseLocalDataDump({ schemaVersion: 99, generatedAt: "x", personas: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("unknown_schema_version");
      expect(r.got).toBe(99);
    }
  });

  it("rejects non-object payloads", () => {
    expect(parseLocalDataDump(null).ok).toBe(false);
    expect(parseLocalDataDump("nope").ok).toBe(false);
    expect(parseLocalDataDump([]).ok).toBe(false);
    const missing = parseLocalDataDump({ schemaVersion: 1 });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe("invalid_shape");
  });
});

import { migrateLocalDataDump } from "@/lib/skills-drafts";

describe("migrateLocalDataDump", () => {
  it("returns migrated=false for a current-version dump", () => {
    const dump = buildLocalDataDump({ drafts: { sarah: "hi" }, languages: {} });
    const m = migrateLocalDataDump(JSON.parse(JSON.stringify(dump)));
    expect(m).not.toBeNull();
    expect(m!.migrated).toBe(false);
    expect(m!.fromVersion).toBe(1);
  });

  it("upgrades a v0 (pre-versioned) dump to v1", () => {
    const legacy = {
      // no schemaVersion
      generatedAt: "2025-01-01T00:00:00Z",
      personas: [{ slug: "sarah", text: "hi" }],
    };
    const m = migrateLocalDataDump(legacy);
    expect(m).not.toBeNull();
    expect(m!.migrated).toBe(true);
    expect(m!.fromVersion).toBe(0);
    expect(m!.dump.schemaVersion).toBe(1);
    expect(m!.notes.length).toBeGreaterThan(0);
  });

  it("returns null for a future schemaVersion", () => {
    const future = { schemaVersion: 99, generatedAt: "x", personas: [] };
    expect(migrateLocalDataDump(future)).toBeNull();
  });

  it("returns null for unrecognisable shape", () => {
    expect(migrateLocalDataDump(null)).toBeNull();
    expect(migrateLocalDataDump({ schemaVersion: 1 })).toBeNull();
  });
});

describe("classifyImportError", () => {
  it("classifies SyntaxError as JSON syntax", async () => {
    const { classifyImportError } = await import("@/lib/skills-drafts");
    const c = classifyImportError(new SyntaxError("bad"));
    expect(c.rule).toBe("JSON syntax");
    expect(c.hint).toMatch(/JSON/i);
  });

  it("classifies SafeTextError as Safe text", async () => {
    const { classifyImportError, SafeTextError } = await import("@/lib/skills-drafts");
    const c = classifyImportError(new SafeTextError("contains HTML/JS-like content"));
    expect(c.rule).toBe("Safe text");
  });

  it("falls back to Import for unknown errors", async () => {
    const { classifyImportError } = await import("@/lib/skills-drafts");
    expect(classifyImportError("???").rule).toBe("Import");
  });
});
