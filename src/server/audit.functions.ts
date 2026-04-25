import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { recordAudit } from "@/lib/security/audit";

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
 * No PII is stored beyond what the message contains; callers should keep the
 * message terse. We hash IP and user-agent at the audit layer.
 */
export const logClientError = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ClientErrorInput.parse(input))
  .handler(async ({ data }) => {
    await recordAudit({
      action: "client_error",
      resourceType: "route",
      resourceId: null,
      metadata: {
        module: data.module,
        route: data.route,
        message: data.message,
        stack: data.stack ?? null,
      },
    });
    return { ok: true as const };
  });
