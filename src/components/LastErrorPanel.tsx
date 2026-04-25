import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Copy, X, Check, Clock } from "lucide-react";
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
 *
 * Accessibility:
 *  - Container is `role="alert"` so screen readers announce the error on mount.
 *  - A separate visually-hidden `aria-live="polite"` region announces copy
 *    success/failure so AT users always hear feedback for the Copy button.
 *  - When the record is older than 24h, we render a muted "Expired" badge
 *    instead of an active alert.
 */
export function LastErrorPanel({ moduleFilter }: LastErrorPanelProps) {
  const [rec, setRec] = useState<LastErrorRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [announce, setAnnounce] = useState<string>("");
  const announceTimer = useRef<number | null>(null);

  useEffect(() => {
    setRec(readLastError());
    return subscribeLastError(setRec);
  }, []);

  useEffect(() => {
    return () => {
      if (announceTimer.current !== null) {
        window.clearTimeout(announceTimer.current);
      }
    };
  }, []);

  function announceMessage(msg: string) {
    // Clear first so identical consecutive messages still re-announce.
    setAnnounce("");
    if (announceTimer.current !== null) {
      window.clearTimeout(announceTimer.current);
    }
    announceTimer.current = window.setTimeout(() => {
      setAnnounce(msg);
    }, 50);
  }

  if (!rec) return null;
  if (moduleFilter && !rec.module.startsWith(moduleFilter)) return null;

  const expired = rec.expired === true;

  function copyId() {
    if (!rec) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Clipboard not available");
      announceMessage("Could not copy: clipboard not available");
      return;
    }
    navigator.clipboard
      .writeText(rec.id)
      .then(() => {
        setCopied(true);
        toast.success(`Copied ${rec.id}`);
        announceMessage(`Copied error id ${rec.id} to clipboard`);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        toast.error("Could not copy error id");
        announceMessage("Failed to copy error id");
      });
  }

  return (
    <>
      <div
        role={expired ? "status" : "alert"}
        aria-live={expired ? "off" : "polite"}
        className={`mb-4 flex items-start gap-3 rounded-lg border px-3 py-2 text-[11.5px] ${
          expired
            ? "border-border-soft bg-bg-3"
            : "border-coral/40 bg-coral-soft/30"
        }`}
      >
        {expired ? (
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tx-2" />
        ) : (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-display text-[11.5px] font-semibold text-tx-0">
              {expired ? "Last error (expired)" : "Last error"}
            </span>
            {expired && (
              <span className="rounded bg-bg-4 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-tx-2">
                Expired
              </span>
            )}
            <span className="text-tx-2">·</span>
            <span className="text-tx-1">{rec.module}</span>
            <span className="text-tx-2">·</span>
            <code className="truncate text-[10.5px] text-tx-2">
              {rec.route}
            </code>
          </div>
          <p
            className={`mt-0.5 truncate ${expired ? "text-tx-2" : "text-tx-1"}`}
            title={rec.message}
          >
            {rec.message}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded bg-bg-3 px-1.5 py-0.5 text-[10px] text-tx-2">
              {rec.id}
            </code>
            <button
              type="button"
              onClick={copyId}
              aria-label={`Copy error id ${rec.id}`}
              className="inline-flex items-center gap-1 rounded border border-border-soft bg-bg-3 px-1.5 py-0.5 text-[10px] text-tx-1 transition hover:border-gold-glow hover:text-gold"
            >
              {copied ? (
                <Check className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Copy className="h-3 w-3" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy id"}
            </button>
            <span className="text-[10px] text-tx-2">
              {new Date(rec.at).toLocaleTimeString()}
              {expired && " (more than 24h ago)"}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss last error"
          onClick={clearLastError}
          className="rounded p-1 text-tx-2 transition hover:bg-bg-3 hover:text-tx-0"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Visually-hidden live region for copy success/failure announcements. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announce}
      </div>
    </>
  );
}
