/**
 * Recovery + fallback contract tests. These lock in error messages and side
 * effects the UI depends on for the user's "out" when passkeys fail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => {
  function createServerFn() {
    const b: any = {
      middleware() { return b; },
      inputValidator(v: any) { b._v = v; return b; },
      handler(h: any) {
        return async (args: any = {}) => {
          const data = b._v ? b._v(args.data) : args.data;
          const ctx = args.context ?? { userId: "user-1", claims: { email: "u@test.io" } };
          return h({ data, context: ctx });
        };
      },
    };
    return b;
  }
  return { createServerFn, useServerFn: (fn: any) => fn };
});

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: { __sentinel: true },
}));

const mockGenerateAuthOptions = vi.fn();
const mockVerifyAuth = vi.fn();
vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: (...a: unknown[]) => mockGenerateAuthOptions(...a),
  verifyAuthenticationResponse: (...a: unknown[]) => mockVerifyAuth(...a),
}));

type Result = { data?: any; error?: any };
type Script = { select?: Result; insert?: Result; update?: Result; delete?: Result; maybeSingle?: Result };
let scripts: Record<string, Script> = {};
let calls: { table: string; op: string; args: unknown[] }[] = [];

function chain(table: string) {
  const s = scripts[table] ?? {};
  let terminal: Result | undefined;
  const c: any = new Proxy({}, {
    get(_t, prop) {
      if (prop === "then") {
        const r = terminal ?? { data: null, error: null };
        return (resolve: any) => resolve(r);
      }
      if (prop === "maybeSingle") {
        return () => Promise.resolve(s.maybeSingle ?? { data: null, error: null });
      }
      return (...args: unknown[]) => {
        calls.push({ table, op: String(prop), args });
        if (prop === "insert") terminal = s.insert ?? { data: null, error: null };
        if (prop === "update") terminal = s.update ?? { data: null, error: null };
        if (prop === "delete") terminal = s.delete ?? { data: null, error: null };
        if (prop === "select") terminal = s.select ?? { data: [], error: null };
        return c;
      };
    },
  });
  return c;
}

const adminListUsers = vi.fn();
const adminGenerateLink = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (t: string) => chain(t),
    auth: { admin: {
      listUsers: (...a: unknown[]) => adminListUsers(...a),
      generateLink: (...a: unknown[]) => adminGenerateLink(...a),
    }},
  },
}));

import {
  startPasskeyAuthentication,
  finishPasskeyAuthentication,
  deletePasskey,
} from "@/lib/passkeys/passkeys.functions";
import en from "@/lib/i18n/locales/en.json";
import sw from "@/lib/i18n/locales/sw.json";
import fr from "@/lib/i18n/locales/fr.json";
import ha from "@/lib/i18n/locales/ha.json";

beforeEach(() => {
  scripts = {};
  calls = [];
  mockGenerateAuthOptions.mockReset();
  mockVerifyAuth.mockReset();
  adminListUsers.mockReset();
  adminGenerateLink.mockReset();
});
afterEach(() => vi.restoreAllMocks());

const past = () => new Date(Date.now() - 60_000).toISOString();
const future = () => new Date(Date.now() + 60_000).toISOString();

describe("passkey recovery & fallback contract", () => {
  it("stale challenge surfaces the exact 'Challenge expired.' string (UI depends on it)", async () => {
    scripts.webauthn_challenges = {
      maybeSingle: { data: { id: "c", challenge: "x", expires_at: past() }, error: null },
    };
    await expect(
      finishPasskeyAuthentication({
        data: { origin: "https://app.example.com", email: "u@x.io", response: { id: "c" } },
      }),
    ).rejects.toThrow("Challenge expired.");
  });

  it("unknown credential throws 'Unknown passkey.' and never mints a session", async () => {
    scripts.webauthn_challenges = {
      maybeSingle: { data: { id: "c", challenge: "x", expires_at: future() }, error: null },
    };
    scripts.passkeys = { maybeSingle: { data: null, error: null } };
    await expect(
      finishPasskeyAuthentication({
        data: { origin: "https://app.example.com", email: "u@x.io", response: { id: "ghost" } },
      }),
    ).rejects.toThrow("Unknown passkey.");
    expect(adminGenerateLink).not.toHaveBeenCalled();
  });

  it("unknown email returns options with empty allowCredentials AND still inserts a challenge (timing parity, no enumeration)", async () => {
    adminListUsers.mockResolvedValue({ data: { users: [] } });
    mockGenerateAuthOptions.mockResolvedValue({ challenge: "auth-ch" });
    await startPasskeyAuthentication({
      data: { origin: "https://app.example.com", email: "ghost@x.io" },
    });
    const opts = mockGenerateAuthOptions.mock.calls[0][0];
    expect(opts.allowCredentials).toEqual([]);
    expect(
      calls.some((c) => c.table === "webauthn_challenges" && c.op === "insert"),
    ).toBe(true);
  });

  it("deletePasskey filters by BOTH id and user_id (IDOR regression guard)", async () => {
    await deletePasskey({ data: { id: "11111111-1111-1111-1111-111111111111" } });
    const eqs = calls.filter((c) => c.table === "passkeys" && c.op === "eq");
    const cols = eqs.map((c) => c.args[0]);
    expect(cols).toContain("id");
    expect(cols).toContain("user_id");
  });

  it("fallback strings the sign-in button renders exist in every locale", () => {
    const required = ["passkeys.fallbackPassword", "passkeys.fallbackMagicLink", "passkeys.recovery"];
    for (const [code, dict] of Object.entries({ en, sw, fr, ha })) {
      for (const path of required) {
        const v = path.split(".").reduce<any>((a, k) => (a == null ? a : a[k]), dict);
        expect(typeof v, `${code}:${path}`).toBe("string");
        expect((v as string).trim().length, `${code}:${path}`).toBeGreaterThan(0);
      }
    }
  });
});
