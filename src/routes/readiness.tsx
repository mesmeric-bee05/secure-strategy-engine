import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";
import { CitationsPanel } from "@/components/CitationsPanel";
import { useQuery } from "@tanstack/react-query";
import { getCitations } from "@/server/citations.functions";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/readiness")({
  head: () => ({
    meta: [
      {
        title:
          "AI Readiness Lens — Frey-Osborne automation risk · TalentGraph",
      },
      {
        name: "description",
        content:
          "Per-skill automation risk based on Frey & Osborne (2013), calibrated for LMIC context, with Wittgenstein 2025-2035 education projections.",
      },
      {
        property: "og:title",
        content: "AI Readiness Lens · TalentGraph Africa",
      },
      {
        property: "og:description",
        content:
          "See your displacement risk and durable-skill paths, grounded in published research.",
      },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({
      queryKey: ["citations", null],
      queryFn: () => getCitations({ data: {} }),
    });
  },
  component: ReadinessPage,
});

function ReadinessPage() {
  const citationsQ = useQuery({
    queryKey: ["citations", null],
    queryFn: () => getCitations({ data: {} }),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        <PageTitle
          module="Module 02"
          eyebrow="AI Readiness & Displacement Risk Lens"
          description="Based on Frey & Osborne (2013) automation probabilities, calibrated for LMIC context where task composition and economic conditions differ from the US baseline. Projections to 2035 use Wittgenstein Centre education scenarios."
        >
          Your automation risk profile
        </PageTitle>

        <div className="rounded-xl border border-gold-glow bg-gold-soft p-5 text-[12.5px] leading-relaxed text-gold">
          <div className="flex items-start gap-3">
            <Construction className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold text-tx-0">
                Module 02 is wired to live data
              </p>
              <p className="mt-1 text-tx-1">
                The Frey-Osborne probabilities, LMIC calibration factors per
                country, and Wittgenstein SSP2 projections are already in the
                database (see <a className="underline" href="/skills">Skills Engine</a> to
                generate a profile, then return here). The full gauge,
                per-skill risk rows, adjacent-skill recommender and stacked
                projection chart land in the next iteration to keep this turn
                shippable.
              </p>
            </div>
          </div>
        </div>

        <CitationsPanel citations={citationsQ.data ?? []} defaultOpen />
      </div>
    </AppShell>
  );
}
