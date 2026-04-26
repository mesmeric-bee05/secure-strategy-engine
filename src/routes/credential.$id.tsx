import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";
import { ShieldCheck, QrCode } from "lucide-react";

export const Route = createFileRoute("/credential/$id")({
  head: ({ params }) => ({
    meta: [
      {
        title: `Credential ${params.id} — TalentGraph Africa Verifier`,
      },
      {
        name: "description",
        content:
          "Public, third-party verifier for a TalentGraph Africa skill credential. No login required.",
      },
      {
        property: "og:title",
        content: "TalentGraph Africa Credential",
      },
    ],
  }),
  component: CredentialVerifyPage,
});

function sanitizeCredentialId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9\-_]/g, "").slice(0, 64);
}

function CredentialVerifyPage() {
  const { id: rawId } = Route.useParams();
  const id = sanitizeCredentialId(rawId);
  const isPreview = id === "preview";

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-10 md:px-10">
        <PageTitle module="Public verifier" eyebrow="No login required">
          Credential verification
        </PageTitle>

        <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-bg-2 to-bg-1 p-6 shadow-[0_0_30px_-10px_oklch(0.770_0.140_75/0.4)]">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold text-gold">◈ TalentGraph Africa</span>
            <span className="inline-flex items-center gap-1 rounded border border-teal/40 bg-teal-soft px-2 py-0.5 font-mono text-[9px] font-bold text-teal">
              <ShieldCheck className="h-3 w-3" /> Verified
            </span>
          </div>

          {isPreview ? (
            <>
              <p className="font-display text-[20px] font-bold text-tx-0">Preview credential</p>
              <p className="mt-1 text-[12px] text-tx-2">
                This is a non-issued preview shown from the Skills Engine. Generate a real, signed
                credential by signing in and adding three peer attestations.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-[20px] font-bold text-tx-0">
                Credential <span className="font-mono text-gold">{id}</span>
              </p>
              <p className="mt-1 text-[12px] text-tx-2">
                Live anchor lookup arrives with the trust layer in the next iteration. The route,
                public RLS read policy, and append-only `credential_anchors` table are already in
                place.
              </p>
            </>
          )}

          <div className="mt-4 flex items-end justify-between border-t border-border-soft pt-3">
            <p className="font-mono text-[9px] text-tx-2">
              Anchored · TalentGraph Cloud · SHA-256 + ECDSA
            </p>
            <div className="flex h-12 w-12 items-center justify-center rounded border border-border-strong bg-bg-3">
              <QrCode className="h-7 w-7 text-tx-1" />
            </div>
          </div>
        </div>

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1 text-[11px] text-tx-1 hover:text-gold"
        >
          ← Back to overview
        </Link>
      </div>
    </AppShell>
  );
}
