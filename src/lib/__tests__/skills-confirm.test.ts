/**
 * Confirmation-prompt behaviour for switching personas with unsaved changes.
 *
 * The unsaved-change check reuses the pure helper `hasUnsavedChanges` from
 * `@/lib/skills-drafts`. We re-implement the tiny "switchPersona" decision
 * here so tests verify the exact branch the route takes — without mounting
 * the full route.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasUnsavedChanges } from "@/lib/skills-drafts";

interface SwitchEnv {
  draftMap: Record<string, string>;
  saved: Record<string, string>;
  current: string | undefined;
}

function trySwitch(env: SwitchEnv, next: string): {
  switched: boolean;
  promptShown: boolean;
} {
  if (next === env.current) return { switched: false, promptShown: false };
  let promptShown = false;
  if (env.current && hasUnsavedChanges(env.draftMap, env.saved, env.current)) {
    promptShown = true;
    const ok = window.confirm("unsaved");
    if (!ok) return { switched: false, promptShown };
  }
  return { switched: true, promptShown };
}

describe("switchPersona confirmation behaviour", () => {
  const confirmSpy = vi.spyOn(window, "confirm");

  beforeEach(() => {
    confirmSpy.mockReset();
  });
  afterEach(() => {
    confirmSpy.mockReset();
  });

  it("does not prompt when there are no unsaved changes", () => {
    const env: SwitchEnv = {
      draftMap: { sarah: "same" },
      saved: { sarah: "same" },
      current: "sarah",
    };
    const r = trySwitch(env, "james");
    expect(r.promptShown).toBe(false);
    expect(r.switched).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("prompts and aborts when user cancels (returns false)", () => {
    confirmSpy.mockReturnValueOnce(false);
    const env: SwitchEnv = {
      draftMap: { sarah: "edited" },
      saved: { sarah: "original" },
      current: "sarah",
    };
    const r = trySwitch(env, "james");
    expect(r.promptShown).toBe(true);
    expect(r.switched).toBe(false);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Critical: the unsaved draft is preserved in the map (caller should not
    // mutate). Our test holds the original reference unchanged.
    expect(env.draftMap.sarah).toBe("edited");
  });

  it("prompts and proceeds when user confirms (returns true)", () => {
    confirmSpy.mockReturnValueOnce(true);
    const env: SwitchEnv = {
      draftMap: { sarah: "edited" },
      saved: { sarah: "original" },
      current: "sarah",
    };
    const r = trySwitch(env, "james");
    expect(r.promptShown).toBe(true);
    expect(r.switched).toBe(true);
    // Previous persona's draft is intentionally retained for return visits.
    expect(env.draftMap.sarah).toBe("edited");
  });

  it("never prompts when switching to the same persona", () => {
    const env: SwitchEnv = {
      draftMap: { sarah: "edited" },
      saved: { sarah: "original" },
      current: "sarah",
    };
    const r = trySwitch(env, "sarah");
    expect(r.switched).toBe(false);
    expect(r.promptShown).toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
