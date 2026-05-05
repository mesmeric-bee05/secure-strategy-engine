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
