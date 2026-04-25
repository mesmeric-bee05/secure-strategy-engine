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
      })
    ).toThrow();
  });
});
