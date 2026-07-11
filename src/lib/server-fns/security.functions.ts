/**
 * Security RBAC server functions.
 *
 * `checkSecurityViewer` returns { allowed } for the calling user, allowing the
 * Findings History route's beforeLoad and UI links to gate on `admin` role
 * without leaking why access was denied. The server-side check is the source
 * of truth — clients can call this defensively but the API route enforces it.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
