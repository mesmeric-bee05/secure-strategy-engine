import { useMemo, useState } from "react";
import { AlertCircle, FileText } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConflictAction = "keep" | "overwrite" | "append";

export interface StagedRow {
  slug: string;
  incomingText: string;
  currentText: string;
  language?: string;
  /** Filename the row originated from (for display only). */
  source: string;
  action: ConflictAction;
}

export interface FileError {
  filename: string;
  message: string;
}

export interface ImportReviewDialogProps {
  open: boolean;
  rows: StagedRow[];
  errors: FileError[];
  onCancel: () => void;
  onApply: (rows: StagedRow[]) => void;
}

const ACTIONS: ConflictAction[] = ["keep", "overwrite", "append"];

/** Modal: review staged multi-file import; pick action per persona slug. */
export function ImportReviewDialog({
  open,
  rows,
  errors,
  onCancel,
  onApply,
}: ImportReviewDialogProps) {
  const [staged, setStaged] = useState<StagedRow[]>(rows);

  // Reset when the parent re-stages (new file batch).
  useMemo(() => setStaged(rows), [rows]);

  const applyCount = staged.filter((r) => r.action !== "keep").length;

  function setAction(slug: string, source: string, action: ConflictAction) {
    setStaged((prev) =>
      prev.map((r) =>
        r.slug === slug && r.source === source ? { ...r, action } : r
      )
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review import</DialogTitle>
          <DialogDescription>
            Choose what to do for each persona. Only rows set to{" "}
            <strong>Overwrite</strong> or <strong>Append</strong> will change
            your drafts.
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-md border border-coral/40 bg-coral-soft/20 px-3 py-2 text-[11.5px] text-coral"
          >
            <p className="mb-1 flex items-center gap-1.5 font-semibold">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              {errors.length} file{errors.length === 1 ? "" : "s"} could not be
              read
            </p>
            <ul className="ml-4 list-disc space-y-0.5">
              {errors.map((e, i) => (
                <li key={i}>
                  <span className="font-mono">{e.filename}</span> — {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {staged.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-tx-2">
            No drafts to review.
          </p>
        ) : (
          <ul className="space-y-3">
            {staged.map((row) => (
              <li
                key={`${row.slug}__${row.source}`}
                className="rounded-lg border border-border-soft bg-bg-2 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-[12.5px] font-semibold text-tx-0">
                      {row.slug}
                    </p>
                    <p className="flex items-center gap-1 text-[10px] text-tx-2">
                      <FileText className="h-2.5 w-2.5" aria-hidden="true" />
                      {row.source}
                    </p>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={`Conflict action for ${row.slug}`}
                    className="flex gap-1"
                  >
                    {ACTIONS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        role="radio"
                        aria-checked={row.action === a}
                        onClick={() => setAction(row.slug, row.source, a)}
                        className={`rounded-md border px-2.5 py-1 text-[10.5px] font-medium capitalize transition ${
                          row.action === a
                            ? "border-gold bg-gold-soft text-gold"
                            : "border-border-strong bg-bg-3 text-tx-1 hover:border-gold-glow"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-border-soft bg-bg-3 p-2">
                    <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wider text-tx-2">
                      Current ({row.currentText.length} chars)
                    </p>
                    <p className="line-clamp-3 text-[11px] text-tx-1">
                      {row.currentText.slice(0, 120) || "—"}
                    </p>
                  </div>
                  <div className="rounded-md border border-gold-glow bg-gold-soft/30 p-2">
                    <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wider text-gold">
                      Incoming ({row.incomingText.length} chars)
                    </p>
                    <p className="line-clamp-3 text-[11px] text-tx-1">
                      {row.incomingText.slice(0, 120)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border-strong bg-bg-3 px-3 py-1.5 text-[11px] text-tx-1 hover:border-gold-glow"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(staged)}
            disabled={applyCount === 0}
            className="rounded-md bg-gold px-3 py-1.5 text-[11px] font-semibold text-bg-0 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply {applyCount} change{applyCount === 1 ? "" : "s"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
