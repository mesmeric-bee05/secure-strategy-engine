import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useSkillsHotkeys } from "@/hooks/useSkillsHotkeys";

function dispatchKey(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
}

describe("useSkillsHotkeys", () => {
  let onExport: ReturnType<typeof vi.fn<() => void>>;
  let onImport: ReturnType<typeof vi.fn<() => void>>;
  let onPrev: ReturnType<typeof vi.fn<() => void>>;
  let onNext: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onExport = vi.fn<() => void>();
    onImport = vi.fn<() => void>();
    onPrev = vi.fn<() => void>();
    onNext = vi.fn<() => void>();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  function mount() {
    return renderHook(() =>
      useSkillsHotkeys({
        onExport,
        onImport,
        onPrevPersona: onPrev,
        onNextPersona: onNext,
      })
    );
  }

  it("fires onExport for Ctrl+S", () => {
    mount();
    dispatchKey({ key: "s", ctrlKey: true });
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("fires onExport for Cmd+S (metaKey)", () => {
    mount();
    dispatchKey({ key: "S", metaKey: true });
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("fires onImport for Ctrl+I", () => {
    mount();
    dispatchKey({ key: "i", ctrlKey: true });
    expect(onImport).toHaveBeenCalledOnce();
  });

  it("cycles personas with Alt+Arrow when focus is outside text fields", () => {
    mount();
    dispatchKey({ key: "ArrowRight", altKey: true });
    expect(onNext).toHaveBeenCalledOnce();
    dispatchKey({ key: "ArrowLeft", altKey: true });
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it("does NOT cycle personas when Alt+Arrow originates inside a textarea", () => {
    mount();
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.focus();
    ta.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        altKey: true,
        bubbles: true,
      })
    );
    expect(onNext).not.toHaveBeenCalled();
  });

  it("ignores plain S/I keys without modifier", () => {
    mount();
    dispatchKey({ key: "s" });
    dispatchKey({ key: "i" });
    expect(onExport).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    renderHook(() =>
      useSkillsHotkeys({
        onExport,
        onImport,
        onPrevPersona: onPrev,
        onNextPersona: onNext,
        enabled: false,
      })
    );
    dispatchKey({ key: "s", ctrlKey: true });
    dispatchKey({ key: "ArrowRight", altKey: true });
    expect(onExport).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });
});
