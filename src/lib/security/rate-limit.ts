import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sha256Hex } from "./prompt-guard";

let _admin: ReturnType<typeof createClient<Database>> | null = null;
function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  _admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export interface RateLimitOptions {
  bucket: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}

/**
 * Hash an IP-or-fallback identifier so we don't write raw IPs to the
 * `rate_limits` table (the row is short-lived, but it's reachable by any
 * service-role context that touches that table).
 *
 * Falls back to a stable per-process random salt when the input is the
 * literal string "anon" — without this, every unauthenticated caller globally
 * shares a single bucket, which turns rate limiting into self-DoS.
 */
const SALT = (() => {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
})();

export async function hashRateLimitIdentifier(raw: string | null | undefined): Promise<string> {
  if (!raw || raw === "anon") {
    // Per-process fallback. Still buckets a runaway loop from one VM, but
    // doesn't conflate every anonymous user globally.
    return `anon:${SALT.slice(0, 8)}:${await sha256Hex(SALT + ":" + Math.floor(Date.now() / 60_000))}`.slice(
      0,
      96,
    );
  }
  return `h:${(await sha256Hex(SALT + ":" + raw)).slice(0, 48)}`;
}

/**
 * Sliding-window rate limit check. Returns true if the request is allowed.
 * Backed by Postgres `rl_check` SECURITY DEFINER function.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<boolean> {
  const admin = getAdmin();
  const identifier = await hashRateLimitIdentifier(opts.identifier);
  const { data, error } = await admin.rpc("rl_check", {
    _bucket: opts.bucket,
    _identifier: identifier,
    _limit: opts.limit,
    _window_seconds: opts.windowSeconds,
  });
  if (error) {
    console.error("rl_check failed", error);
    // Fail-open on infra errors to avoid breaking the app entirely. The audit
    // log captures the request anyway.
    return true;
  }
  return data === true;
}

/** Convenience: throw a typed error when rate limit is exceeded. */
export class RateLimitError extends Error {
  status = 429 as const;
  constructor(public bucket: string) {
    super(`Rate limit exceeded for ${bucket}`);
    this.name = "RateLimitError";
  }
}

export async function enforceRateLimit(opts: RateLimitOptions): Promise<void> {
  const ok = await checkRateLimit(opts);
  if (!ok) throw new RateLimitError(opts.bucket);
}
