import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { supabase } from "@/integrations/supabase/client";
import { extractSkillsMultimodal, AiQuotaError } from "@/lib/ai/extract-skills";

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

describe("extractSkillsMultimodal", () => {
  beforeEach(() => invoke.mockReset());

  it("parses a valid profile from the edge function response", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        ok: true,
        profile: {
          skills: [
            { name: "Hand embroidery", category: "creative", proficiency: 8, evidence: "photo" },
          ],
          overallConfidence: 0.82,
        },
      },
      error: null,
    });
    const out = await extractSkillsMultimodal({ text: "hello" });
    expect(out.skills[0].name).toBe("Hand embroidery");
    expect(out.overallConfidence).toBeCloseTo(0.82);
  });

  it("rejects schema violations from upstream", async () => {
    invoke.mockResolvedValueOnce({
      data: { ok: true, profile: { skills: [{ name: "x" }], overallConfidence: 0.5 } },
      error: null,
    });
    await expect(extractSkillsMultimodal({ text: "x" })).rejects.toThrow();
  });

  it("maps 429 to AiQuotaError", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "rate", context: { status: 429 } } });
    await expect(extractSkillsMultimodal({ text: "x" })).rejects.toBeInstanceOf(AiQuotaError);
  });
});
