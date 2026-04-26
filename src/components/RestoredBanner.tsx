import { Info, X } from "lucide-react";

export interface RestoredBannerProps {
  /** Number of personas whose drafts were restored from local storage. */
  count: number;
  onDismiss: () => void;
}

/**
 * One-time, dismissible status banner shown at the top of `/skills` when one
 * or more drafts were rehydrated from localStorage on page load.
 *
 * - `role="status"` + `aria-live="polite"` so screen readers announce it once.
 * - Pure presentational; persistence of the dismissal lives in the parent.
 */
export function RestoredBanner({ count, onDismiss }: RestoredBannerProps) {
  if (count <= 0) return null;
  const label =
    count === 1
      ? "1 draft restored from this browser"
      : `${count} drafts restored from this browser`;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="anim-fade-in mb-4 flex items-center gap-3 rounded-xl border border-gold-glow bg-gold-soft/40 px-4 py-2.5 text-[12px] text-gold"
    >
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="flex-1">
        <strong className="font-semibold">{label}.</strong>{" "}
        <span className="text-tx-1">
          Your previous work was kept locally and is ready to continue.
        </span>
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss restored drafts notice"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-tx-2 transition hover:bg-bg-3 hover:text-tx-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-glow"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
