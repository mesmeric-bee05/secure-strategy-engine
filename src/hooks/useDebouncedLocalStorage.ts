import { useCallback, useEffect, useRef, useState } from "react";

export type PersistStatus = "idle" | "saving" | "saved" | "error" | "retrying";

export interface UseDebouncedLocalStorageOptions {
  /** Debounce delay in ms. Default 500ms. */
  delayMs?: number;
  /** If true, "saved" pulse auto-fades back to "idle" after `flashMs`. */
  flashSaved?: boolean;
  flashMs?: number;
}

export interface UseDebouncedLocalStorageReturn {
  status: PersistStatus;
  error: string | null;
  /** Manually re-attempt the latest write (e.g. after the user freed space). */
  retry: () => void;
}

/**
 * Persists a string value to localStorage on a debounce. Returns the current
 * persistence status so the UI can show a "Saved" indicator (and a quota
 * warning when writes fail).
 *
 * Quota auto-retry:
 *   When a write fails with QuotaExceededError we remember the failed
 *   serialized length. If the value subsequently shrinks below that length
 *   we re-attempt the write immediately (bypassing the debounce) so the
 *   user's next deletion is enough to recover without manual action.
 */
export function useDebouncedLocalStorage(
  key: string,
  value: string,
  {
    delayMs = 500,
    flashSaved = true,
    flashMs = 1500,
  }: UseDebouncedLocalStorageOptions = {}
): UseDebouncedLocalStorageReturn {
  const [status, setStatus] = useState<PersistStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const firstRun = useRef(true);
  const lastFailedLenRef = useRef<number | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const writeNow = useCallback(
    (next: string, retrying: boolean): boolean => {
      if (typeof window === "undefined") return false;
      try {
        window.localStorage.setItem(key, next);
        lastFailedLenRef.current = null;
        setError(null);
        setStatus("saved");
        if (flashSaved) {
          window.setTimeout(() => {
            setStatus((s) => (s === "saved" ? "idle" : s));
          }, flashMs);
        }
        return true;
      } catch (e) {
        const isQuota =
          e instanceof Error &&
          (e.name === "QuotaExceededError" ||
            // Firefox legacy name
            e.name === "NS_ERROR_DOM_QUOTA_REACHED");
        const msg = isQuota
          ? "Storage full — draft not saved"
          : e instanceof Error
            ? e.message
            : "Could not save draft";
        if (isQuota) lastFailedLenRef.current = next.length;
        setError(retrying ? `Retry failed: ${msg}` : msg);
        setStatus("error");
        return false;
      }
    },
    [key, flashSaved, flashMs]
  );

  // Debounced primary write effect.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip the initial mount — value was just hydrated from storage.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    // Auto-retry path: after a quota failure, if the value shrinks we retry
    // immediately rather than waiting for the debounce window.
    const prevFailedLen = lastFailedLenRef.current;
    if (prevFailedLen !== null && value.length < prevFailedLen) {
      setStatus("retrying");
      // Immediate microtask retry so the UI reflects the recovery in the
      // same tick as the user's deletion.
      const handle = window.setTimeout(() => {
        writeNow(value, true);
      }, 0);
      return () => window.clearTimeout(handle);
    }

    setStatus("saving");
    const handle = window.setTimeout(() => {
      writeNow(value, false);
    }, delayMs);

    return () => window.clearTimeout(handle);
  }, [key, value, delayMs, writeNow]);

  const retry = useCallback(() => {
    setStatus("retrying");
    writeNow(valueRef.current, true);
  }, [writeNow]);

  return { status, error, retry };
}
