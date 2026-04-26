import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-0 px-4 text-tx-0">
      <div className="max-w-md text-center">
        <p className="eyebrow mb-2">404 · Lost in the talent graph</p>
        <h1 className="font-display text-7xl font-bold text-tx-0">404</h1>
        <h2 className="mt-4 font-display text-xl font-semibold text-tx-0">
          Page not found
        </h2>
        <p className="mt-2 text-sm text-tx-1">
          That route does not exist in TalentGraph Africa. The product lives
          across three modules — start at the Overview.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-gold px-4 py-2 text-sm font-semibold text-bg-0 transition hover:opacity-90"
          >
            Back to overview
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "theme-color", content: "#060B16" },
      { title: "TalentGraph Africa — UNMAPPED · World Bank Challenge 05" },
      {
        name: "description",
        content:
          "An AI + cryptographic credentials platform that maps the 600M informal workers of Sub-Saharan Africa to ISCO-08 occupations and visible global opportunities.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "TalentGraph Africa" },
      {
        property: "og:title",
        content: "TalentGraph Africa — UNMAPPED · World Bank Challenge 05",
      },
      {
        property: "og:description",
        content:
          "Map informal-economy skills to ISCO-08, see Frey-Osborne automation risk calibrated for LMIC contexts, and surface real global opportunities. Built for the World Bank Unmapped challenge.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "TalentGraph Africa — UNMAPPED · World Bank Challenge 05",
      },
      {
        name: "twitter:description",
        content:
          "AI + cryptographic credentials for the 600M unmapped informal workers of Sub-Saharan Africa.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg-0 text-tx-0 antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "oklch(0.185 0.040 263)",
            border: "1px solid oklch(1 0 0 / 0.09)",
            color: "oklch(0.945 0.012 86)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
