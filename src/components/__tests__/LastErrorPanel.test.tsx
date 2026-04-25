/**
 * LastErrorPanel rendering tests — focus on the 24h "Expired" state.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LastErrorPanel } from "@/components/LastErrorPanel";
import { MAX_AGE_MS } from "@/lib/last-error";

const KEY = "talentgraph:last-error";

beforeEach(() => {
  window.sessionStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe("LastErrorPanel — expiry rendering", () => {
  it("renders an Expired badge and uses role=status when older than 24h", () => {
    const staleAt = new Date(Date.now() - MAX_AGE_MS - 60_000).toISOString();
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({
        id: "err_old",
        module: "Skills Signal Engine",
        route: "/skills",
        message: "stale boom",
        at: staleAt,
      })
    );

    render(<LastErrorPanel />);

    // Two role=status nodes exist: outer container + sr-only live region.
    const containers = screen.getAllByRole("status");
    expect(containers.length).toBeGreaterThanOrEqual(1);
    const outer = containers[0];
    expect(outer.getAttribute("aria-live")).toBe("off");
    expect(screen.getByText(/Last error \(expired\)/i)).toBeTruthy();
    expect(screen.getByText("Expired")).toBeTruthy();
    // Should NOT be flagged as a fresh alert.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("stale boom")).toBeTruthy();
  });

  it("renders an active alert (role=alert) for a fresh record", () => {
    const freshAt = new Date().toISOString();
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({
        id: "err_new",
        module: "Skills Signal Engine",
        route: "/skills",
        message: "fresh boom",
        at: freshAt,
      })
    );

    render(<LastErrorPanel />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Expired")).toBeNull();
    expect(screen.getByText("fresh boom")).toBeTruthy();
  });

  it("renders nothing when no record is present", () => {
    const { container } = render(<LastErrorPanel />);
    // Component returns null → empty render.
    expect(container.firstChild).toBeNull();
  });
});
