import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sha256Hex } from "./prompt-guard";
import { redactMetadata } from "./redact";

/**
 * Append-only audit logger. Uses the service role to bypass RLS so anonymous
 * actions can also be logged (with `actor_id` null). Never include raw PII —
 * `metadata` is recursively passed through `redactMetadata()` before insert.
 */
export interface AuditEvent {
  actorId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

let _admin: ReturnType<typeof createClient<Database>> | null = null;
function getAdmin() {
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

export async function recordAudit(ev: AuditEvent): Promise<void> {
  try {
    const admin = getAdmin();
    const ipHash = ev.ip ? await sha256Hex(ev.ip) : null;
    const uaHash = ev.userAgent ? await sha256Hex(ev.userAgent) : null;
    const safeMetadata = ev.metadata ? redactMetadata(ev.metadata) : null;
    await admin.from("audit_log").insert({
      action: ev.action.slice(0, 80),
      actor_id: ev.actorId ?? null,
      resource_type: ev.resourceType?.slice(0, 80) ?? null,
      resource_id: ev.resourceId ?? null,
      ip_hash: ipHash,
      user_agent_hash: uaHash,
      metadata: safeMetadata as never,
    });
  } catch (e) {
    // Never let audit failures break the request path.
    console.error("audit log write failed", e);
  }
}
