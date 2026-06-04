/**
 * Minimal test-only auth helper. Uses env vars from .env.test to mint a
 * magic link for a known test user via the Supabase admin API. Never use
 * production keys here.
 */
export type TestUser = { email: string };

export function requireE2EEnv(): {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  E2E_TEST_EMAIL: string;
} {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const E2E_TEST_EMAIL = process.env.E2E_TEST_EMAIL;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !E2E_TEST_EMAIL) {
    throw new Error(
      "E2E auth helper requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_TEST_EMAIL",
    );
  }
  return { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_TEST_EMAIL };
}

export async function generateMagicLink(email: string): Promise<string> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireE2EEnv();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  if (!res.ok) throw new Error(`generateLink failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { action_link?: string; properties?: { action_link: string } };
  const link = json.action_link ?? json.properties?.action_link;
  if (!link) throw new Error("No action_link in admin response");
  return link;
}
