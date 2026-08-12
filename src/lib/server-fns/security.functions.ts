/**
 * Security RBAC + audit server functions.
 *
 * `checkSecurityViewer` returns { allowed } for the calling user, allowing the
 * Findings History route's beforeLoad and UI links to gate on `admin` role
 * without leaking why access was denied. The server-side check is the source
 * of truth — clients can call this defensively but the API route enforces it.
 *
 * `logSecurityHistoryView` records an append-only audit event when an admin
 * opens the Findings History page (actor identity + server timestamp).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordAudit } from "@/lib/security/audit";

export const checkSecurityViewer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ allowed: boolean }> => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) {
      console.error("[checkSecurityViewer] has_role failed", error.message);
      return { allowed: false };
    }
    return { allowed: data === true };
  });

export const logSecurityHistoryView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ logged: boolean }> => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const allowed = !error && data === true;
    await recordAudit({
      actorId: context.userId,
      action: "security_history_view",
      resourceType: "security_history_page",
      resourceId: "findings-history",
      metadata: {
        outcome: allowed ? "granted" : "denied_403",
        at: new Date().toISOString(),
      },
    });
    return { logged: true };
  });
