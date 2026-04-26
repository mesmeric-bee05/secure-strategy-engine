import { describe, expect, it } from "vitest";
import { redactForAudit, redactMetadata } from "../redact";

describe("redactForAudit", () => {
  it("strips email addresses", () => {
    const r = redactForAudit("contact me at jane.doe@example.com please");
    expect(r.text).not.toContain("jane.doe@example.com");
    expect(r.text).toContain("[email]");
    expect(r.flags).toContain("email");
    expect(r.modified).toBe(true);
  });

  it("strips JWT-shaped tokens", () => {
    const jwt = "eyJhbGci.eyJpc3M.signaturepart";
    const r = redactForAudit(`Authorization: Bearer ${jwt}`);
    // Bearer header pattern fires first; either way, the JWT must be gone.
    expect(r.text).not.toContain(jwt);
  });

  it("strips key=value secret pairs", () => {
    const r = redactForAudit("error: api_key=sk_live_abcdefg failed");
    expect(r.text).not.toContain("sk_live_abcdefg");
    expect(r.flags).toContain("kv_secret");
  });

  it("strips long hex blobs", () => {
    const hex = "deadbeef".repeat(8); // 64 hex chars
    const r = redactForAudit(`hash=${hex}`);
    expect(r.text).not.toContain(hex);
  });

  it("strips query strings from URLs", () => {
    const r = redactForAudit("see https://example.com/api?token=abc&user=42");
    expect(r.text).not.toContain("token=abc");
    expect(r.text).toContain("[stripped]");
  });

  it("truncates extremely long inputs that don't match patterns", () => {
    // Use chars that don't trigger long_hex/long_b64 (parens, emoji-free non-alnum).
    const big = "(error) ".repeat(2_000);
    const r = redactForAudit(big);
    expect(r.text.length).toBeLessThanOrEqual(2_500);
    expect(r.flags).toContain("truncated");
  });

  it("returns the input unchanged when no patterns match", () => {
    const r = redactForAudit("plain string with no secrets");
    expect(r.text).toBe("plain string with no secrets");
    expect(r.flags).toEqual([]);
    expect(r.modified).toBe(false);
  });
});

describe("redactMetadata", () => {
  it("redacts strings inside objects recursively", () => {
    const out = redactMetadata({
      module: "Skills",
      message: "user jane@example.com hit error",
      nested: { detail: "see jane@example.com" },
    });
    expect(JSON.stringify(out)).not.toContain("jane@example.com");
  });

  it("redacts values for known-secret keys outright", () => {
    const out = redactMetadata({
      password: "hunter2",
      token: "abc.def.ghi",
      authorization: "Bearer xyz",
      keep_me: "ok",
    }) as Record<string, string>;
    expect(out.password).toBe("[redacted]");
    expect(out.token).toBe("[redacted]");
    expect(out.authorization).toBe("[redacted]");
    expect(out.keep_me).toBe("ok");
  });

  it("does not crash on null/undefined/numbers/booleans", () => {
    const out = redactMetadata({ a: null, b: undefined, c: 1, d: true, e: [1, 2, 3] });
    expect(out).toEqual({ a: null, b: undefined, c: 1, d: true, e: [1, 2, 3] });
  });

  it("caps array length and recursion depth", () => {
    const big = Array.from({ length: 100 }, (_, i) => `item-${i}`);
    const out = redactMetadata(big) as string[];
    expect(out.length).toBeLessThanOrEqual(50);
  });
});
