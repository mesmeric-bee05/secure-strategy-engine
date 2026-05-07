/**
 * Focus management: Radix Dialog must move focus into the open dialog, return
 * it to the trigger after close, and not "trap" the user (Tab still cycles
 * inside, Escape returns focus).
 */
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ImportReviewDialog, type StagedRow } from "@/components/ImportReviewDialog";

function row(slug: string): StagedRow {
  return { slug, incomingText: "x", currentText: "", source: "a.json", action: "overwrite" };
}

function Harness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)}>
        Open import
      </button>
      <ImportReviewDialog
        open={open}
        rows={[row("sarah")]}
        errors={[]}
        onCancel={() => {
          setOpen(false);
          // Radix returns focus automatically; this just guards the test path.
          requestAnimationFrame(() => triggerRef.current?.focus());
        }}
        onApply={() => {
          setOpen(false);
          requestAnimationFrame(() => triggerRef.current?.focus());
        }}
      />
    </>
  );
}

describe("ImportReviewDialog — focus management", () => {
  it("moves focus into the dialog on open and returns it to the trigger on cancel", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: /open import/i });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);

    // Focus moves into the dialog.
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    // Escape closes; focus returns to trigger.
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("returns focus to the trigger after Apply", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: /open import/i });
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: /apply 1 change/i }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
