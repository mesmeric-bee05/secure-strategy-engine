import { describe, it, expect } from "vitest";
import { _validateSupabaseUrlForTests, MATCH_EXPLANATION_URL, EXTRACT_SKILLS_URL } from "@/lib/ai/endpoints";

describe("ai/endpoints URL validation", () => {
  it("accepts a well-formed https URL", () => {
    expect(_validateSupabaseUrlForTests("https://example.supabase.co")).toBe(
      "https://example.supabase.co",
    );
  });

  it("rejects an empty string", () => {
    expect(() => _validateSupabaseUrlForTests("")).toThrow(/empty|valid/i);
  });

  it("rejects undefined", () => {
    expect(() => _validateSupabaseUrlForTests(undefined)).toThrow();
  });

  it("rejects a non-URL string", () => {
    expect(() => _validateSupabaseUrlForTests("not a url")).toThrow(/valid http/i);
  });

  it("rejects protocol-less values", () => {
    expect(() => _validateSupabaseUrlForTests("example.supabase.co")).toThrow(/valid http/i);
  });

  it("exports both edge-function URLs pointing at the same host", () => {
    expect(MATCH_EXPLANATION_URL).toMatch(/\/functions\/v1\/match-explanation$/);
    expect(EXTRACT_SKILLS_URL).toMatch(/\/functions\/v1\/extract-skills-multimodal$/);
    const host = (u: string) => new URL(u).host;
    expect(host(MATCH_EXPLANATION_URL)).toBe(host(EXTRACT_SKILLS_URL));
  });
});
