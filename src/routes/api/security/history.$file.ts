/**
 * Authenticated server route serving nightly security findings history.
 *
 *   GET /api/security/history/index.json
 *   GET /api/security/history/<runId>.json
 *
 * Requires a Supabase bearer token whose user has the `admin` role.
 * Artifacts are bundled from src/security-history/ at build time so they are
 * never accessible via the public /security/history/* path.
 *
 * Every request — granted or denied — writes one append-only audit event
 * (`security_history_artifact_read`) recording actor identity, the requested
 * filename, the outcome and a server timestamp. Audit failures never change
 * the response.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { recordAudit } from "@/lib/security/audit";
import { validateHistoryArtifact, formatIssues } from "@/lib/security/history-schema";

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

/** Strong ETag = SHA-256 of the artifact bytes. Computed once per file. */
const etagCache = new Map<string, string>();

async function etagFor(file: string, contents: string): Promise<string> {
  const cached = etagCache.get(file);
  if (cached) return cached;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(contents));
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const etag = `"${hex}"`;
  etagCache.set(file, etag);
  return etag;
}

/** RFC 9110 If-None-Match: `*` or a comma-separated list, possibly weak. */
function ifNoneMatchMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  const trimmed = header.trim();
  if (trimmed === "*") return true;
  return trimmed
    .split(",")
    .map((t) => t.trim().replace(/^W\//, ""))
    .some((t) => t === etag);
}

const CACHE_CONTROL = "private, no-cache, must-revalidate";

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

export type ArtifactOutcome =
  | "granted"
  | "granted_304"
  | "denied_401"
  | "denied_403"
  | "not_found"
  | "invalid_artifact"
  | "misconfigured";


async function audit(
  request: Request,
  file: string,
  outcome: ArtifactOutcome,
  actorId: string | null,
): Promise<void> {
  await recordAudit({
    actorId,
    action: "security_history_artifact_read",
    resourceType: "security_history_artifact",
    // Only the filename token — never finding contents.
    resourceId: /^[a-zA-Z0-9._-]{1,120}$/.test(file) ? file : "invalid",
    ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    metadata: { outcome, at: new Date().toISOString() },
  });
}

export const Route = createFileRoute("/api/security/history/$file")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const file = params.file;
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          await audit(request, file, "misconfigured", null);
          return json(500, { error: "Service misconfigured" });
        }
        const authHeader = request.headers.get("authorization") ?? "";
        if (!/^Bearer\s+\S/i.test(authHeader)) {
          await audit(request, file, "denied_401", null);
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
        const userId = claims?.claims?.sub ?? null;
        if (claimsError || !userId) {
          await audit(request, file, "denied_401", null);
          return json(401, { error: "Unauthorized" });
        }

        const { data: allowed, error: roleError } = await supabase.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });
        if (roleError || allowed !== true) {
          // Fail closed on RPC errors as well.
          await audit(request, file, "denied_403", userId);
          return json(403, { error: "Forbidden" });
        }

        const contents = pick(file);
        if (contents == null) {
          await audit(request, file, "not_found", userId);
          return json(404, { error: "Not found" });
        }

        // Defensive: never serve an artifact that fails the shared schema.
        try {
          const result = validateHistoryArtifact(file, JSON.parse(contents));
          if (!result.ok) {
            console.error(
              `[security-history] malformed artifact ${file}\n${formatIssues(file, result.issues)}`,
            );
            await audit(request, file, "invalid_artifact", userId);
            return json(500, { error: "Malformed artifact" });
          }
        } catch {
          await audit(request, file, "invalid_artifact", userId);
          return json(500, { error: "Malformed artifact" });
        }

        await audit(request, file, "granted", userId);
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
