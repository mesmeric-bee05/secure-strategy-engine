/**
 * Explicit RBAC rejection cases for GET /api/security/history/$file.
 *
 * Unauthorized users must never receive artifact bytes, denial reasons must
 * stay generic, and every request (granted or denied) must emit exactly one
 * audit event with the correct action and outcome.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const auditCalls: Array<Record<string, unknown>> = [];
vi.mock("@/lib/security/audit", () => ({
  recordAudit: vi.fn(async (ev: Record<string, unknown>) => {
    auditCalls.push(ev);
  }),
}));

type Scenario = {
  sub?: string | null;
  claimsError?: { message: string } | null;
  isAdmin?: boolean;
  rpcError?: { message: string } | null;
};
let scenario: Scenario = {};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getClaims: async () => ({
        data: scenario.sub ? { claims: { sub: scenario.sub } } : null,
        error: scenario.claimsError ?? null,
      }),
    },
    rpc: async () => ({
      data: scenario.isAdmin === true ? true : false,
      error: scenario.rpcError ?? null,
    }),
  }),
}));

const { Route } = await import("@/routes/api/security/history.$file");

type Handler = (ctx: {
  request: Request;
  params: { file: string };
}) => Promise<Response>;

const GET = (Route.options as { server: { handlers: { GET: Handler } } }).server.handlers
  .GET;

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/security/history/index.json", { headers });
}

const ADMIN = { authorization: "Bearer valid.jwt.token" };

beforeEach(() => {
  auditCalls.length = 0;
  scenario = {};
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});

function lastAudit() {
  expect(auditCalls).toHaveLength(1);
  return auditCalls[0]!;
}

describe("security history endpoint — RBAC rejections", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await GET({ request: req(), params: { file: "index.json" } });
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toMatch(/Bearer/);
    expect(await res.text()).toBe("Unauthorized");
    expect(lastAudit()).toMatchObject({
      action: "security_history_artifact_read",
      actorId: null,
      metadata: { outcome: "denied_401" },
    });
  });

  it("rejects a malformed / non-Bearer Authorization header", async () => {
    for (const authorization of ["Basic abc", "Bearer", "Bearer ", "token abc"]) {
      auditCalls.length = 0;
      const res = await GET({
        request: req({ authorization }),
        params: { file: "index.json" },
      });
      expect(res.status).toBe(401);
      expect(lastAudit().metadata).toMatchObject({ outcome: "denied_401" });
    }
  });

  it("rejects a token whose claims cannot be resolved", async () => {
    scenario = { sub: null, claimsError: { message: "bad jwt" } };
    const res = await GET({ request: req(ADMIN), params: { file: "index.json" } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(lastAudit().metadata).toMatchObject({ outcome: "denied_401" });
  });

  it("rejects an authenticated non-admin with a generic 403", async () => {
    scenario = { sub: "user-1", isAdmin: false };
    const res = await GET({ request: req(ADMIN), params: { file: "index.json" } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    expect(lastAudit()).toMatchObject({
      actorId: "user-1",
      metadata: { outcome: "denied_403" },
    });
  });

  it("fails closed when the has_role RPC errors", async () => {
    scenario = { sub: "user-2", isAdmin: true, rpcError: { message: "rpc down" } };
    const res = await GET({ request: req(ADMIN), params: { file: "index.json" } });
    expect(res.status).toBe(403);
    expect(lastAudit().metadata).toMatchObject({ outcome: "denied_403" });
  });

  it("returns 404 for unknown filenames and path traversal attempts", async () => {
    scenario = { sub: "admin-1", isAdmin: true };
    for (const file of [
      "../../.env",
      "../secret.json",
      "notes.txt",
      "does-not-exist.json",
      "index.json/../../.env",
    ]) {
      auditCalls.length = 0;
      const res = await GET({ request: req(ADMIN), params: { file } });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Not found" });
      expect(lastAudit().metadata).toMatchObject({ outcome: "not_found" });
    }
  });

  it("returns 500 without artifact bytes when misconfigured", async () => {
    delete process.env.SUPABASE_URL;
    const res = await GET({ request: req(ADMIN), params: { file: "index.json" } });
    expect(res.status).toBe(500);
    expect(lastAudit().metadata).toMatchObject({ outcome: "misconfigured" });
  });

  it("serves the artifact to an admin with hardened headers and a granted audit", async () => {
    scenario = { sub: "admin-9", isAdmin: true };
    const res = await GET({ request: req(ADMIN), params: { file: "index.json" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const body = await res.json();
    expect(Array.isArray(body.runs)).toBe(true);
    expect(lastAudit()).toMatchObject({
      action: "security_history_artifact_read",
      resourceType: "security_history_artifact",
      resourceId: "index.json",
      actorId: "admin-9",
      metadata: { outcome: "granted" },
    });
    expect(typeof (lastAudit().metadata as { at: string }).at).toBe("string");
  });

  it("records the client identity signals for the audit trail", async () => {
    scenario = { sub: "admin-9", isAdmin: true };
    await GET({
      request: req({ ...ADMIN, "cf-connecting-ip": "203.0.113.7", "user-agent": "vitest" }),
      params: { file: "index.json" },
    });
    expect(lastAudit()).toMatchObject({ ip: "203.0.113.7", userAgent: "vitest" });
  });
});
