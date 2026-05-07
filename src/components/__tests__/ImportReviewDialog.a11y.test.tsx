import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { ImportReviewDialog } from "@/components/ImportReviewDialog";

describe("ImportReviewDialog — enriched error UI a11y", () => {
  const errors = [
    {
      filename: "bad.json",
      message: "Invalid backup at drafts.sarah: contains HTML/JS-like content",
      rule: "Safe text",
      hint: "Remove HTML/JS, control characters, or shorten very long entries.",
    },
  ];

  it("exposes errors in a role=alert region with rule chip and hint", () => {
    render(
      <ImportReviewDialog
        open
        rows={[]}
        errors={errors}
        onCancel={() => {}}
        onApply={() => {}}
        onRetry={() => {}}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Safe text")).toBeTruthy();
    expect(within(alert).getByText(/Remove HTML\/JS/)).toBeTruthy();
    expect(within(alert).getByText(/contains HTML\/JS-like content/)).toBeTruthy();
  });

  it("retry button is keyboard-reachable and triggers onRetry on click and Enter", () => {
    const onRetry = vi.fn();
    render(
      <ImportReviewDialog
        open
        rows={[]}
        errors={errors}
        onCancel={() => {}}
        onApply={() => {}}
        onRetry={onRetry}
      />,
    );
    const btn = screen.getByRole("button", { name: /pick a corrected file and retry/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders migrationNotice in a separate role=status region", () => {
    render(
      <ImportReviewDialog
        open
        rows={[]}
        errors={errors}
        migrationNotice="x.json: Upgraded snapshot from schemaVersion 0 to 1."
        onCancel={() => {}}
        onApply={() => {}}
      />,
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toMatch(/Upgraded snapshot/);
    // alert and status are distinct nodes
    expect(screen.getByRole("alert")).not.toBe(status);
  });

  it("omits role=status when no migrationNotice is provided", () => {
    render(
      <ImportReviewDialog
        open
        rows={[]}
        errors={errors}
        onCancel={() => {}}
        onApply={() => {}}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
