import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export interface RouteErrorBoundaryProps {
  error: Error;
  reset: () => void;
  /** Module label for context — e.g. "Skills Engine" */
  module?: string;
}

/**
 * User-friendly error boundary used by route `errorComponent`.
 * Logs the full error to the console for debugging and surfaces a
 * concise, branded panel with a Retry button that re-runs loaders.
 */
export function RouteErrorBoundary({
  error,
  reset,
  module = "this page",
}: RouteErrorBoundaryProps) {
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(`[RouteError:${module}]`, error);
  }, [error, module]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="rounded-xl border border-coral/40 bg-coral-soft/40 p-6">
        <div className="mb-3 flex items-center gap-2 text-coral">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="font-display text-[15px] font-semibold">
            Something broke loading {module}
          </h2>
        </div>
        <p className="mb-4 text-[12.5px] leading-relaxed text-tx-1">
          {error.message || "An unexpected error occurred."}
        </p>
        <details className="mb-4 rounded-md border border-border-soft bg-bg-3 p-3 text-[11px] text-tx-2">
          <summary className="cursor-pointer text-tx-1">
            Technical details
          </summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-[10.5px]">
            {error.stack ?? error.message}
          </pre>
        </details>
        <button
          type="button"
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-[12px] font-semibold text-bg-0 transition hover:opacity-90"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    </div>
  );
}
