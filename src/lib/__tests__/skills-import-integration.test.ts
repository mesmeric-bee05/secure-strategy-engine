/**
 * End-to-end safe-text validation: simulates the real /skills import pipeline
 * (file → text → JSON.parse → parseImport → localStorage write) and asserts
 * unsafe payloads are rejected before they ever land in storage.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  DRAFT_MAP_KEY,
  friendlyImportError,
  parseImport,
} from "@/lib/skills-drafts";

async function runImport(file: File): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const raw = await file.text();
    if (raw.indexOf("\u0000") !== -1) {
      throw new Error("File contains binary (NUL) bytes");
    }
    const json: unknown = JSON.parse(raw);
    const parsed = parseImport(json);
    const current = JSON.parse(window.localStorage.getItem(DRAFT_MAP_KEY) ?? "{}");
    window.localStorage.setItem(DRAFT_MAP_KEY, JSON.stringify({ ...current, ...parsed.drafts }));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: friendlyImportError(e) };
  }
}

describe("skills import pipeline — safe-text end-to-end", () => {
  beforeEach(() => window.localStorage.clear());

  it("rejects HTML/JS payloads before writing to localStorage", async () => {
    const file = new File(
      [
        JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          drafts: { sarah: "<script>alert(1)</script> hi" },
          languages: {},
        }),
      ],
      "evil.json",
      { type: "application/json" },
    );
    const r = await runImport(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/HTML\/JS/i);
    expect(window.localStorage.getItem(DRAFT_MAP_KEY)).toBeNull();
  });

  it("rejects control characters in draft text", async () => {
    const file = new File(
      [
        JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          drafts: { sarah: "before\u0001after" },
          languages: {},
        }),
      ],
      "ctrl.json",
      { type: "application/json" },
    );
    const r = await runImport(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/control characters/i);
    expect(window.localStorage.getItem(DRAFT_MAP_KEY)).toBeNull();
  });

  it("rejects binary payloads (NUL bytes) before JSON.parse", async () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
    const file = new File([bytes], "binary.json", { type: "application/json" });
    const r = await runImport(file);
    expect(r.ok).toBe(false);
    expect(window.localStorage.getItem(DRAFT_MAP_KEY)).toBeNull();
  });

  it("happy path writes sanitized drafts to localStorage", async () => {
    const file = new File(
      [
        JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          drafts: { sarah: "I repair phones in Nairobi." },
          languages: { sarah: "en-US" },
        }),
      ],
      "ok.json",
      { type: "application/json" },
    );
    const r = await runImport(file);
    expect(r.ok).toBe(true);
    const stored = JSON.parse(window.localStorage.getItem(DRAFT_MAP_KEY) ?? "{}");
    expect(stored.sarah).toContain("repair phones");
  });
});


describe("skills import — extended HTML/JS rejection matrix", () => {
  beforeEach(() => window.localStorage.clear());

  const cases: Array<{ name: string; payload: string; matches?: RegExp }> = [
    { name: "iframe", payload: '<iframe src="javascript:alert(1)"></iframe>', matches: /HTML\/JS/i },
    { name: "img onerror", payload: '<img src=x onerror="alert(1)">', matches: /HTML\/JS/i },
    { name: "svg onload", payload: '<svg onload="alert(1)"></svg>', matches: /HTML\/JS/i },
    { name: "javascript: url", payload: "click javascript:void(0) here", matches: /HTML\/JS/i },
    { name: "data:text/html", payload: "data:text/html,<b>x</b>", matches: /HTML\/JS/i },
    { name: "bare onclick", payload: 'hello onclick="x()" world', matches: /HTML\/JS/i },
    { name: "mixed case script", payload: "<ScRiPt>alert(1)</ScRiPt>", matches: /HTML\/JS/i },
    { name: "padded script", payload: "<  script  >x</script>", matches: /HTML\/JS/i },
    { name: "vertical tab", payload: "before\u000Bafter", matches: /control characters/i },
    { name: "form feed", payload: "before\u000Cafter", matches: /control characters/i },
  ];

  for (const c of cases) {
    it(`rejects ${c.name} payload`, async () => {
      const file = new File(
        [
          JSON.stringify({
            version: 1,
            exportedAt: new Date().toISOString(),
            drafts: { sarah: c.payload },
            languages: {},
          }),
        ],
        "x.json",
        { type: "application/json" },
      );
      const r = await runImport(file);
      expect(r.ok).toBe(false);
      if (!r.ok && c.matches) expect(r.message).toMatch(c.matches);
      expect(window.localStorage.getItem(DRAFT_MAP_KEY)).toBeNull();
    });
  }

  it("rejects oversized text > 20,000 chars", async () => {
    const file = new File(
      [
        JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          drafts: { sarah: "a".repeat(20_001) },
          languages: {},
        }),
      ],
      "big.json",
      { type: "application/json" },
    );
    const r = await runImport(file);
    expect(r.ok).toBe(false);
    expect(window.localStorage.getItem(DRAFT_MAP_KEY)).toBeNull();
  });

  it("rejects non-string draft value", async () => {
    const file = new File(
      [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), drafts: { sarah: 123 }, languages: {} })],
      "n.json",
      { type: "application/json" },
    );
    const r = await runImport(file);
    expect(r.ok).toBe(false);
    expect(window.localStorage.getItem(DRAFT_MAP_KEY)).toBeNull();
  });

  it("rejects array as drafts (not plain object)", async () => {
    const file = new File(
      [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), drafts: [], languages: {} })],
      "a.json",
      { type: "application/json" },
    );
    const r = await runImport(file);
    expect(r.ok).toBe(false);
    expect(window.localStorage.getItem(DRAFT_MAP_KEY)).toBeNull();
  });

  it("strips __proto__ key without polluting Object.prototype", async () => {
    const raw = '{"version":1,"exportedAt":"2025-01-01T00:00:00Z","drafts":{"__proto__":"polluted","sarah":"ok"},"languages":{}}';
    const file = new File([raw], "p.json", { type: "application/json" });
    const r = await runImport(file);
    expect(r.ok).toBe(true);
    // Object.prototype must not be polluted.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const stored = JSON.parse(window.localStorage.getItem(DRAFT_MAP_KEY) ?? "{}");
    expect(Object.hasOwn(stored, "__proto__")).toBe(false);
    expect(stored.sarah).toBe("ok");
  });

  it("friendlyImportError returns a string for arbitrary throwables", () => {
    expect(typeof friendlyImportError(new Error("boom"))).toBe("string");
    expect(typeof friendlyImportError("oops")).toBe("string");
    expect(typeof friendlyImportError(undefined)).toBe("string");
  });
});
