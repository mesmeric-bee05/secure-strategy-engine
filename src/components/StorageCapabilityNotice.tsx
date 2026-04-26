import { useEffect, useState } from "react";
import { AlertOctagon, AlertTriangle, Info, RotateCw } from "lucide-react";

import { probeStorage, type StorageCapability } from "@/lib/storage-capability";

export interface StorageCapabilityNoticeProps {
  /** Called once on mount + on every Retry — receive the latest probe result. */
  onProbe?: (cap: StorageCapability) => void;
  /** Optional shortcut to "Download my local data". */
  onDownload?: () => void;
}

/**
 * Renders an alert above the editor when localStorage is missing, denied
 * (private mode), at quota, or near quota. Returns `null` in the healthy
 * case so the editor surface stays clean.
 */
export function StorageCapabilityNotice({ onProbe, onDownload }: StorageCapabilityNoticeProps) {
  const [cap, setCap] = useState<StorageCapability | null>(null);

  useEffect(() => {
    const result = probeStorage("local");
    setCap(result);
    onProbe?.(result);
    // We only want a single mount-time probe; explicit Retry below replays it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cap) return null;
  if (cap.available && !cap.nearQuota) return null;

  const reason: NonNullable<StorageCapability["reason"]> = cap.reason ?? "unknown";

  const headline =
    reason === "missing"
      ? "This browser doesn't expose local storage"
      : reason === "denied"
        ? "Your browser is blocking persistent storage"
        : reason === "quota"
          ? "Your browser's storage is almost full"
          : "Your browser may not save drafts reliably";

  const body =
    reason === "missing"
      ? "Drafts will live only in this tab. Use “Download my data” to keep a copy before closing."
      : reason === "denied"
        ? "Private/Incognito mode prevents this site from saving anything between visits. Drafts work in this tab — Download my data before closing."
        : reason === "quota"
          ? "We could write a small value but a 64KB test failed. Free space (Export old drafts, then delete unused personas) before typing more."
          : "We couldn't verify that drafts will persist. Save manually with Download my data to be safe.";

  const Icon = reason === "quota" ? AlertTriangle : reason === "missing" ? Info : AlertOctagon;

  const tone =
    reason === "quota"
      ? "border-coral/50 bg-coral-soft/30 text-coral"
      : reason === "missing"
        ? "border-border-strong bg-bg-3 text-tx-1"
        : "border-coral/50 bg-coral-soft/30 text-coral";

  function retry() {
    const result = probeStorage("local");
    setCap(result);
    onProbe?.(result);
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`anim-fade-in mb-4 flex flex-col gap-2 rounded-xl border px-4 py-3 text-[12px] sm:flex-row sm:items-center ${tone}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-display text-[12.5px] font-semibold">{headline}</p>
        <p className="mt-0.5 text-tx-1">{body}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="rounded-md border border-border-strong bg-bg-3 px-2.5 py-1 text-[10.5px] font-medium text-tx-0 transition hover:border-gold-glow hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-glow"
          >
            Download my data
          </button>
        )}
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-bg-3 px-2.5 py-1 text-[10.5px] font-medium text-tx-0 transition hover:border-gold-glow hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-glow"
        >
          <RotateCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      </div>
    </div>
  );
}
