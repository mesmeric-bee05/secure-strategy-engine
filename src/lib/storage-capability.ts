/**
 * Side-effect-safe Web Storage capability probe.
 *
 * Detects three classes of degradation up front so /skills can warn the user
 * before they invest typing time:
 *
 *   - "missing" : `window.localStorage` getter throws or is undefined
 *                 (non-browser env, hardened browser flags).
 *   - "denied"  : storage exists but `setItem` raises SecurityError — the
 *                 typical Safari/Brave private-mode pattern.
 *   - "quota"   : `setItem` raises QuotaExceededError on a small payload.
 *
 * Also returns a coarse `nearQuota` flag computed from a 64KB write probe so
 * we can warn users when they are within roughly one large draft of the cap.
 */

export type StorageReason = "missing" | "denied" | "quota" | "unknown";

export interface StorageCapability {
  available: boolean;
  /** Why persistence is degraded. Undefined when `available` and not near quota. */
  reason?: StorageReason;
  /** True when the browser persisted the small probe but rejected ~64KB. */
  nearQuota: boolean;
  testedAt: string;
}

const SMALL_PROBE_VALUE = "1";
/**
 * 64KB sized payload — large enough to flag near-quota conditions without
 * actually exhausting the user's free space if it succeeds.
 */
const LARGE_PROBE_VALUE = "x".repeat(64 * 1024);

function probeKey(prefix: string): string {
  return `__tg_probe_${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function pickStorage(scope: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return scope === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    // Some browsers throw on the getter itself when storage is locked down.
    return null;
  }
}

function classifyError(e: unknown): StorageReason {
  if (e instanceof Error) {
    const name = e.name.toLowerCase();
    if (name.includes("quota")) return "quota";
    if (name === "securityerror" || name.includes("security")) return "denied";
  }
  return "unknown";
}

export function probeStorage(scope: "local" | "session" = "local"): StorageCapability {
  const testedAt = new Date().toISOString();
  const storage = pickStorage(scope);
  if (!storage) {
    return { available: false, reason: "missing", nearQuota: false, testedAt };
  }

  // 1) Small write/read/delete round-trip.
  const smallKey = probeKey("s");
  try {
    storage.setItem(smallKey, SMALL_PROBE_VALUE);
    const echo = storage.getItem(smallKey);
    storage.removeItem(smallKey);
    if (echo !== SMALL_PROBE_VALUE) {
      return { available: false, reason: "unknown", nearQuota: false, testedAt };
    }
  } catch (e) {
    return {
      available: false,
      reason: classifyError(e),
      nearQuota: false,
      testedAt,
    };
  }

  // 2) Large probe — non-fatal when it fails.
  const largeKey = probeKey("l");
  let nearQuota = false;
  try {
    storage.setItem(largeKey, LARGE_PROBE_VALUE);
    storage.removeItem(largeKey);
  } catch (e) {
    if (classifyError(e) === "quota") {
      nearQuota = true;
    }
    // Best effort cleanup.
    try {
      storage.removeItem(largeKey);
    } catch {
      /* noop */
    }
  }

  return {
    available: true,
    reason: nearQuota ? "quota" : undefined,
    nearQuota,
    testedAt,
  };
}
