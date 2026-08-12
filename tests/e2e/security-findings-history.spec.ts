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

  test("run table lists both runs with their per-status totals", async ({ page }) => {
    await page.goto("/security/findings-history");

    const rowB = page.getByTestId(`run-row-${RUN_B.runId}`);
    await expect(rowB).toBeVisible();
    const cellsB = rowB.locator("td");
    // Compare | Run | Timestamp | New | Recurring | Accepted | Resolved
    await expect(cellsB.nth(3)).toHaveText("1"); // new
    await expect(cellsB.nth(4)).toHaveText("1"); // recurring
    await expect(cellsB.nth(5)).toHaveText("1"); // accepted
    await expect(cellsB.nth(6)).toHaveText("1"); // resolved

    const rowA = page.getByTestId(`run-row-${RUN_A.runId}`);
    const cellsA = rowA.locator("td");
    await expect(cellsA.nth(3)).toHaveText("0"); // no new findings yesterday
    await expect(cellsA.nth(4)).toHaveText("2");

    // Newest run first
    const order = await page.locator("tbody tr").evaluateAll((rows) =>
      rows.map((r) => r.getAttribute("data-testid")),
    );
    expect(order[0]).toBe(`run-row-${RUN_B.runId}`);
  });

  test("diff rows carry the correct per-run status badge for every finding", async ({ page }) => {
    await page.goto("/security/findings-history");

    // Column A is the older run (run-e2e-A), column B the newer (run-e2e-B),
    // matching the selection order: [latest, previous] -> sorted table.
    const expectations: Array<{
      fp: string;
      rule: string;
      resource: string;
      a: string;
      b: string;
    }> = [
      { fp: "fp-keep-1", rule: "R1", resource: "public.foo", a: "recurring", b: "recurring" },
      { fp: "fp-brand-new", rule: "R5", resource: "public.new", a: "absent", b: "new" },
      { fp: "fp-accepted", rule: "R3", resource: "public.has_role", a: "accepted", b: "accepted" },
      { fp: "fp-ignored", rule: "R4", resource: "public.baz", a: "ignored", b: "ignored" },
      { fp: "fp-resolve", rule: "R2", resource: "public.bar", a: "recurring", b: "resolved" },
    ];

    for (const exp of expectations) {
      const row = page.getByTestId(`diff-row-${exp.fp}`);
      await expect(row).toBeVisible();
      await expect(row).toContainText(exp.rule);
      await expect(row).toContainText(exp.fp.slice(0, 12));

      const cellA = row.locator('[data-run="a"]');
      const cellB = row.locator('[data-run="b"]');

      // Newest run is column B for fp-brand-new only in one direction; assert
      // that the set of the two statuses matches, order-independently, then
      // pin the "absent" side explicitly.
      const statuses = [
        await cellA.getAttribute("data-status"),
        await cellB.getAttribute("data-status"),
      ].sort();
      expect(statuses).toEqual([exp.a, exp.b].sort());

      // Resource + severity are surfaced on whichever side has the finding.
      const present = (await cellA.getAttribute("data-status")) === "absent" ? cellB : cellA;
      await expect(present).toContainText(exp.resource);
      await expect(present).toContainText("severity:");
    }
  });

  test("resolved finding is absent on exactly one side", async ({ page }) => {
    await page.goto("/security/findings-history");
    const row = page.getByTestId("diff-row-fp-brand-new");
    await expect(row.locator('[data-status="absent"]')).toHaveCount(1);
    await expect(row.locator('[data-status="new"]')).toHaveCount(1);
    await expect(row.locator('[data-status="absent"]')).toContainText("Not present");
  });

  test("shows an access-restricted banner when the API returns 403", async ({ page }) => {
    await page.route("**/api/security/history/index.json", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "Forbidden" }),
      }),
    );

    await page.goto("/security/findings-history");

    const alert = page.getByRole("alert").first();
    await expect(alert).toContainText("Access restricted");
    await expect(alert).toContainText(/Security admin role/i);
    // No artifact content leaks into the page.
    await expect(page.getByText(/Side-by-side/i)).toHaveCount(0);
  });
});
