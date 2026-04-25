import {
  createRouter,
  useRouter,
  Link,
} from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-0 px-4 text-tx-0">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-coral-soft text-coral text-2xl">
          !
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-tx-1">
          The page hit an unexpected error. You can retry or head back to the
          overview.
        </p>
        {import.meta.env.DEV && error.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md border border-border-soft bg-bg-2 p-3 text-left font-mono text-xs text-coral">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-gold px-4 py-2 text-sm font-semibold text-bg-0 transition hover:opacity-90"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-border-strong bg-transparent px-4 py-2 text-sm font-medium text-tx-0 hover:bg-bg-2"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export interface RouterContext {
  queryClient: QueryClient;
}

export const getRouter = () => {
  // Fresh QueryClient per request — no module singleton (prevents SSR data leak)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient } satisfies RouterContext,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
