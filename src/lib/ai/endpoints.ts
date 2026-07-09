/**
 * Build-time-validated URLs for AI edge functions.
 *
 * Fails fast at module load if VITE_SUPABASE_URL is missing or malformed,
 * so a misconfigured deploy never lets MatchExplanation silently POST to
 * `undefined/functions/v1/...`.
 */
import { z } from "zod";

const UrlSchema = z
  .string({ required_error: "VITE_SUPABASE_URL is not set" })
  .trim()
  .min(1, "VITE_SUPABASE_URL is empty")
  .refine((s) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(s), {
    message: "VITE_SUPABASE_URL must be a valid http(s) URL",
  });

function resolveSupabaseUrl(): string {
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const parsed = UrlSchema.safeParse(raw);
  if (!parsed.success) {
    // Surface config problems at import time with an actionable message.
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    throw new Error(
      `[ai/endpoints] Invalid Supabase URL configuration: ${message}. ` +
        `Set VITE_SUPABASE_URL in the environment before building.`,
    );
  }
  return parsed.data.replace(/\/+$/, "");
}

/** Resolved once at module import. Throws if env is missing/malformed. */
export const SUPABASE_URL = resolveSupabaseUrl();

/** URL for the match-explanation streaming edge function. */
export const MATCH_EXPLANATION_URL = `${SUPABASE_URL}/functions/v1/match-explanation`;

/** URL for the multimodal skill extractor edge function. */
export const EXTRACT_SKILLS_URL = `${SUPABASE_URL}/functions/v1/extract-skills-multimodal`;

/** Test-only helper: re-validate at call time (used by unit tests). */
export function _validateSupabaseUrlForTests(value: unknown): string {
  return UrlSchema.parse(value);
}
