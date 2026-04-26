import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSupabasePublic } from "@/lib/supabase-server";
import { CredentialPayloadSchema, type CredentialPayload } from "@/lib/credentials";

const CredentialIdInput = z.object({
  id: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[a-zA-Z0-9-]+$/, "Credential id must be alphanumeric (with optional dashes)"),
});

export interface PublicCredentialDTO {
  id: string;
  payload: CredentialPayload;
  payloadHash: string;
  signingKeyId: string;
  platformSignature: string;
  isRevoked: boolean;
  revokedAt: string | null;
  revokedReason: string | null;
  anchoredAt: string;
  /** Skill id the credential refers to (so verifiers can fetch related metadata). */
  skillId: string;
  /** Convenience: if the related skill is verified. */
  skillIsVerified: boolean | null;
}

/**
 * Public credential lookup. The `credential_anchors` table has a public
 * SELECT policy so we can use the anon Supabase client directly.
 *
 * Returns `null` when the id is unknown — the route then renders a
 * "not found" verifier panel instead of a real credential.
 */
export const getCredentialById = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => CredentialIdInput.parse(input))
  .handler(async ({ data }): Promise<PublicCredentialDTO | null> => {
    const sb = getSupabasePublic();

    const { data: row, error } = await sb
      .from("credential_anchors")
      .select(
        "id,skill_id,payload,payload_hash,signing_key_id,platform_signature,is_revoked,revoked_at,revoked_reason,anchored_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) {
      console.error("getCredentialById:", error);
      return null;
    }
    if (!row) return null;

    // Defensive: validate payload shape so the public verifier never has to
    // handle arbitrary JSON. Unknown fields are kept via passthrough().
    const parsed = CredentialPayloadSchema.safeParse(row.payload);
    const payload: CredentialPayload = parsed.success ? parsed.data : {};

    // Optional: peek at the related skill to surface "still verified" badge.
    let skillIsVerified: boolean | null = null;
    if (row.skill_id) {
      const { data: skill } = await sb
        .from("skills")
        .select("is_verified")
        .eq("id", row.skill_id)
        .maybeSingle();
      skillIsVerified = skill?.is_verified ?? null;
    }

    return {
      id: row.id,
      payload,
      payloadHash: row.payload_hash,
      signingKeyId: row.signing_key_id,
      platformSignature: row.platform_signature,
      isRevoked: row.is_revoked,
      revokedAt: row.revoked_at,
      revokedReason: row.revoked_reason,
      anchoredAt: row.anchored_at,
      skillId: row.skill_id,
      skillIsVerified,
    };
  });
