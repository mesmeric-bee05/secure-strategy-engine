import { assertEquals, assert } from "https://deno.land/std@0.190.0/assert/mod.ts";

/**
 * Regression: the AI edge functions MUST key rate limits to the authenticated
 * user id (prefix "u:") — never the client IP or a client-supplied header —
 * so a proxy-rotation / anon-key attack cannot bypass the limit.
 *
 * We assert this by inspecting the identifier string patterns used in the
 * two edge-function handlers.
 */
Deno.test("extract-skills-multimodal uses per-user rate-limit key", async () => {
  const src = await Deno.readTextFile(
    new URL("../extract-skills-multimodal/index.ts", import.meta.url),
  );
  assert(
    /identifier:\s*`u:\$\{userId\}`/.test(src),
    "extract-skills-multimodal must use identifier: `u:${userId}`",
  );
  // Must NOT fall back to IP or trusted header
  assert(!/identifier:\s*ip\b/.test(src), "must not key rate limit by ip");
  assert(!/x-user-id/.test(src), "must not trust x-user-id header");
});

Deno.test("match-explanation uses per-user rate-limit key", async () => {
  const src = await Deno.readTextFile(
    new URL("../match-explanation/index.ts", import.meta.url),
  );
  assert(
    /identifier:\s*`u:\$\{userId\}`/.test(src),
    "match-explanation must use identifier: `u:${userId}`",
  );
  assert(!/x-user-id/.test(src), "must not trust x-user-id header");
});

Deno.test("both AI edge functions require an authenticated user", async () => {
  for (const path of [
    "../extract-skills-multimodal/index.ts",
    "../match-explanation/index.ts",
  ]) {
    const src = await Deno.readTextFile(new URL(path, import.meta.url));
    assert(
      /await\s+requireUser\s*\(\s*req\s*\)/.test(src),
      `${path} must call requireUser(req)`,
    );
    assertEquals(/from\s+["']\.\.\/_shared\/auth\.ts["']/.test(src), true);
  }
});
