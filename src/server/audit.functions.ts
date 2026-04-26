import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { recordAudit } from "@/lib/security/audit";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export const ClientErrorInput = z.object({
  module: z.string().min(1).max(80),
  route: z.string().min(1).max(200),
  message: z.string().min(1).max(300),
});

/**
 * Append-only client-side error logging. Routes call this from their
 * `errorComponent` and from `RouteErrorBoundary` retry attempts.
 *
 * Store only a short, scrubbed message fingerprint from unauthenticated clients.
 * Raw stacks and paths can contain tokens, file paths, or user data.
 */
export const logClientError = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ClientErrorInput.parse(input))
  .handler(async ({ data }) => {
    let ip: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
      await enforceRateLimit({
        bucket: "audit:client_error",
        identifier: ip ?? "anon",
        limit: 20,
        windowSeconds: 300,
      });
    } catch (e) {
      if (e instanceof RateLimitError) return { ok: false as const, status: 429 };
      throw e;
    }

    await recordAudit({
      action: "client_error",
      resourceType: "route",
      resourceId: null,
      ip,
      metadata: {
        module: scrubAuditText(data.module, 80),
        route: scrubRoute(data.route),
        messageHash: await auditHash(scrubAuditText(data.message, 300)),
      },
    });
    return { ok: true as const };
  });

function scrubRoute(route: string): string {
  const safe = route.split("#", 1)[0] ?? "/";
  const [path] = safe.split("?", 1);
  return scrubAuditText(path || "/", 200);
}

function scrubAuditText(value: string, maxLength: number): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .slice(0, maxLength);
}

async function auditHash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
