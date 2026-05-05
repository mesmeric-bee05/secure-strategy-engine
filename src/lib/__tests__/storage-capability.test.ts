import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { probeStorage } from "@/lib/storage-capability";

describe("probeStorage", () => {
  let setItemSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    setItemSpy?.mockRestore();
    setItemSpy = undefined;
  });

  it("returns available + nearQuota=false when both probes succeed", () => {
    const cap = probeStorage("local");
    expect(cap.available).toBe(true);
    expect(cap.nearQuota).toBe(false);
    expect(cap.reason).toBeUndefined();
    expect(cap.testedAt).toMatch(/T/);
  });

  it("classifies SecurityError as denied", () => {
    setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const err = new Error("blocked");
      err.name = "SecurityError";
      throw err;
    });
    const cap = probeStorage("local");
    expect(cap.available).toBe(false);
    expect(cap.reason).toBe("denied");
  });

  it("classifies QuotaExceededError on the small probe as quota", () => {
    setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      const err = new Error("full");
      err.name = "QuotaExceededError";
      throw err;
    });
    const cap = probeStorage("local");
    expect(cap.available).toBe(false);
    expect(cap.reason).toBe("quota");
  });

  it("flags nearQuota when only the large probe fails", () => {
    let calls = 0;
    setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      k: string,
      v: string,
    ) {
      calls += 1;
      // First call = small probe → succeed; second = large probe → quota.
      if (calls === 1) {
        Object.defineProperty(this, k, { value: v, configurable: true });
        return;
      }
      const err = new Error("full");
      err.name = "QuotaExceededError";
      throw err;
    });
    const cap = probeStorage("local");
    expect(cap.available).toBe(true);
    expect(cap.nearQuota).toBe(true);
    expect(cap.reason).toBe("quota");
  });
});
