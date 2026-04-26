import { describe, it, expect } from "vitest";
import {
  SearchSchema,
  COUNTRY_CODES,
  PERSONA_SLUGS,
  type OpportunitiesLoaderDeps,
  type CountryCode,
  type PersonaSlug,
} from "@/routes/opportunities";

describe("opportunities route — search & deps typing", () => {
  it.each(COUNTRY_CODES)("parses valid country code %s without falling back", (code) => {
    const result = SearchSchema.parse({ country: code });
    expect(result.country).toBe(code);
  });

  it.each(PERSONA_SLUGS)("parses valid persona slug %s without falling back", (slug) => {
    const result = SearchSchema.parse({ persona: slug });
    expect(result.persona).toBe(slug);
  });

  it("falls back to undefined for unknown country codes", () => {
    expect(SearchSchema.parse({ country: "ZZ" }).country).toBeUndefined();
    expect(SearchSchema.parse({ country: "" }).country).toBeUndefined();
    expect(SearchSchema.parse({ country: 123 }).country).toBeUndefined();
  });

  it("treats missing country as undefined (no '{}' regression)", () => {
    expect(SearchSchema.parse({}).country).toBeUndefined();
    expect(SearchSchema.parse({ view: "policymaker" }).country).toBeUndefined();
  });

  it("defaults view to 'youth' when missing or invalid", () => {
    expect(SearchSchema.parse({}).view).toBe("youth");
    expect(SearchSchema.parse({ view: "garbage" }).view).toBe("youth");
  });

  it("preserves valid view values", () => {
    expect(SearchSchema.parse({ view: "policymaker" }).view).toBe("policymaker");
  });

  it("loaderDeps shape allows undefined country at runtime and at type level", () => {
    const a: OpportunitiesLoaderDeps = { country: undefined };
    expect(a.country).toBeUndefined();

    for (const code of COUNTRY_CODES) {
      const b: OpportunitiesLoaderDeps = { country: code };
      expect(b.country).toBe(code);
    }
  });

  it("type narrowing: CountryCode and PersonaSlug are exhaustive unions", () => {
    const allCodes: CountryCode[] = [...COUNTRY_CODES];
    expect(allCodes).toHaveLength(5);

    const allPersonas: PersonaSlug[] = [...PERSONA_SLUGS];
    expect(allPersonas).toEqual(["sarah", "james", "amara", "kwame"]);
  });

  it("rejects malformed combined input gracefully (no throw via .catch)", () => {
    const result = SearchSchema.parse({
      country: "MARS",
      view: "ufo",
      persona: "alien",
    });
    expect(result.country).toBeUndefined();
    expect(result.view).toBe("youth");
    expect(result.persona).toBeUndefined();
  });
});
