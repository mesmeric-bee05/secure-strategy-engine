/**
 * End-to-end-ish test for the multi-file import pipeline:
 *   1. Two backup files staged via parseImport + pickDefaultAction.
 *   2. ImportReviewDialog rendered with the staged rows.
 *   3. User clicks "Overwrite all", then per-row toggles one back to "keep".
 *   4. Apply button fires; the harness writes the resulting patch to
 *      localStorage exactly the way /skills does.
 *   5. Assert localStorage reflects the user's choices precisely.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { ImportReviewDialog, type StagedRow } from "@/components/ImportReviewDialog";
import {
  DRAFT_MAP_KEY,
  parseImport,
  pickDefaultAction,
} from "@/lib/skills-drafts";

function stage(files: Array<{ name: string; body: object }>, current: Record<string, string>) {
  const rows: StagedRow[] = [];
  for (const f of files) {
    const parsed = parseImport(f.body);
    for (const [slug, incomingText] of Object.entries(parsed.drafts)) {
      const currentText = current[slug] ?? "";
      rows.push({
        slug,
        incomingText,
        currentText,
        source: f.name,
        action: pickDefaultAction({ incomingText, currentText }),
        autoChosen: true,
      });
    }
  }
  return rows;
}

function applyToStorage(rows: StagedRow[], current: Record<string, string>) {
  const next = { ...current };
  for (const r of rows) {
    if (r.action === "keep") continue;
    let text = r.incomingText;
    if (r.action === "append" && r.currentText) text = `${r.currentText}\n\n${r.incomingText}`;
    next[r.slug] = text;
  }
  window.localStorage.setItem(DRAFT_MAP_KEY, JSON.stringify(next));
}

describe("multi-file import — bulk apply + per-row override → localStorage", () => {
  beforeEach(() => window.localStorage.clear());

  it("applies overwrite to all except a row the user toggles back to keep", () => {
    const current = { sarah: "old sarah text", james: "old james text" };
    const rows = stage(
      [
        {
          name: "a.json",
          body: {
            version: 1,
            exportedAt: "2025-06-01T00:00:00Z",
            drafts: { sarah: "new sarah" },
            languages: {},
          },
        },
        {
          name: "b.json",
          body: {
            version: 1,
            exportedAt: "2025-06-02T00:00:00Z",
            drafts: { james: "new james", amina: "fresh amina" },
            languages: { amina: "sw-KE" },
          },
        },
      ],
      current,
    );

    expect(rows).toHaveLength(3);
    let captured: StagedRow[] = [];

    render(
      <ImportReviewDialog
        open
        rows={rows}
        errors={[]}
        onCancel={() => {}}
        onApply={(r) => {
          captured = r;
        }}
      />,
    );

    // Bulk → overwrite all, then flip sarah back to keep.
    fireEvent.click(screen.getByRole("button", { name: /overwrite all/i }));
    const sarahGroup = screen.getByRole("radiogroup", { name: /conflict action for sarah/i });
    fireEvent.click(within(sarahGroup).getAllByRole("radio")[0]); // keep

    fireEvent.click(screen.getByRole("button", { name: /apply 2 changes/i }));

    applyToStorage(captured, current);
    const stored = JSON.parse(window.localStorage.getItem(DRAFT_MAP_KEY) ?? "{}");

    expect(stored.sarah).toBe("old sarah text"); // kept
    expect(stored.james).toBe("new james"); // overwritten
    expect(stored.amina).toBe("fresh amina"); // overwritten (was empty)
  });

  it("Append mode concatenates incoming text after current", () => {
    const current = { sarah: "first paragraph" };
    const rows = stage(
      [
        {
          name: "x.json",
          body: {
            version: 1,
            exportedAt: "2025-07-01T00:00:00Z",
            drafts: { sarah: "second paragraph" },
            languages: {},
          },
        },
      ],
      current,
    );
    let captured: StagedRow[] = [];
    render(
      <ImportReviewDialog
        open
        rows={rows}
        errors={[]}
        onCancel={() => {}}
        onApply={(r) => {
          captured = r;
        }}
      />,
    );
    const sarahGroup = screen.getByRole("radiogroup", { name: /conflict action for sarah/i });
    fireEvent.click(within(sarahGroup).getAllByRole("radio")[2]); // append
    fireEvent.click(screen.getByRole("button", { name: /apply 1 change/i }));

    applyToStorage(captured, current);
    const stored = JSON.parse(window.localStorage.getItem(DRAFT_MAP_KEY) ?? "{}");
    expect(stored.sarah).toBe("first paragraph\n\nsecond paragraph");
  });
});
