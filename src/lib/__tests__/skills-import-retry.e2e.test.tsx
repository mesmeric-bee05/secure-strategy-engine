/**
 * E2E-ish: rejected import → retry → corrected file staged → apply.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ImportReviewDialog, type FileError, type StagedRow } from "@/components/ImportReviewDialog";
import { classifyImportError, parseImport, pickDefaultAction } from "@/lib/skills-drafts";

function rejectFile(name: string, raw: string): FileError {
  try {
    JSON.parse(raw);
    throw new Error("expected to fail");
  } catch (e) {
    const c = classifyImportError(e);
    return { filename: name, message: c.message, rule: c.rule, hint: c.hint };
  }
}

function stageGood(name: string, body: object, current: Record<string, string>): StagedRow[] {
  const parsed = parseImport(body);
  return Object.entries(parsed.drafts).map(([slug, incomingText]) => ({
    slug,
    incomingText,
    currentText: current[slug] ?? "",
    source: name,
    action: pickDefaultAction({ incomingText, currentText: current[slug] ?? "" }),
    autoChosen: true,
  }));
}

describe("import retry flow", () => {
  it("clicking retry fires onRetry; re-staging swaps alert for staged rows", () => {
    const onRetry = vi.fn();
    const onApply = vi.fn();
    const bad = rejectFile("bad.json", "{not json");

    const { rerender } = render(
      <ImportReviewDialog
        open
        rows={[]}
        errors={[bad]}
        onRetry={onRetry}
        onCancel={() => {}}
        onApply={onApply}
      />,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /pick a corrected file and retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Parent re-stages with corrected file.
    const goodRows = stageGood(
      "good.json",
      {
        version: 1,
        exportedAt: "2025-06-01T00:00:00Z",
        drafts: { sarah: "fresh sarah" },
        languages: {},
      },
      {},
    );
    rerender(
      <ImportReviewDialog
        open
        rows={goodRows}
        errors={[]}
        onRetry={onRetry}
        onCancel={() => {}}
        onApply={onApply}
      />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("sarah")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /apply 1 change/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0][0].slug).toBe("sarah");
  });
});
