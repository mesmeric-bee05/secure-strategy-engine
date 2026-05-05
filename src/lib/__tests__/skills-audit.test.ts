import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendAuditEvent,
  AUDIT_KEY,
  clearAuditLog,
  MAX_ENTRIES,
  readAuditLog,
} from "@/lib/skills-audit";

describe("skills-audit", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAuditLog();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("appends an event with a valid ISO timestamp and default scope", () => {
    const evt = appendAuditEvent({ kind: "export", summary: "exported" });
    expect(evt.kind).toBe("export");
    expect(evt.scope).toBe("localStorage");
    expect(Number.isNaN(Date.parse(evt.at))).toBe(false);

    const persisted = JSON.parse(window.localStorage.getItem(AUDIT_KEY) ?? "[]");
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe(evt.id);
  });

  it("flips scope to memory when localStorage write fails", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const err = new Error("denied");
      err.name = "SecurityError";
      throw err;
    });
    const evt = appendAuditEvent({ kind: "quota_blocked", summary: "blocked" });
    expect(evt.scope).toBe("memory");
    spy.mockRestore();

    // Even after restoring, readAuditLog still returns the in-memory entry.
    const log = readAuditLog();
    expect(log.find((e) => e.id === evt.id)?.scope).toBe("memory");
  });

  it("clearAuditLog wipes both persisted and in-memory buffers", () => {
    appendAuditEvent({ kind: "export", summary: "a" });
    expect(readAuditLog()).toHaveLength(1);
    clearAuditLog();
    expect(readAuditLog()).toHaveLength(0);
    expect(window.localStorage.getItem(AUDIT_KEY)).toBeNull();
  });

  it("evicts oldest entries past MAX_ENTRIES (FIFO)", () => {
    for (let i = 0; i < MAX_ENTRIES + 5; i++) {
      appendAuditEvent({ kind: "export", summary: `e${i}` });
    }
    const log = readAuditLog();
    expect(log).toHaveLength(MAX_ENTRIES);
    // Sorted DESC by `at`, so the newest is first; oldest five were evicted.
    const summaries = log.map((e) => e.summary);
    expect(summaries).toContain(`e${MAX_ENTRIES + 4}`);
    expect(summaries).not.toContain("e0");
  });
});
