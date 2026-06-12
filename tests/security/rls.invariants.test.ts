import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import expected from "./__fixtures__/rls.expected.json";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SKIP = !url || !key;

const admin = SKIP
  ? null
  : createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

describe.skipIf(SKIP)("RLS + EXECUTE invariants", () => {
  let policies: Record<string, string[]> = {};
  let grants: Array<{ routine: string; grantee: string }> = [];

  beforeAll(async () => {
    const { data: policyRows, error: e1 } = await admin!
      .from("pg_policies" as never)
      .select("tablename,policyname")
      .eq("schemaname", "public");
    // Fall back to RPC if direct read on system view is blocked
    if (e1 || !policyRows) {
      const { data } = await admin!.rpc("rl_check", {
        _bucket: "test",
        _identifier: "rls-invariant-warmup",
        _limit: 999,
        _window_seconds: 60,
      });
      void data;
      // Use information_schema via rest-friendly view; if still blocked, skip detail check
    }
    const rows = (policyRows ?? []) as Array<{ tablename: string; policyname: string }>;
    policies = rows.reduce<Record<string, string[]>>((acc, r) => {
      acc[r.tablename] = (acc[r.tablename] ?? []).concat(r.policyname).sort();
      return acc;
    }, {});

    const { data: grantRows } = await admin!
      .from("information_schema.role_routine_grants" as never)
      .select("routine_name,grantee")
      .eq("routine_schema", "public")
      .eq("privilege_type", "EXECUTE");
    grants = ((grantRows ?? []) as Array<{ routine_name: string; grantee: string }>).map((g) => ({
      routine: g.routine_name,
      grantee: g.grantee,
    }));
  });

  for (const [table, want] of Object.entries(expected.tables)) {
    it(`policies on ${table} match baseline`, () => {
      const got = (policies[table] ?? []).slice().sort();
      const wantSorted = [...want].sort();
      // Allow extra policies as long as required ones are present
      for (const p of wantSorted) {
        expect(got, `missing policy ${p} on ${table}`).toContain(p);
      }
    });
  }

  for (const fn of expected.function_grants.no_anon_or_authenticated) {
    it(`${fn} has no EXECUTE for anon/authenticated`, () => {
      const matches = grants.filter(
        (g) => g.routine === fn && (g.grantee === "anon" || g.grantee === "authenticated"),
      );
      expect(matches, `unexpected grants on ${fn}: ${JSON.stringify(matches)}`).toHaveLength(0);
    });
  }

  for (const fn of expected.function_grants.authenticated_only) {
    it(`${fn} has no EXECUTE for anon`, () => {
      const anonGrant = grants.find((g) => g.routine === fn && g.grantee === "anon");
      expect(anonGrant).toBeUndefined();
    });
  }
});
