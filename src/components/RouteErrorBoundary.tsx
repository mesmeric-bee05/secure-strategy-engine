import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { logClientError } from "@/server/audit.functions";
import { recordLastError } from "@/lib/last-error";

export interface RouteErrorBoundaryProps {
  error: Error;
  reset: () => void;
  /** Module label for context — e.g. "Skills Engine" */
  module?: string;
}

export function isDevEnvironment(): boolean {
  return import.meta.env.DEV;
}

/**
 * User-friendly error boundary used by route `errorComponent`.
 * Logs to the append-only audit trail on mount and on retry.
 * Surfaces a toast that confirms whether retry succeeded or failed.
 */
export function RouteErrorBoundary({
  error,
  reset,
  module = "this page",
}: RouteErrorBoundaryProps) {
  const router = useRouter();
  const logError = useServerFn(logClientError);
  const [retrying, setRetrying] = useState(false);
  const showDevDetails = isDevEnvironment();
  const userMessage = showDevDetails
    ? error.message || "An unexpected error occurred."
    : "An unexpected error occurred while loading this page.";

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(`[RouteError:${module}]`, error);
    const route =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "ssr";
    recordLastError({
      module,
      route,
      message: userMessage,
    });
    void logError({
      data: {
        module,
        route,
        message: error.message || "unknown error",
        stack: error.stack?.slice(0, 4000),
      },
    }).catch(() => {
      /* never let audit failure cascade */
    });
  }, [error, module, logError, userMessage]);

  async function handleRetry() {
    setRetrying(true);
    const toastId = toast.loading(`Retrying ${module}…`);
    try {
      await router.invalidate({ sync: true });
      reset();
      toast.success(`${module} loaded`, { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Retry failed";
      toast.error(
        showDevDetails
          ? `Still failing: ${msg}`
          : "Still failing. Please try again shortly.",
        { id: toastId }
      );
      void logError({
        data: {
          module,
          route:
            typeof window !== "undefined"
              ? window.location.pathname + window.location.search
              : "ssr",
          message: `retry_failed: ${msg}`,
        },
      }).catch(() => {
        /* noop */
      });
    } finally {
      setRetrying(false);
    }
  }

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
          {userMessage}
        </p>
        {showDevDetails && (
          <details className="mb-4 rounded-md border border-border-soft bg-bg-3 p-3 text-[11px] text-tx-2">
            <summary className="cursor-pointer text-tx-1">
              Technical details
            </summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-[10.5px]">
              {error.stack ?? error.message}
            </pre>
          </details>
        )}
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-[12px] font-semibold text-bg-0 transition hover:opacity-90 disabled:opacity-60"
        >
          {retrying ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Retrying…
            </>
          ) : (
            <>
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </>
          )}
        </button>
      </div>
    </div>
  );
}
