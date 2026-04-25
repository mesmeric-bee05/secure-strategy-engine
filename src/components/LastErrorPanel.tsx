import { useEffect, useState } from "react";
import { AlertTriangle, Copy, X, Check } from "lucide-react";
import { toast } from "sonner";
import {
  clearLastError,
  readLastError,
  subscribeLastError,
  type LastErrorRecord,
} from "@/lib/last-error";

export interface LastErrorPanelProps {
  /** Only show panels whose `module` starts with this prefix (optional). */
  moduleFilter?: string;
}

/**
 * Compact "Last error" summary surfaced on a page when the route's error
 * boundary recorded a failure. Shows module/route/message and lets the user
 * copy the error id for support.
 */
export function LastErrorPanel({ moduleFilter }: LastErrorPanelProps) {
  const [rec, setRec] = useState<LastErrorRecord | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRec(readLastError());
    return subscribeLastError(setRec);
  }, []);

  if (!rec) return null;
  if (moduleFilter && !rec.module.startsWith(moduleFilter)) return null;

  function copyId() {
    if (!rec) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Clipboard not available");
      return;
    }
    navigator.clipboard
      .writeText(rec.id)
      .then(() => {
        setCopied(true);
        toast.success(`Copied ${rec.id}`);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Could not copy error id"));
  }

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-lg border border-coral/40 bg-coral-soft/30 px-3 py-2 text-[11.5px]"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-display text-[11.5px] font-semibold text-tx-0">
            Last error
          </span>
          <span className="text-tx-2">·</span>
          <span className="text-tx-1">{rec.module}</span>
          <span className="text-tx-2">·</span>
          <code className="truncate text-[10.5px] text-tx-2">{rec.route}</code>
        </div>
        <p className="mt-0.5 truncate text-tx-1" title={rec.message}>
          {rec.message}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <code className="rounded bg-bg-3 px-1.5 py-0.5 text-[10px] text-tx-2">
            {rec.id}
          </code>
          <button
            type="button"
            onClick={copyId}
            className="inline-flex items-center gap-1 rounded border border-border-soft bg-bg-3 px-1.5 py-0.5 text-[10px] text-tx-1 transition hover:border-gold-glow hover:text-gold"
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy id"}
          </button>
          <span className="text-[10px] text-tx-2">
            {new Date(rec.at).toLocaleTimeString()}
          </span>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss last error"
        onClick={clearLastError}
        className="rounded p-1 text-tx-2 transition hover:bg-bg-3 hover:text-tx-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
