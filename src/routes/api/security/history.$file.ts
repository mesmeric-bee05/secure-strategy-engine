/**
 * Authenticated server route serving nightly security findings history.
 *
 *   GET /api/security/history/index.json
 *   GET /api/security/history/<runId>.json
 *
 * Requires a Supabase bearer token whose user has the `admin` role.
 * Artifacts are bundled from src/security-history/ at build time so they are
 * never accessible via the public /security/history/* path.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Bundle all history JSON at build time. `?raw` keeps the exact bytes.
const HISTORY_FILES = import.meta.glob("/src/security-history/*.json", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function pick(file: string): string | null {
  // Only allow simple filenames: no traversal, only .json.
  if (!/^[a-zA-Z0-9._-]+\.json$/.test(file)) return null;
  const key = `/src/security-history/${file}`;
  return HISTORY_FILES[key] ?? null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export const Route = createFileRoute("/api/security/history/$file")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return json(500, { error: "Service misconfigured" });
        }
        const authHeader = request.headers.get("authorization") ?? "";
        if (!/^Bearer\s+/i.test(authHeader)) {
          return new Response("Unauthorized", {
            status: 401,
            headers: { "WWW-Authenticate": 'Bearer realm="api"' },
          });
        }
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (claimsError || !userId) return json(401, { error: "Unauthorized" });

        const { data: allowed, error: roleError } = await supabase.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });
        if (roleError || allowed !== true) return json(403, { error: "Forbidden" });

        const contents = pick(params.file);
        if (contents == null) return json(404, { error: "Not found" });

        return new Response(contents, {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "private, max-age=0, no-store",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
