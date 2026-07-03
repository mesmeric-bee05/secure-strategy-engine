import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";
import { GeolocationConsent } from "@/components/GeolocationConsent";
import { OpportunitiesMap } from "@/components/OpportunitiesMap";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { listOpportunities } from "@/lib/server-fns/opportunities.functions";
import type { LatLngT } from "@/lib/geo";

export const Route = createFileRoute("/opportunities/map")({
  head: () => ({
    meta: [
      { title: "Opportunities map · TalentGraph Africa" },
      {
        name: "description",
        content:
          "Interactive map of real labour-market opportunities across Sub-Saharan Africa, with optional radius filter from your approximate location.",
      },
      { property: "og:title", content: "Opportunities map · TalentGraph Africa" },
      {
        property: "og:description",
        content:
          "See where the work is. Cluster pins by city; opt-in radius search around your own location.",
      },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({
      queryKey: ["opportunities", null],
      queryFn: () => listOpportunities({ data: { limit: 50 } }),
    });
  },
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <RouteErrorBoundary error={error} reset={reset} module="Opportunities Map" />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="p-6 text-tx-1">Map view not found.</p>
    </AppShell>
  ),
  component: OpportunitiesMapPage,
});

function OpportunitiesMapPage() {
  const [userLoc, setUserLoc] = useState<LatLngT | null>(null);
  const [radius, setRadius] = useState(500);

  const oppsQ = useQuery({
    queryKey: ["opportunities", null],
    queryFn: () => listOpportunities({ data: { limit: 50 } }),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        <Link
          to="/opportunities"
          className="mb-3 inline-flex items-center gap-1 text-[11px] text-tx-2 hover:text-tx-0"
        >
          <ArrowLeft className="h-3 w-3" /> Back to dashboard
        </Link>
        <PageTitle
          module="Module 03 · Map"
          eyebrow="Opportunity Map"
          description="Cluster pins by city. Use your location (optional) to filter within a radius — your coordinates never leave the device."
        >
          Where the work is.
        </PageTitle>

        <div className="mb-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <GeolocationConsent onLocation={setUserLoc} onDecline={() => setUserLoc(null)} />
          {userLoc && (
            <label className="flex items-center gap-2 text-[11px] text-tx-1">
              Radius
              <input
                type="range"
                min={50}
                max={2000}
                step={50}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                aria-label="Search radius in kilometres"
              />
              <span className="font-mono text-[11px] text-gold">{radius} km</span>
            </label>
          )}
        </div>

        <OpportunitiesMap
          opportunities={oppsQ.data ?? []}
          userLocation={userLoc}
          radiusKm={radius}
        />

        <p className="mt-3 text-[10px] italic text-tx-2">
          Map tiles &copy; OpenFreeMap, OpenStreetMap contributors. Coordinates derived from
          city/country centroids — exact employer addresses are intentionally fuzzed.
        </p>
      </div>
    </AppShell>
  );
}
