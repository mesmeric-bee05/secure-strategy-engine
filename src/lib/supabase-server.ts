import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Service-role admin client. Server-only — never import from a route component.
 *
 * Use sparingly: prefer the user-scoped supabase client from auth-middleware
 * for anything where RLS should apply.
 */
let _admin: ReturnType<typeof createClient<Database>> | null = null;
export function getSupabaseAdmin() {
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

/** Anon-key client for reading public data without auth context. */
let _anon: ReturnType<typeof createClient<Database>> | null = null;
export function getSupabasePublic() {
  if (_anon) return _anon;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY not configured");
  }
  _anon = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _anon;
}
