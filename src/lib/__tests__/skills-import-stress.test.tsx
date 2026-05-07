/**
 * Stress test: large multi-file import + large local-data dump.
 * Validates that the staging pipeline + dialog stay correct (and reasonably
 * fast) when given many rows, and that error chips still render with the
 * right rule labels among a sea of valid rows.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ImportReviewDialog, type FileError, type StagedRow } from "@/components/ImportReviewDialog";
import {
  buildLocalDataDump,
  classifyImportError,
  parseLocalDataDump,
  parseImport,
  pickDefaultAction,
} from "@/lib/skills-drafts";

function bigDrafts(n: number, sizeChars: number): Record<string, string> {
  const out: Record<string, string> = {};
  const chunk = "lorem ipsum ".repeat(Math.ceil(sizeChars / 12)).slice(0, sizeChars);
  for (let i = 0; i < n; i++) out[`persona_${i}`] = chunk;
  return out;
}

describe("stress — large imports + large dumps", () => {
  it("buildLocalDataDump+parseLocalDataDump round-trips 200 personas under 1s", () => {
    const drafts = bigDrafts(200, 500);
    const t0 = performance.now();
    const dump = buildLocalDataDump({ drafts, languages: {} });
    const restored = parseLocalDataDump(JSON.parse(JSON.stringify(dump)));
    const elapsed = performance.now() - t0;
    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.dump.personas).toHaveLength(200);
    expect(elapsed).toBeLessThan(1000);
  });

  it("renders 150 staged rows and one rejected file with correct rule chip", () => {
    const drafts = bigDrafts(150, 100);
    const parsed = parseImport({
      version: 1,
      exportedAt: "2025-06-01T00:00:00Z",
      drafts,
      languages: {},
    });
    const rows: StagedRow[] = Object.entries(parsed.drafts).map(([slug, incomingText]) => ({
      slug,
      incomingText,
      currentText: "",
      source: "huge.json",
      action: pickDefaultAction({ incomingText, currentText: "" }),
    }));
    let rejected: FileError;
    try {
      JSON.parse("{not json");
      throw new Error("unreachable");
    } catch (e) {
      const c = classifyImportError(e);
      rejected = { filename: "broken.json", message: c.message, rule: c.rule, hint: c.hint };
    }

    const t0 = performance.now();
    render(
      <ImportReviewDialog
        open
        rows={rows}
        errors={[rejected]}
        onCancel={() => {}}
        onApply={() => {}}
      />,
    );
    const elapsed = performance.now() - t0;

    // Rule chip survives among 150 valid rows.
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("JSON syntax")).toBeTruthy();

    // Bulk toolbar present (>1 row) and apply count reflects the auto-picked
    // overwrites (currentText was empty for all rows).
    expect(screen.getByRole("group", { name: /apply the same action/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /apply 150 changes/i })).toBeTruthy();

    // Render should remain reasonably snappy in jsdom.
    expect(elapsed).toBeLessThan(5000);
  });
});
