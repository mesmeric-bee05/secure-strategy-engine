/**
 * E2E: Security → Findings History renders the latest nightly findings
 * side-by-side with correct statuses (new, recurring, accepted, ignored,
 * resolved).
 *
 * Uses Playwright route interception to stub the authenticated
 * /api/security/history/* endpoints — that isolates the UI assertion from
 * the RBAC pipeline (covered separately in unit/integration tests).
 */
import { test, expect } from "@playwright/test";

const NOW = "2026-07-11T00:00:00Z";
const YESTERDAY = "2026-07-10T00:00:00Z";

const RUN_A = {
  runId: "run-e2e-A",
  timestamp: YESTERDAY,
  totals: { new: 0, recurring: 2, accepted: 1, ignored: 1, resolved: 0 },
  findings: [
    { fingerprint: "fp-keep-1", scanner: "s", internal_id: "keep-1", rule: "R1", resource: "public.foo", severity: "high", status: "recurring", firstSeen: YESTERDAY, lastSeen: YESTERDAY },
    { fingerprint: "fp-resolve", scanner: "s", internal_id: "resolve-me", rule: "R2", resource: "public.bar", severity: "medium", status: "recurring", firstSeen: YESTERDAY, lastSeen: YESTERDAY },
    { fingerprint: "fp-accepted", scanner: "s", internal_id: "accepted-1", rule: "R3", resource: "public.has_role", severity: "low", status: "accepted", firstSeen: YESTERDAY, lastSeen: YESTERDAY },
    { fingerprint: "fp-ignored", scanner: "s", internal_id: "ignored-1", rule: "R4", resource: "public.baz", severity: "info", status: "ignored", firstSeen: YESTERDAY, lastSeen: YESTERDAY },
  ],
};

const RUN_B = {
  runId: "run-e2e-B",
  timestamp: NOW,
  totals: { new: 1, recurring: 1, accepted: 1, ignored: 1, resolved: 1 },
  findings: [
    { fingerprint: "fp-keep-1", scanner: "s", internal_id: "keep-1", rule: "R1", resource: "public.foo", severity: "high", status: "recurring", firstSeen: YESTERDAY, lastSeen: NOW },
    { fingerprint: "fp-brand-new", scanner: "s", internal_id: "brand-new", rule: "R5", resource: "public.new", severity: "high", status: "new", firstSeen: NOW, lastSeen: NOW },
    { fingerprint: "fp-accepted", scanner: "s", internal_id: "accepted-1", rule: "R3", resource: "public.has_role", severity: "low", status: "accepted", firstSeen: YESTERDAY, lastSeen: NOW },
    { fingerprint: "fp-ignored", scanner: "s", internal_id: "ignored-1", rule: "R4", resource: "public.baz", severity: "info", status: "ignored", firstSeen: YESTERDAY, lastSeen: NOW },
    { fingerprint: "fp-resolve", scanner: "s", internal_id: "resolve-me", rule: "R2", resource: "public.bar", severity: "medium", status: "resolved", firstSeen: YESTERDAY, lastSeen: YESTERDAY },
  ],
};

test.describe("Security → Findings History", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/security/history/index.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          runs: [
            { runId: RUN_B.runId, timestamp: RUN_B.timestamp, totals: RUN_B.totals },
            { runId: RUN_A.runId, timestamp: RUN_A.timestamp, totals: RUN_A.totals },
          ],
        }),
      }),
    );
    await page.route("**/api/security/history/run-e2e-A.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RUN_A) }),
    );
    await page.route("**/api/security/history/run-e2e-B.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RUN_B) }),
    );

    // Stub Supabase session so authorizedFetch attaches a token.
    await page.addInitScript(() => {
      const fake = {
        currentSession: {
          access_token: "e2e.jwt.token",
          refresh_token: "r",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user: { id: "e2e-user", email: "admin@example.com" },
        },
        currentUser: { id: "e2e-user", email: "admin@example.com" },
      };
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("sb-")) window.localStorage.removeItem(key);
      }
      window.localStorage.setItem("sb-e2e-auth-token", JSON.stringify(fake));
    });
  });

  test("renders both runs side-by-side with correct statuses", async ({ page }) => {
    await page.goto("/security/findings-history");

    await expect(page.getByText("run-e2e-A")).toBeVisible();
    await expect(page.getByText("run-e2e-B")).toBeVisible();

    // Side-by-side comparison heading
    await expect(page.getByText(/Side-by-side/i)).toBeVisible();

    // All status labels appear at least once
    for (const label of ["RECURRING", "NEW", "ACCEPTED", "IGNORED", "RESOLVED"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    // The resolved finding shows "Not present" on the newer run column
    await expect(page.getByText("Not present").first()).toBeVisible();
  });
});
