import { z } from "zod";

/**
 * Centralized Zod schemas for server-function inputs.
 * Re-use across modules; never duplicate validation locally.
 */

export const LANGUAGE = z.enum(["en", "sw", "fr", "ha"]);
export type Language = z.infer<typeof LANGUAGE>;

export const COUNTRY_CODE = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2");
export type CountryCode = z.infer<typeof COUNTRY_CODE>;

export const PERSONA_SLUG = z.enum(["sarah", "james", "amara", "kwame"]);
export type PersonaSlug = z.infer<typeof PERSONA_SLUG>;

export const SKILL_CATEGORY = z.enum([
  "technical",
  "creative",
  "trade",
  "business",
  "interpersonal",
  "digital",
  "agriculture",
  "service",
]);

export const EVIDENCE_STRENGTH = z.enum([
  "weak",
  "moderate",
  "strong",
  "exceptional",
]);

export const ExtractSkillsInput = z.object({
  text: z.string().min(8).max(4000),
  language: LANGUAGE.default("en"),
  personaSlug: PERSONA_SLUG.optional(),
  countryCode: COUNTRY_CODE.optional(),
});
export type ExtractSkillsInputT = z.infer<typeof ExtractSkillsInput>;

export const ExtractedSkill = z.object({
  skill_name: z.string().min(1).max(120),
  isco_code: z.string().regex(/^[0-9]{4}$/),
  esco_code: z.string().max(32).optional(),
  category: SKILL_CATEGORY,
  proficiency_level: z.number().int().min(1).max(10),
  confidence: z.number().min(0).max(1),
  evidence_strength: EVIDENCE_STRENGTH,
  market_relevance: z.string().max(280).optional(),
  observations: z.string().max(280).optional(),
});
export type ExtractedSkillT = z.infer<typeof ExtractedSkill>;

export const ExtractSkillsOutput = z.object({
  skills: z.array(ExtractedSkill).min(1).max(20),
  overall_confidence: z.number().min(0).max(1),
  recommended_job_titles: z.array(z.string()).max(8).optional(),
  language_used: LANGUAGE,
});
export type ExtractSkillsOutputT = z.infer<typeof ExtractSkillsOutput>;

export const ListOpportunitiesInput = z.object({
  countryCode: COUNTRY_CODE.optional(),
  remote: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const MatchOpportunitiesInput = z.object({
  personaSlug: PERSONA_SLUG.optional(),
  skillIds: z.array(z.string().uuid()).max(40).optional(),
  countryCode: COUNTRY_CODE.optional(),
  limit: z.number().int().min(1).max(20).default(12),
});

export const CitationsInput = z.object({
  countryCode: COUNTRY_CODE.optional(),
});
