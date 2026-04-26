import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { recordAudit } from "@/lib/security/audit";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { redactForAudit } from "@/lib/security/redact";

export const ClientErrorInput = z.object({
  module: z.string().min(1).max(80),
  route: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  // Optional, capped to avoid bloat in audit_log.
  stack: z.string().max(4000).optional(),
});

/**
 * Append-only client-side error logging. Routes call this from their
 * `errorComponent` and from `RouteErrorBoundary` retry attempts.
 *
 * Hardening:
 *  - Per-IP rate limit (60/min) so a misbehaving client cannot flood the
 *    immutable audit_log table.
 *  - Both `message` and `stack` are passed through `redactForAudit` to strip
 *    obvious PII / secrets (emails, JWTs, bearer tokens, long hex/base64
 *    blobs, key=value secret pairs, query strings).
 */
export const logClientError = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ClientErrorInput.parse(input))
  .handler(async ({ data }) => {
    let ip: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
    } catch {
      // ignore — request context might be unavailable in some test paths
    }
    try {
      await enforceRateLimit({
        bucket: "audit:client_error",
        identifier: ip ?? "anon",
        limit: 60,
        windowSeconds: 60,
      });
    } catch (e) {
      if (e instanceof RateLimitError) {
        return { ok: false as const, error: "rate_limited", status: 429 };
      }
      throw e;
    }

    const message = redactForAudit(data.message);
    const stack = data.stack ? redactForAudit(data.stack) : null;

    await recordAudit({
      action: "client_error",
      resourceType: "route",
      resourceId: null,
      ip,
      metadata: {
        module: data.module,
        route: data.route,
        message: message.text,
        message_flags: message.flags,
        stack: stack?.text ?? null,
        stack_flags: stack?.flags ?? null,
      },
    });
    return { ok: true as const };
  });
