/**
 * Integration: migration warning lifecycle in ImportReviewDialog.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ImportReviewDialog, type StagedRow } from "@/components/ImportReviewDialog";
import {
  buildLocalDataDump,
  LOCAL_DATA_DUMP_VERSION,
  migrateLocalDataDump,
} from "@/lib/skills-drafts";

function row(slug: string): StagedRow {
  return { slug, incomingText: "x", currentText: "", source: "v0.json", action: "overwrite" };
}

describe("schemaVersion migration warning", () => {
  it("v0 dump migrates to v1 and the dialog shows a status banner", () => {
    // Build a current dump and strip schemaVersion to simulate a v0 file.
    const current = buildLocalDataDump({ drafts: { sarah: "hi" }, languages: {} });
    const v0 = { ...current } as Record<string, unknown>;
    delete v0.schemaVersion;

    const outcome = migrateLocalDataDump(v0)!;
    expect(outcome.migrated).toBe(true);
    expect(outcome.fromVersion).toBe(0);
    expect(outcome.dump.schemaVersion).toBe(LOCAL_DATA_DUMP_VERSION);
    const notice = `v0.json: ${outcome.notes.join(" ")}`;

    const { rerender } = render(
      <ImportReviewDialog
        open
        rows={[row("sarah")]}
        errors={[]}
        migrationNotice={notice}
        onCancel={() => {}}
        onApply={() => {}}
      />,
    );

    const status = screen.getByRole("status");
    expect(status.textContent).toMatch(/Upgraded snapshot from schemaVersion 0 to 1/);

    // After retry/cancel, the parent clears migrationNotice.
    rerender(
      <ImportReviewDialog
        open
        rows={[row("sarah")]}
        errors={[]}
        onCancel={() => {}}
        onApply={() => {}}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("v1 dump does not produce a migration notice", () => {
    const current = buildLocalDataDump({ drafts: { sarah: "hi" }, languages: {} });
    const outcome = migrateLocalDataDump(current)!;
    expect(outcome.migrated).toBe(false);
    expect(outcome.fromVersion).toBe(1);

    render(
      <ImportReviewDialog
        open
        rows={[row("sarah")]}
        errors={[]}
        onCancel={() => {}}
        onApply={() => {}}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});
