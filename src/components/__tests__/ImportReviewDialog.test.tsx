import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { ImportReviewDialog, type StagedRow } from "@/components/ImportReviewDialog";

function row(slug: string, source = "a.json", action: StagedRow["action"] = "keep"): StagedRow {
  return {
    slug,
    incomingText: `incoming for ${slug}`,
    currentText: `current for ${slug}`,
    source,
    action,
  };
}

describe("ImportReviewDialog — accessibility", () => {
  it("renders as a labelled dialog", () => {
    render(
      <ImportReviewDialog open rows={[row("sarah")]} errors={[]} onCancel={() => {}} onApply={() => {}} />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Review import")).toBeTruthy();
  });

  it("invokes onCancel when Escape is pressed", () => {
    const onCancel = vi.fn();
    render(
      <ImportReviewDialog open rows={[row("sarah")]} errors={[]} onCancel={onCancel} onApply={() => {}} />,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("exposes 3 radio options per row with toggling aria-checked", () => {
    render(
      <ImportReviewDialog open rows={[row("sarah")]} errors={[]} onCancel={() => {}} onApply={() => {}} />,
    );
    const group = screen.getByRole("radiogroup", { name: /conflict action for sarah/i });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0].getAttribute("aria-checked")).toBe("true"); // keep
    fireEvent.click(radios[1]); // overwrite
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
    expect(radios[0].getAttribute("aria-checked")).toBe("false");
  });

  it("renders the errors block with role=alert", () => {
    render(
      <ImportReviewDialog
        open
        rows={[]}
        errors={[{ filename: "bad.json", message: "boom" }]}
        onCancel={() => {}}
        onApply={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

describe("ImportReviewDialog — bulk Apply-to-all", () => {
  it("hides the bulk toolbar when only one row is staged", () => {
    render(
      <ImportReviewDialog open rows={[row("sarah")]} errors={[]} onCancel={() => {}} onApply={() => {}} />,
    );
    expect(screen.queryByRole("group", { name: /apply the same action/i })).toBeNull();
  });

  it("Overwrite all flips every row to overwrite and updates count", () => {
    const onApply = vi.fn();
    render(
      <ImportReviewDialog
        open
        rows={[row("sarah"), row("james"), row("amina")]}
        errors={[]}
        onCancel={() => {}}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /overwrite all/i }));
    const apply = screen.getByRole("button", { name: /apply 3 changes/i });
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledOnce();
    for (const r of onApply.mock.calls[0][0]) {
      expect(r.action).toBe("overwrite");
    }
  });

  it("Keep all disables the Apply button", () => {
    render(
      <ImportReviewDialog
        open
        rows={[row("sarah", "a.json", "overwrite"), row("james", "b.json", "append")]}
        errors={[]}
        onCancel={() => {}}
        onApply={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /keep all/i }));
    const apply = screen.getByRole("button", { name: /apply 0 changes/i });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
  });

  it("per-row override still wins after a bulk click", () => {
    const onApply = vi.fn();
    render(
      <ImportReviewDialog
        open
        rows={[row("sarah"), row("james")]}
        errors={[]}
        onCancel={() => {}}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /overwrite all/i }));
    const sarahGroup = screen.getByRole("radiogroup", { name: /conflict action for sarah/i });
    fireEvent.click(within(sarahGroup).getAllByRole("radio")[0]); // keep
    fireEvent.click(screen.getByRole("button", { name: /apply 1 change/i }));
    const rows = onApply.mock.calls[0][0] as StagedRow[];
    expect(rows.find((r) => r.slug === "sarah")?.action).toBe("keep");
    expect(rows.find((r) => r.slug === "james")?.action).toBe("overwrite");
  });
});
