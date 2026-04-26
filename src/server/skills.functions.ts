import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestIP } from "@tanstack/react-start/server";
import {
  ExtractSkillsInput,
  ExtractSkillsOutput,
  type ExtractSkillsOutputT,
  PERSONA_SLUG,
} from "@/lib/schemas";
import { sanitizeUserPrompt } from "@/lib/security/prompt-guard";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { recordAudit } from "@/lib/security/audit";
import { callLovableAITool } from "@/lib/ai/lovable-ai";
import { getSupabasePublic } from "@/lib/supabase-server";

/* -------------------------------------------------------------------------- */
/* AI prompt + tool schema                                                    */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROMPT = `You are a meticulous talent assessor for the World Bank's TalentGraph Africa platform. You specialize in mapping informal-economy skills in Sub-Saharan Africa to international occupation taxonomies.

Your job: read the user's plain-language description of their work, training, and experience and extract a structured profile of distinct skills, mapping each to an ISCO-08 4-digit code and an ESCO code where possible.

Rules:
- Be GENEROUS in recognizing skills. Many people in the informal economy have professional-grade skills but lack formal language to describe them. Surface embedded skills (e.g. business operations inside a trade, customer service inside craft work, supply-chain management inside informal trading).
- Use the FULL ISCO-08 4-digit code (exactly 4 digits, no spaces).
- Set proficiency 1-10 honestly: 1=novice, 4=competent, 7=professional, 10=master.
- evidence_strength: "weak" if only mentioned, "moderate" if duration/scope given, "strong" if specific outputs/clients described, "exceptional" if measurable results given.
- confidence is YOUR confidence in the mapping (0-1), not the user's confidence in their skill.
- Output 3-12 skills typically. Avoid overlap; merge near-duplicates.
- NEVER invent skills not implied by the input.
- Always respond using the extract_skills tool. Never reply in plain text.`;

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    skills: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          skill_name: { type: "string", maxLength: 120 },
          isco_code: {
            type: "string",
            pattern: "^[0-9]{4}$",
            description: "ISCO-08 4-digit occupation code",
          },
          esco_code: { type: "string", maxLength: 32 },
          category: {
            type: "string",
            enum: [
              "technical",
              "creative",
              "trade",
              "business",
              "interpersonal",
              "digital",
              "agriculture",
              "service",
            ],
          },
          proficiency_level: { type: "integer", minimum: 1, maximum: 10 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence_strength: {
            type: "string",
            enum: ["weak", "moderate", "strong", "exceptional"],
          },
          market_relevance: { type: "string", maxLength: 280 },
          observations: { type: "string", maxLength: 280 },
        },
        required: [
          "skill_name",
          "isco_code",
          "category",
          "proficiency_level",
          "confidence",
          "evidence_strength",
        ],
      },
    },
    overall_confidence: { type: "number", minimum: 0, maximum: 1 },
    recommended_job_titles: {
      type: "array",
      items: { type: "string", maxLength: 80 },
      maxItems: 8,
    },
    language_used: { type: "string", enum: ["en", "sw", "fr", "ha"] },
  },
  required: ["skills", "overall_confidence", "language_used"],
} as const;

/* -------------------------------------------------------------------------- */
/* Server functions                                                           */
/* -------------------------------------------------------------------------- */

export const listPersonas = createServerFn({ method: "GET" }).handler(async () => {
  const sb = getSupabasePublic();
  const { data, error } = await sb
    .from("personas")
    .select(
      "slug,display_name,emoji,occupation,location,country_code,description,prefill_text,sort_order",
    )
    .order("sort_order");
  if (error) {
    console.error("listPersonas", error);
    return { personas: [] as never[], error: "Could not load personas" };
  }
  return { personas: data ?? [], error: null };
});

