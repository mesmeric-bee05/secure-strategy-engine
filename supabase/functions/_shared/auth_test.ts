// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.190.0/assert/mod.ts";
import { requireUser } from "./auth.ts";

Deno.test("requireUser: rejects missing Authorization header", async () => {
  const req = new Request("http://localhost/", { method: "POST" });
  const r = await requireUser(req);
  assertEquals(r.ok, false);
  assertEquals(r.status, 401);
  assertEquals(r.error, "missing_authorization");
});

Deno.test("requireUser: rejects a non-Bearer scheme", async () => {
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { Authorization: "Basic abc" },
  });
  const r = await requireUser(req);
  assertEquals(r.ok, false);
  assertEquals(r.status, 401);
});

Deno.test("requireUser: rejects when Supabase env is unset", async () => {
  const priorUrl = Deno.env.get("SUPABASE_URL");
  const priorAnon = Deno.env.get("SUPABASE_ANON_KEY");
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_ANON_KEY");
  Deno.env.delete("SUPABASE_PUBLISHABLE_KEY");
  try {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { Authorization: "Bearer some.token.here" },
    });
    const r = await requireUser(req);
    assertEquals(r.ok, false);
    assertEquals(r.status, 500);
    assertEquals(r.error, "auth_not_configured");
  } finally {
    if (priorUrl) Deno.env.set("SUPABASE_URL", priorUrl);
    if (priorAnon) Deno.env.set("SUPABASE_ANON_KEY", priorAnon);
  }
});
