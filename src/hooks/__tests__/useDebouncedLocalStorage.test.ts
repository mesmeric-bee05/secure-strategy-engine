/**
 * Verifies the auto-retry path of useDebouncedLocalStorage:
 *  - First write throws QuotaExceededError → status flips to "error".
 *  - When the value subsequently shrinks below the failed length, the hook
 *    immediately retries (status "retrying" → "saved").
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedLocalStorage } from "@/hooks/useDebouncedLocalStorage";

class QuotaError extends Error {
  constructor() {
    super("quota");
    this.name = "QuotaExceededError";
  }
}

describe("useDebouncedLocalStorage — quota auto-retry", () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    setItemSpy?.mockRestore();
    vi.useRealTimers();
  });

  it("transitions idle → saving → error → retrying → saved when value shrinks", async () => {
    let throwOnce = true;
    setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, k: string, v: string) {
        if (throwOnce) {
          throwOnce = false;
          throw new QuotaError();
        }
        // Fall back to default behaviour by writing into the underlying map.
        Object.defineProperty(this, k, { value: v, configurable: true });
      });

    const big = "x".repeat(1000);
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useDebouncedLocalStorage("test:key", value, { delayMs: 100 }),
      { initialProps: { value: big } }
    );

    expect(result.current.status).toBe("idle");

    // Trigger the first write attempt by changing value.
    rerender({ value: big + "y" });
    expect(result.current.status).toBe("saving");

    // Run the debounce timer → setItem throws → status="error".
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/Storage full/);

    // Now shrink the value below the failed length — the hook should retry
    // immediately (microtask timeout 0).
    const small = "y".repeat(10);
    rerender({ value: small });
    expect(result.current.status).toBe("retrying");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(result.current.status).toBe("saved");
    expect(result.current.error).toBeNull();
  });

  it("does NOT retry when the value grows after a quota error", async () => {
    setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new QuotaError();
      });

    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useDebouncedLocalStorage("test:key", value, { delayMs: 50 }),
      { initialProps: { value: "abc" } }
    );

    rerender({ value: "abcd" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(result.current.status).toBe("error");

    // Grow further → debounced "saving", not immediate "retrying".
    rerender({ value: "abcde" });
    expect(result.current.status).toBe("saving");
  });
});
