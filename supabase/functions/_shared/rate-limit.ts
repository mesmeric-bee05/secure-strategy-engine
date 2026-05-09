// Edge-function rate limiter backed by the public.rl_check Postgres function.
// Fails CLOSED on infra errors to prevent abuse.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (_admin) return _admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("rate_limit: SUPABASE_URL/SERVICE_ROLE_KEY missing");
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

async function sha256(str: string): Promise<string> {
  const bytes = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SALT = (() => {
  try { return crypto.randomUUID(); } catch { return Math.random().toString(36).slice(2); }
})();

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "anon";
}

export interface RateLimitResult {
  allowed: boolean;
  bucket: string;
}

export async function checkLimit(opts: {
  bucket: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const id = `h:${(await sha256(SALT + ":" + opts.identifier)).slice(0, 48)}`;
  const { data, error } = await admin().rpc("rl_check", {
    _bucket: opts.bucket,
    _identifier: id,
    _limit: opts.limit,
    _window_seconds: opts.windowSeconds,
  });
  if (error) {
    console.error(JSON.stringify({ severity: "error", fn: "rl_check", message: error.message }));
    return { allowed: false, bucket: opts.bucket };
  }
  return { allowed: data === true, bucket: opts.bucket };
}
