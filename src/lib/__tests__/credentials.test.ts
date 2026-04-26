import { describe, it, expect } from "vitest";

import {
  CredentialPayloadSchema,
  deriveVerificationState,
  formatIssuedAt,
  publicVerifyUrl,
  shortHash,
  whatsAppShareUrl,
} from "@/lib/credentials";

describe("CredentialPayloadSchema", () => {
  it("parses a complete demo payload", () => {
    const out = CredentialPayloadSchema.safeParse({
      holder_name: "Sarah Wanjiku",
      persona_slug: "sarah",
      location: "Eldoret, Kenya",
      isco_code: "7531",
      skill_name: "Garment construction",
      proficiency_level: 9,
      attestation_count: 3,
      attestation_weight_sum: 2.7,
      issued_at: "2026-04-01T00:00:00Z",
      country_code: "KE",
    });
    expect(out.success).toBe(true);
  });

  it("rejects a non-4-digit isco_code", () => {
    expect(CredentialPayloadSchema.safeParse({ isco_code: "123" }).success).toBe(false);
    expect(CredentialPayloadSchema.safeParse({ isco_code: "12345" }).success).toBe(false);
  });

  it("clamps proficiency_level via schema bounds", () => {
    expect(CredentialPayloadSchema.safeParse({ proficiency_level: 11 }).success).toBe(false);
    expect(CredentialPayloadSchema.safeParse({ proficiency_level: 0 }).success).toBe(false);
    expect(CredentialPayloadSchema.safeParse({ proficiency_level: 5 }).success).toBe(true);
  });

  it("strips unknown fields (no passthrough on the public surface)", () => {
    const out = CredentialPayloadSchema.parse({
      holder_name: "Ada",
      // not in schema — must be dropped at the server boundary
      ssn: "private",
    });
    expect(out).toEqual({ holder_name: "Ada" });
  });
});

describe("shortHash", () => {
  it("returns the literal value when too short to abbreviate", () => {
    expect(shortHash("")).toBe("—");
    expect(shortHash("abc")).toBe("abc");
    expect(shortHash("123456789012")).toBe("123456789012");
  });
  it("abbreviates as 6 + ellipsis + 4", () => {
    expect(shortHash("a".repeat(64))).toBe("aaaaaa…aaaa");
    expect(shortHash("0123456789abcdef0123456789abcdef")).toBe("012345…cdef");
  });
});

describe("formatIssuedAt", () => {
  it("returns em-dash for empty/null", () => {
    expect(formatIssuedAt(null)).toBe("—");
    expect(formatIssuedAt(undefined)).toBe("—");
    expect(formatIssuedAt("")).toBe("—");
  });
  it("returns the input verbatim when it isn't a parseable date", () => {
    expect(formatIssuedAt("not-a-date")).toBe("not-a-date");
  });
  it("formats valid ISO into 'DD MMM YYYY · HH:MM UTC'", () => {
    expect(formatIssuedAt("2026-04-26T08:33:00Z")).toMatch(/26 Apr 2026 · 08:33 UTC/);
  });
});

describe("publicVerifyUrl", () => {
  it("encodes the id segment", () => {
    expect(publicVerifyUrl("abc123")).toBe("/credential/abc123");
    expect(publicVerifyUrl("a/b")).toBe("/credential/a%2Fb");
  });
  it("strips trailing slash from origin", () => {
    expect(publicVerifyUrl("x", "https://example.com/")).toBe("https://example.com/credential/x");
    expect(publicVerifyUrl("x", "https://example.com")).toBe("https://example.com/credential/x");
  });
});

describe("whatsAppShareUrl", () => {
  it("includes the verify url and the holder name", () => {
    const url = whatsAppShareUrl("https://example.com/credential/x", "Ada");
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);
    const decoded = decodeURIComponent(url.split("text=")[1]);
    expect(decoded).toContain("Ada");
    expect(decoded).toContain("https://example.com/credential/x");
  });
  it("works without a holder name", () => {
    const url = whatsAppShareUrl("https://example.com/credential/x");
    const decoded = decodeURIComponent(url.split("text=")[1]);
    expect(decoded).toContain("Verified skill credential");
  });
});

describe("deriveVerificationState", () => {
  it("returns preview when the route is preview", () => {
    expect(
      deriveVerificationState({
        isPreview: true,
        isRevoked: false,
        revokedAt: null,
        revokedReason: null,
      }),
    ).toEqual({ kind: "preview" });
  });

  it("returns revoked when is_revoked is true, copying timestamp + reason", () => {
    expect(
      deriveVerificationState({
        isPreview: false,
        isRevoked: true,
        revokedAt: "2026-04-26T08:00:00Z",
        revokedReason: "Holder requested deletion",
      }),
    ).toEqual({
      kind: "revoked",
      revokedAt: "2026-04-26T08:00:00Z",
      reason: "Holder requested deletion",
    });
  });

  it("returns valid when is_revoked is false", () => {
    expect(
      deriveVerificationState({
        isPreview: false,
        isRevoked: false,
        revokedAt: null,
        revokedReason: null,
      }),
    ).toEqual({ kind: "valid", revokedAt: null });
  });

  it("treats missing revoked metadata defensively", () => {
    expect(
      deriveVerificationState({
        isPreview: false,
        isRevoked: true,
        revokedAt: null,
        revokedReason: null,
      }),
    ).toEqual({ kind: "revoked", revokedAt: "", reason: null });
  });
});