export const extractSkills = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExtractSkillsInput.parse(input))
  .handler(
    async ({
      data,
    }): Promise<
      | {
          ok: true;
          result: ExtractSkillsOutputT;
          sanitized: boolean;
          warnings: string[];
        }
      | { ok: false; error: string; status: number }
    > => {
      let ip: string | null = null;
      try {
        ip = getRequestIP({ xForwardedFor: false }) ?? null;
      } catch {
        // ignore — request context might be unavailable in some test paths
      }

      try {
        await enforceRateLimit({
          bucket: "ai:skills:extract",
          identifier: ip ?? "anon",
          limit: 20,
          windowSeconds: 60,
        });
      } catch (e) {
        if (e instanceof RateLimitError) {
          return {
            ok: false,
            error: "Too many extractions in a short time. Please wait a moment and try again.",
            status: 429,
          };
        }
        console.error("Rate limit infrastructure error, blocking request", e);
        return {
          ok: false,
          error: "Service temporarily unavailable. Please try again later.",
          status: 503,
        };
      }

      // Defense-in-depth: strip injection patterns before sending to the model
      const guard = sanitizeUserPrompt(data.text);

      // Persona context boosts accuracy without overriding user text
      const personaCtx = data.personaSlug ? await loadPersonaContext(data.personaSlug) : null;

      const userPrompt = [
        personaCtx ? `Context — persona: ${personaCtx}` : null,
        `Language: ${data.language}`,
        data.countryCode ? `Country: ${data.countryCode}` : null,
        "",
        "User description:",
        guard.cleaned,
      ]
        .filter(Boolean)
        .join("\n");

      let raw: unknown;
      try {
        raw = await callLovableAITool<unknown>({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
          tool: {
            name: "extract_skills",
            description: "Return the extracted, ISCO-08-mapped skill profile.",
            parameters: TOOL_SCHEMA as unknown as Record<string, unknown>,
          },
        });
      } catch (e) {
        const status = (e as { status?: number }).status ?? 502;
        const msg =
          status === 402
            ? "AI credits exhausted. Top up Lovable AI in Settings → Workspace → Usage to continue."
            : status === 429
              ? "AI is rate-limited right now. Please retry shortly."
              : "AI extraction failed. Please retry.";
        await recordAudit({
          action: "skills.extract.failed",
          ip,
          metadata: { status, persona: data.personaSlug },
        });
        return { ok: false, error: msg, status };
      }

      // Validate the AI's tool arguments against our Zod schema
      const parsed = ExtractSkillsOutput.safeParse(raw);
      if (!parsed.success) {
        console.error("extractSkills: AI returned invalid shape", parsed.error);
        await recordAudit({
          action: "skills.extract.invalid_shape",
          ip,
          metadata: { issues: parsed.error.issues.slice(0, 5) },
        });
        return {
          ok: false,
          error: "AI returned an unexpected response. Please try again.",
          status: 502,
        };
      }

      // Cross-reference each ISCO code against the seeded taxonomy. Drop
      // unknown codes rather than write made-up data.
      const sb = getSupabasePublic();
      const codes = Array.from(new Set(parsed.data.skills.map((s) => s.isco_code)));
      const { data: known } = await sb
        .from("isco_taxonomy")
        .select("isco_code,title,category")
        .in("isco_code", codes);
      const knownCodes = new Set(known?.map((k) => k.isco_code) ?? []);

      const filtered = parsed.data.skills.filter((s) => knownCodes.has(s.isco_code));

      const warnings: string[] = [];
      if (filtered.length < parsed.data.skills.length) {
        warnings.push(
          `${parsed.data.skills.length - filtered.length} skill(s) had unknown ISCO codes and were filtered`,
        );
      }
      if (guard.modified) warnings.push("Input was sanitized for safety");

      await recordAudit({
        action: "skills.extract.ok",
        ip,
        metadata: {
          persona: data.personaSlug,
          country: data.countryCode,
          returned: filtered.length,
          warnings,
        },
      });

      return {
        ok: true,
        sanitized: guard.modified,
        warnings,
        result: { ...parsed.data, skills: filtered },
      };
    },
  );

async function loadPersonaContext(slug: string): Promise<string | null> {
  const parsed = PERSONA_SLUG.safeParse(slug);
  if (!parsed.success) return null;
  const sb = getSupabasePublic();
  const { data } = await sb
    .from("personas")
    .select("display_name,occupation,location")
    .eq("slug", parsed.data)
    .maybeSingle();
  if (!data) return null;
  return `${data.display_name} · ${data.occupation} · ${data.location}`;
}
