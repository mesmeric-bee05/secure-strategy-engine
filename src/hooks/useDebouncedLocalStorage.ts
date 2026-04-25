import { useEffect, useRef, useState } from "react";

export type PersistStatus = "idle" | "saving" | "saved" | "error";

export interface UseDebouncedLocalStorageOptions {
  /** Debounce delay in ms. Default 500ms. */
  delayMs?: number;
  /** If true, "saved" pulse auto-fades back to "idle" after `flashMs`. */
  flashSaved?: boolean;
  flashMs?: number;
}

/**
 * Persists a string value to localStorage on a debounce. Returns the current
 * persistence status so the UI can show a "Saved" indicator (and a quota
 * warning when writes fail).
 *
 * Caller still owns the React state — this hook only handles writes.
 */
export function useDebouncedLocalStorage(
  key: string,
  value: string,
  {
    delayMs = 500,
    flashSaved = true,
    flashMs = 1500,
  }: UseDebouncedLocalStorageOptions = {}
): { status: PersistStatus; error: string | null } {
  const [status, setStatus] = useState<PersistStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip the initial mount — value was just hydrated from storage.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    setStatus("saving");
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, value);
        setError(null);
        setStatus("saved");
        if (flashSaved) {
          window.setTimeout(() => {
            setStatus((s) => (s === "saved" ? "idle" : s));
          }, flashMs);
        }
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.name === "QuotaExceededError"
              ? "Storage full — draft not saved"
              : e.message
            : "Could not save draft";
        setError(msg);
        setStatus("error");
      }
    }, delayMs);

    return () => window.clearTimeout(handle);
  }, [key, value, delayMs, flashSaved, flashMs]);

  return { status, error };
}
