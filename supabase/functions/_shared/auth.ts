// JWT authentication helper for edge functions.
// Validates the caller's Supabase session and returns the user id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AuthResult {
  ok: boolean;
  userId?: string;
  status?: number;
  error?: string;
}

export async function requireUser(req: Request): Promise<AuthResult> {
  const header = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "missing_authorization" };
  }
  const token = header.slice(7).trim();
  if (!token) return { ok: false, status: 401, error: "missing_token" };

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anon) return { ok: false, status: 500, error: "auth_not_configured" };

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: "invalid_token" };
  return { ok: true, userId: data.user.id };
}
