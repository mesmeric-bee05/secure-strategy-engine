import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
 * Sliding-window rate limit check. Returns true if the request is allowed.
 * Backed by Postgres `rl_check` SECURITY DEFINER function.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<boolean> {
  const admin = getAdmin();
  const { data, error } = await admin.rpc("rl_check", {
    _bucket: opts.bucket,
    _identifier: opts.identifier,
    _limit: opts.limit,
    _window_seconds: opts.windowSeconds,
  });
  if (error) {
    console.error("rl_check failed", error);
    // Expensive/server-side protected paths should degrade safely if the
    // backing limiter is unavailable.
    return false;
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
