/**
 * Unit tests for the passkey server-function handlers.
 *
 * createServerFn() is mocked so each fn becomes a plain async function we can
 * invoke directly. Supabase admin client and @simplewebauthn/server are mocked
 * to assert wrapper behavior in isolation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ------- @tanstack/react-start mock: turn createServerFn into a plain fn ---
vi.mock("@tanstack/react-start", () => {
  type Builder = {
    _v?: (d: unknown) => unknown;
    middleware: (...a: unknown[]) => Builder;
    inputValidator: (v: (d: unknown) => unknown) => Builder;
    handler: (h: (a: { data: unknown; context: unknown }) => unknown) => (...args: any[]) => unknown;
  };
  function createServerFn() {
    const b: Builder = {
      middleware() { return b; },
      inputValidator(v) { b._v = v; return b; },
      handler(h) {
        return async (args: any = {}) => {
          const data = b._v ? b._v(args.data) : args.data;
          const ctx = args.context ?? (globalThis as any).__testCtx ?? {
            userId: "user-1",
            claims: { email: "u1@test.io", sub: "user-1" },
          };
          return h({ data, context: ctx });
        };
      },
    };
    return b;
  }
  return { createServerFn, useServerFn: (fn: any) => fn };
});

// ------- Auth middleware sentinel (just needs to be importable) -----------
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: { __sentinel: "requireSupabaseAuth" },
}));

// ------- WebAuthn server mock ---------------------------------------------
const mockGenerateRegistrationOptions = vi.fn();
const mockVerifyRegistrationResponse = vi.fn();
const mockGenerateAuthenticationOptions = vi.fn();
const mockVerifyAuthenticationResponse = vi.fn();
vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: (...a: unknown[]) => mockGenerateRegistrationOptions(...a),
  verifyRegistrationResponse: (...a: unknown[]) => mockVerifyRegistrationResponse(...a),
  generateAuthenticationOptions: (...a: unknown[]) => mockGenerateAuthenticationOptions(...a),
  verifyAuthenticationResponse: (...a: unknown[]) => mockVerifyAuthenticationResponse(...a),
}));

// ------- Supabase admin mock (chainable, table-keyed) ---------------------
type Result = { data?: any; error?: any };
type TableScript = {
  select?: Result;
  insert?: Result;
  update?: Result;
  delete?: Result;
  maybeSingle?: Result;
};
let tableScripts: Record<string, TableScript> = {};
let lastCalls: { table: string; op: string; args: unknown[] }[] = [];

function makeChain(table: string) {
  const script = tableScripts[table] ?? {};
  let terminalResult: Result | undefined;
  const chain: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          const r = terminalResult ?? { data: null, error: null };
          return (resolve: any) => resolve(r);
        }
        if (prop === "maybeSingle") {
          return () => Promise.resolve(script.maybeSingle ?? { data: null, error: null });
        }
        return (...args: unknown[]) => {
          lastCalls.push({ table, op: String(prop), args });
          if (prop === "insert") terminalResult = script.insert ?? { data: null, error: null };
          if (prop === "update") terminalResult = script.update ?? { data: null, error: null };
          if (prop === "delete") terminalResult = script.delete ?? { data: null, error: null };
          if (prop === "select") terminalResult = script.select ?? { data: [], error: null };
          return chain;
        };
      },
    },
  );
  return chain;
}

const adminListUsers = vi.fn();
const adminGenerateLink = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => makeChain(table),
    auth: {
      admin: {
        listUsers: (...a: unknown[]) => adminListUsers(...a),
        generateLink: (...a: unknown[]) => adminGenerateLink(...a),
      },
    },
  },
}));

// Now import the module under test (after mocks are set up).
import {
  startPasskeyRegistration,
  finishPasskeyRegistration,
  listPasskeys,
  deletePasskey,
  startPasskeyAuthentication,
  finishPasskeyAuthentication,
} from "@/lib/passkeys/passkeys.functions";

beforeEach(() => {
  tableScripts = {};
  lastCalls = [];
  mockGenerateRegistrationOptions.mockReset();
  mockVerifyRegistrationResponse.mockReset();
  mockGenerateAuthenticationOptions.mockReset();
  mockVerifyAuthenticationResponse.mockReset();
  adminListUsers.mockReset();
  adminGenerateLink.mockReset();
});

afterEach(() => {
  delete (globalThis as any).__testCtx;
});

const future = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

describe("startPasskeyRegistration", () => {
  it("rejects invalid origins", async () => {
    await expect(
      startPasskeyRegistration({ data: { origin: "javascript:alert(1)" } }),
    ).rejects.toThrow();
  });

  it("derives rpID from origin and persists a challenge", async () => {
    tableScripts.passkeys = { select: { data: [], error: null } };
    mockGenerateRegistrationOptions.mockResolvedValue({ challenge: "ch-1" });
    const out = await startPasskeyRegistration({
      data: { origin: "https://app.example.com" },
    });
    expect(out).toEqual({ challenge: "ch-1" });
    const opts = mockGenerateRegistrationOptions.mock.calls[0][0];
    expect(opts.rpID).toBe("app.example.com");
    expect(opts.rpName).toBe("TalentGraph Africa");

    const insert = lastCalls.find(
      (c) => c.table === "webauthn_challenges" && c.op === "insert",
    );
    expect(insert?.args[0]).toMatchObject({
      user_id: "user-1",
      challenge: "ch-1",
      challenge_type: "registration",
    });
  });
});

describe("finishPasskeyRegistration", () => {
  it("throws when no challenge row exists", async () => {
    tableScripts.webauthn_challenges = { maybeSingle: { data: null, error: null } };
    await expect(
      finishPasskeyRegistration({
        data: { origin: "https://app.example.com", response: {} },
      }),
    ).rejects.toThrow(/Challenge expired/);
  });

  it("throws when challenge is past expires_at", async () => {
    tableScripts.webauthn_challenges = {
      maybeSingle: { data: { id: "c1", challenge: "x", expires_at: past() }, error: null },
    };
    await expect(
      finishPasskeyRegistration({
        data: { origin: "https://app.example.com", response: {} },
      }),
    ).rejects.toThrow(/Challenge expired/);
  });

  it("throws when verification fails", async () => {
    tableScripts.webauthn_challenges = {
      maybeSingle: { data: { id: "c1", challenge: "x", expires_at: future() }, error: null },
    };
    mockVerifyRegistrationResponse.mockResolvedValue({ verified: false });
    await expect(
      finishPasskeyRegistration({
        data: { origin: "https://app.example.com", response: {} },
      }),
    ).rejects.toThrow(/failed verification/);
  });

  it("inserts passkey row on success and cleans up the challenge", async () => {
    tableScripts.webauthn_challenges = {
      maybeSingle: { data: { id: "c1", challenge: "x", expires_at: future() }, error: null },
    };
    mockVerifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: "cred-id-1",
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
          transports: ["internal"],
        },
        credentialBackedUp: true,
      },
    });
    const out = await finishPasskeyRegistration({
      data: { origin: "https://app.example.com", response: {}, deviceLabel: "MacBook" },
    });
    expect(out).toEqual({ ok: true });

    const insert = lastCalls.find(
      (c) => c.table === "passkeys" && c.op === "insert",
    );
    expect(insert?.args[0]).toMatchObject({
      user_id: "user-1",
      credential_id: "cred-id-1",
      device_label: "MacBook",
      backed_up: true,
    });
    expect(
      lastCalls.some((c) => c.table === "webauthn_challenges" && c.op === "delete"),
    ).toBe(true);
  });
});

describe("listPasskeys / deletePasskey", () => {
  it("listPasskeys scopes the query to the authenticated user", async () => {
    tableScripts.passkeys = {
      select: { data: [{ id: "p1" }], error: null },
    };
    const out = await listPasskeys();
    expect(out.passkeys).toEqual([{ id: "p1" }]);
    const eqCalls = lastCalls.filter((c) => c.table === "passkeys" && c.op === "eq");
    expect(eqCalls.some((c) => c.args[0] === "user_id" && c.args[1] === "user-1")).toBe(true);
  });

  it("deletePasskey requires BOTH id and user_id (no IDOR)", async () => {
    await deletePasskey({ data: { id: "11111111-1111-1111-1111-111111111111" } });
    const eqs = lastCalls.filter((c) => c.table === "passkeys" && c.op === "eq");
    const cols = eqs.map((c) => c.args[0]);
    expect(cols).toContain("id");
    expect(cols).toContain("user_id");
  });

  it("deletePasskey rejects non-uuid id", async () => {
    await expect(deletePasskey({ data: { id: "not-a-uuid" } })).rejects.toThrow();
  });
});

describe("startPasskeyAuthentication", () => {
  it("returns options with empty allowCredentials for unknown emails (no enumeration)", async () => {
    adminListUsers.mockResolvedValue({ data: { users: [] } });
    mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: "auth-ch" });
    const out = await startPasskeyAuthentication({
      data: { origin: "https://app.example.com", email: "ghost@example.com" },
    });
    expect(out).toEqual({ challenge: "auth-ch" });
    const opts = mockGenerateAuthenticationOptions.mock.calls[0][0];
    expect(opts.allowCredentials).toEqual([]);
    expect(opts.rpID).toBe("app.example.com");
  });

  it("includes registered credentials for known emails", async () => {
    adminListUsers.mockResolvedValue({
      data: { users: [{ id: "user-2", email: "Real@Example.com" }] },
    });
    tableScripts.passkeys = {
      select: { data: [{ credential_id: "cred-99", transports: ["internal"] }], error: null },
    };
    mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: "auth-ch-2" });
    await startPasskeyAuthentication({
      data: { origin: "https://app.example.com", email: "real@example.com" },
    });
    const opts = mockGenerateAuthenticationOptions.mock.calls[0][0];
    expect(opts.allowCredentials).toEqual([
      { id: "cred-99", transports: ["internal"] },
    ]);
  });
});

describe("finishPasskeyAuthentication", () => {
  const baseData = {
    origin: "https://app.example.com",
    email: "u@example.com",
    response: { id: "cred-x" },
  };

  it("throws when challenge row is missing", async () => {
    tableScripts.webauthn_challenges = { maybeSingle: { data: null, error: null } };
    await expect(finishPasskeyAuthentication({ data: baseData })).rejects.toThrow(
      /Challenge expired/,
    );
  });

  it("throws on stale challenge", async () => {
    tableScripts.webauthn_challenges = {
      maybeSingle: { data: { id: "c", challenge: "x", expires_at: past() }, error: null },
    };
    await expect(finishPasskeyAuthentication({ data: baseData })).rejects.toThrow(
      /Challenge expired/,
    );
  });

  it("throws on unknown credential", async () => {
    tableScripts.webauthn_challenges = {
      maybeSingle: { data: { id: "c", challenge: "x", expires_at: future() }, error: null },
    };
    tableScripts.passkeys = { maybeSingle: { data: null, error: null } };
    await expect(finishPasskeyAuthentication({ data: baseData })).rejects.toThrow(
      /Unknown passkey/,
    );
  });

  it("throws when signature does not verify", async () => {
    tableScripts.webauthn_challenges = {
      maybeSingle: { data: { id: "c", challenge: "x", expires_at: future() }, error: null },
    };
    // Two maybeSingle reads happen: challenge, then passkey. Re-script per-table.
    tableScripts.passkeys = {
      maybeSingle: {
        data: {
          id: "p1",
          user_id: "u2",
          credential_id: "cred-x",
          public_key: Buffer.from([1, 2, 3]).toString("base64"),
          counter: 0,
          transports: ["internal"],
        },
        error: null,
      },
    };
    mockVerifyAuthenticationResponse.mockResolvedValue({ verified: false });
    await expect(finishPasskeyAuthentication({ data: baseData })).rejects.toThrow(
      /did not verify/,
    );
  });

  it("returns actionLink on success and persists counter update", async () => {
    tableScripts.webauthn_challenges = {
      maybeSingle: { data: { id: "c", challenge: "x", expires_at: future() }, error: null },
    };
    tableScripts.passkeys = {
      maybeSingle: {
        data: {
          id: "p1",
          user_id: "u2",
          credential_id: "cred-x",
          public_key: Buffer.from([1]).toString("base64"),
          counter: 0,
          transports: [],
        },
        error: null,
      },
    };
    mockVerifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 7 },
    });
    adminGenerateLink.mockResolvedValue({
      data: { properties: { action_link: "https://app.example.com/auth#token=abc" } },
      error: null,
    });
    const out = await finishPasskeyAuthentication({ data: baseData });
    expect(out).toEqual({
      ok: true,
      actionLink: "https://app.example.com/auth#token=abc",
    });
    const update = lastCalls.find((c) => c.table === "passkeys" && c.op === "update");
    expect(update?.args[0]).toMatchObject({ counter: 7 });
  });

  it("throws (recovery path) if session minting fails", async () => {
    tableScripts.webauthn_challenges = {
      maybeSingle: { data: { id: "c", challenge: "x", expires_at: future() }, error: null },
    };
    tableScripts.passkeys = {
      maybeSingle: {
        data: {
          id: "p1",
          user_id: "u2",
          credential_id: "cred-x",
          public_key: Buffer.from([1]).toString("base64"),
          counter: 0,
          transports: [],
        },
        error: null,
      },
    };
    mockVerifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    });
    adminGenerateLink.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(finishPasskeyAuthentication({ data: baseData })).rejects.toThrow(
      /Could not mint session/,
    );
  });
});
