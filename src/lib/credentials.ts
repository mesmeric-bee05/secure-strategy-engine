/**
 * Pure helpers for the public credential verifier (`/credential/$id`).
 *
 * The stored credential `payload` is a JSON object with a flexible shape
 * (issuance is server-authored). We narrow it client-side using a permissive
 * Zod schema so that future fields don't break the verifier UI, but the
 * fields the verifier displays are always validated.
 */
import { z } from "zod";

/**
 * Strict (no-passthrough) schema for the public credential payload.
 *
 * Anything outside these fields is dropped at the server boundary so the
 * route never has to handle unknown JSON. Issuers should add new fields here
 * when expanding the credential surface — not via free-form payload keys.
 */
export const CredentialPayloadSchema = z.object({
  /** Holder display name (no PII beyond what the issuer chose to publish). */
  holder_name: z.string().min(1).max(120).optional(),
  /** Persona slug, e.g. "sarah". Only relevant for demo credentials. */
  persona_slug: z.string().max(64).optional(),
  /** Free-text location, e.g. "Eldoret, Kenya". */
  location: z.string().max(120).optional(),
  /** ISCO-08 4-digit code for the dominant skill being credentialed. */
  isco_code: z
    .string()
    .regex(/^[0-9]{4}$/, "ISCO code must be 4 digits")
    .optional(),
  /** Human label, e.g. "Garment construction & tailoring". */
  skill_name: z.string().min(1).max(200).optional(),
  /** 1-10 proficiency anchored at issuance. */
  proficiency_level: z.number().int().min(1).max(10).optional(),
  /** Number of attestations that supported this credential. */
  attestation_count: z.number().int().min(0).max(50).optional(),
  /** Cumulative trust weight from those attestations. */
  attestation_weight_sum: z.number().min(0).max(50).optional(),
  /** ISO 8601 string for issuance, used when DB anchored_at is missing. */
  issued_at: z.string().optional(),
  /** Country code for the credential context. */
  country_code: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/)
    .optional(),
});

export type CredentialPayload = z.infer<typeof CredentialPayloadSchema>;

/** Compact preview hash (first 6 / last 4 of the full SHA-256 hex). */
export function shortHash(hashHex: string): string {
  if (!hashHex) return "—";
  if (hashHex.length <= 12) return hashHex;
  return `${hashHex.slice(0, 6)}…${hashHex.slice(-4)}`;
}

/**
 * Format an ISO timestamp for the verifier card. We show local short date
 * + UTC time so the credential timestamp is unambiguous.
 */
export function formatIssuedAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Apr 26 2026 · 09:14 UTC
  return `${d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} · ${d.toUTCString().slice(17, 22)} UTC`;
}

/**
 * Build a public verification URL the user can share via WhatsApp / QR.
 * `origin` may be omitted when running server-side; the route will use
 * a relative URL in that case.
 */
export function publicVerifyUrl(id: string, origin?: string): string {
  const trimmed = origin ? origin.replace(/\/$/, "") : "";
  return `${trimmed}/credential/${encodeURIComponent(id)}`;
}

/**
 * Build a WhatsApp share URL with the credential link pre-filled.
 * Uses wa.me/?text= which works on every platform without a phone number.
 */
export function whatsAppShareUrl(verifyUrl: string, holderName?: string): string {
  const lines = [
    holderName ? `Verified skill credential — ${holderName}` : "Verified skill credential",
    "",
    `Verify on TalentGraph Africa: ${verifyUrl}`,
    "",
    "Cryptographically signed · ISCO-08 mapped · publicly verifiable.",
  ];
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
}

/**
 * Decide which "verification status" to show to a public viewer. The DB
 * already enforces append-only writes; this is purely presentation.
 */
export type VerificationState =
  | { kind: "valid"; revokedAt: null }
  | { kind: "revoked"; revokedAt: string; reason: string | null }
  | { kind: "preview" };

export function deriveVerificationState(args: {
  isPreview: boolean;
  isRevoked: boolean | null | undefined;
  revokedAt: string | null;
  revokedReason: string | null;
}): VerificationState {
  if (args.isPreview) return { kind: "preview" };
  if (args.isRevoked) {
    return {
      kind: "revoked",
      revokedAt: args.revokedAt ?? "",
      reason: args.revokedReason ?? null,
    };
  }
  return { kind: "valid", revokedAt: null };
}
