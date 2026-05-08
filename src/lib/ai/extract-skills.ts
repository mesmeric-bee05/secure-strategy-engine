import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const SkillSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(["technical", "creative", "trade", "business", "interpersonal", "digital"]),
  proficiency: z.number().int().min(1).max(10),
  evidence: z.string().min(1).max(2000),
  marketRelevance: z.string().max(2000).optional(),
});

const ProfileSchema = z.object({
  skills: z.array(SkillSchema).max(40),
  overallConfidence: z.number().min(0).max(1),
});

export type ExtractedProfile = z.infer<typeof ProfileSchema>;

export interface ExtractInput {
  text?: string;
  imageBase64?: string;
  mimeType?: string;
}

export class AiQuotaError extends Error {
  status: 429 | 402;
  constructor(status: 429 | 402, message: string) {
    super(message);
    this.status = status;
  }
}

export async function extractSkillsMultimodal(input: ExtractInput): Promise<ExtractedProfile> {
  const { data, error } = await supabase.functions.invoke("extract-skills-multimodal", {
    body: input,
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) throw new AiQuotaError(429, "Rate limited. Try again shortly.");
    if (status === 402) throw new AiQuotaError(402, "AI credits exhausted.");
    throw new Error(error.message || "AI extraction failed");
  }
  if (!data?.ok) throw new Error(data?.error || "AI extraction failed");
  return ProfileSchema.parse(data.profile);
}
