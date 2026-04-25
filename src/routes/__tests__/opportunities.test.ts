import { describe, it, expect } from "vitest";
import {
  SearchSchema,
  COUNTRY_CODES,
  type OpportunitiesLoaderDeps,
  type CountryCode,
} from "@/routes/opportunities";

describe("opportunities route — search & deps typing", () => {
  it("parses a known country code into a typed search object", () => {
    const result = SearchSchema.parse({ country: "KE", view: "youth" });
    expect(result.country).toBe("KE");
    expect(result.view).toBe("youth");
  });

  it("falls back to undefined for unknown country codes", () => {
    const result = SearchSchema.parse({ country: "ZZ" });
    expect(result.country).toBeUndefined();
  });

  it("defaults view to 'youth' when missing or invalid", () => {
    expect(SearchSchema.parse({}).view).toBe("youth");
    expect(SearchSchema.parse({ view: "garbage" }).view).toBe("youth");
  });

  it("loaderDeps shape allows undefined country (no '{}' regression)", () => {
    // This is a compile-time guarantee; assert at runtime too.
    const deps: OpportunitiesLoaderDeps = { country: undefined };
    expect(deps.country).toBeUndefined();

    const withCode: OpportunitiesLoaderDeps = { country: "GH" };
    expect(withCode.country).toBe("GH");
  });

  it("exports the canonical country code list", () => {
    expect(COUNTRY_CODES).toEqual(["KE", "GH", "NG", "ZA", "RW"]);
    const code: CountryCode = "RW";
    expect(COUNTRY_CODES).toContain(code);
  });
});
