import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, ShieldX, QrCode, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";
import { getCredentialById } from "@/lib/server-fns/credentials.functions";
import {
  deriveVerificationState,
  formatIssuedAt,
  publicVerifyUrl,
  shortHash,
  whatsAppShareUrl,
  type VerificationState,
} from "@/lib/credentials";

function sanitizeCredentialId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9\-_]/g, "").slice(0, 64);
}

export const Route = createFileRoute("/credential/$id")({
  head: ({ params }) => ({
    meta: [
      {
        title: `Credential ${params.id} — TalentGraph Africa Verifier`,
      },
      {
        name: "description",
        content:
          "Public, third-party verifier for a TalentGraph Africa skill credential. SHA-256 anchored, append-only, no login required.",
      },
      {
        property: "og:title",
        content: "TalentGraph Africa Credential",
      },
      {
        property: "og:description",
        content: "Cryptographically signed, ISCO-08 mapped, publicly verifiable.",
      },
    ],
  }),
  loader: ({ context, params }) => {
    const id = sanitizeCredentialId(params.id);
    if (!id || id === "preview") return;
    void context.queryClient.prefetchQuery({
      queryKey: ["credential", id],
      queryFn: () => getCredentialById({ data: { id } }),
    });
  },
  component: CredentialVerifyPage,
});

function CredentialVerifyPage() {
  const { id: rawId } = Route.useParams();
  const id = sanitizeCredentialId(rawId);
  const isPreview = id === "preview";
  const canLookup = Boolean(id) && !isPreview;

  const credentialQ = useQuery({
    queryKey: ["credential", id || "invalid"],
    queryFn: () => getCredentialById({ data: { id } }),
    enabled: canLookup,
  });

  const state: VerificationState = isPreview
    ? { kind: "preview" }
    : deriveVerificationState({
        isPreview: false,
        isRevoked: credentialQ.data?.isRevoked ?? false,
        revokedAt: credentialQ.data?.revokedAt ?? null,
        revokedReason: credentialQ.data?.revokedReason ?? null,
      });

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-10 md:px-10">
        <PageTitle module="Public verifier" eyebrow="No login required">
          Credential verification
        </PageTitle>

        {isPreview ? (
          <PreviewCard />
        ) : !id ? (
          <NotFoundCard id={rawId} />
        ) : credentialQ.isLoading ? (
          <SkeletonCard />
        ) : !credentialQ.data ? (
          <NotFoundCard id={id} />
        ) : (
          <RealCredentialCard id={id} credential={credentialQ.data} state={state} />
        )}

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

/* -------------------------------------------------------------------------- */
/* States                                                                     */
/* -------------------------------------------------------------------------- */

function PreviewCard() {
  return (
    <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-bg-2 to-bg-1 p-6 shadow-[0_0_30px_-10px_oklch(0.770_0.140_75/0.4)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold text-gold">◈ TalentGraph Africa</span>
        <span className="inline-flex items-center gap-1 rounded border border-gold-glow bg-gold-soft px-2 py-0.5 font-mono text-[9px] font-bold text-gold">
          <ShieldCheck className="h-3 w-3" /> Preview
        </span>
      </div>
      <p className="font-display text-[20px] font-bold text-tx-0">Preview credential</p>
      <p className="mt-1 text-[12px] leading-relaxed text-tx-2">
        This is a non-issued preview shown from the Skills Engine. Generate a real, signed
        credential by signing in and adding three peer attestations — once accumulated trust weight
        reaches <strong className="text-tx-1">2.5</strong>, the skill is auto-verified and an anchor
        is published.
      </p>
      <div className="mt-4 flex items-end justify-between border-t border-border-soft pt-3">
        <p className="font-mono text-[9px] text-tx-2">
          Anchored · TalentGraph Cloud · SHA-256 + ECDSA
        </p>
        <div className="flex h-12 w-12 items-center justify-center rounded border border-border-strong bg-bg-3">
          <QrCode className="h-7 w-7 text-tx-1" />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="anim-fade-in rounded-2xl border border-border-soft bg-bg-3 p-6"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="h-3 w-32 rounded bg-bg-4" aria-hidden="true" />
        <span className="h-4 w-16 rounded bg-bg-4" aria-hidden="true" />
      </div>
      <div className="mb-2 h-5 w-2/3 rounded bg-bg-4" aria-hidden="true" />
      <div className="mb-1 h-3 w-1/2 rounded bg-bg-4" aria-hidden="true" />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="h-12 rounded bg-bg-4" aria-hidden="true" />
        <div className="h-12 rounded bg-bg-4" aria-hidden="true" />
      </div>
      <span className="sr-only">Looking up credential…</span>
    </div>
  );
}

function NotFoundCard({ id }: { id: string }) {
  return (
    <div className="rounded-2xl border border-coral/30 bg-coral-soft/30 p-6">
      <div className="mb-2 flex items-center gap-2">
        <ShieldX className="h-4 w-4 text-coral" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-coral">
          Not found
        </span>
      </div>
      <p className="font-display text-[18px] font-semibold text-tx-0">
        No credential anchor with id <code className="font-mono text-coral">{id}</code>
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-tx-2">
        Either the credential was never issued or the link is malformed. The TalentGraph credential
        anchor table is append-only — anchors are never deleted, only revoked, so this likely means
        a bad URL.
      </p>
    </div>
  );
}

function RealCredentialCard({
  id,
  credential,
  state,
}: {
  id: string;
  credential: NonNullable<Awaited<ReturnType<typeof getCredentialById>>>;
  state: VerificationState;
}) {
  const { payload } = credential;
  const verifyUrl =
    typeof window !== "undefined"
      ? publicVerifyUrl(id, window.location.origin)
      : publicVerifyUrl(id);
  const waUrl = whatsAppShareUrl(verifyUrl, payload.holder_name);

  const isRevoked = state.kind === "revoked";
  const headerTone = isRevoked
    ? "border-coral/40 shadow-[0_0_30px_-10px_oklch(0.720_0.180_22/0.4)]"
    : "border-gold/40 shadow-[0_0_30px_-10px_oklch(0.770_0.140_75/0.4)]";

  return (
    <div className={`rounded-2xl border bg-gradient-to-br from-bg-2 to-bg-1 p-6 ${headerTone}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold text-gold">◈ TalentGraph Africa</span>
        <StatusBadge state={state} />
      </div>

      <p className="font-display text-[22px] font-bold text-tx-0">
        {payload.holder_name ?? "Anonymous holder"}
      </p>
      {payload.location && <p className="mt-0.5 text-[11.5px] text-tx-1">{payload.location}</p>}

      {payload.skill_name && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Field label="Skill">{payload.skill_name}</Field>
          {payload.isco_code && (
            <Field label="ISCO-08">
              <span className="font-mono text-gold">{payload.isco_code}</span>
            </Field>
          )}
          {payload.proficiency_level !== undefined && (
            <Field label="Proficiency">
              <span className="font-mono">{payload.proficiency_level}/10</span>
            </Field>
          )}
          {payload.attestation_count !== undefined && (
            <Field label="Attestations">
              <span className="font-mono">
                {payload.attestation_count}
                {payload.attestation_weight_sum !== undefined &&
                  ` · trust ${payload.attestation_weight_sum.toFixed(2)}/2.5`}
              </span>
            </Field>
          )}
        </div>
      )}

      {state.kind === "revoked" && (
        <div className="mt-4 rounded-md border border-coral/40 bg-coral-soft/30 p-3 text-[11px] text-coral">
          <p className="flex items-center gap-1.5 font-semibold">
            <ShieldAlert className="h-3 w-3" />
            Revoked {state.revokedAt ? formatIssuedAt(state.revokedAt) : ""}
          </p>
          {state.reason && <p className="mt-1 text-tx-1">Reason: {state.reason}</p>}
        </div>
      )}

      <div className="mt-5 grid gap-3 border-t border-border-soft pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1">
          <p className="font-mono text-[9.5px] text-tx-2">
            <span className="text-tx-1">SHA-256</span> ·{" "}
            <code title={credential.payloadHash}>{shortHash(credential.payloadHash)}</code>
            <CopyButton value={credential.payloadHash} label="Copy hash" />
          </p>
          <p className="font-mono text-[9.5px] text-tx-2">
            <span className="text-tx-1">Signing key</span> · {credential.signingKeyId}
          </p>
          <p className="font-mono text-[9.5px] text-tx-2">
            <span className="text-tx-1">Anchored</span> ·{" "}
            {formatIssuedAt(payload.issued_at ?? credential.anchoredAt)}
          </p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded border border-border-strong bg-bg-3">
          <QrCode className="h-9 w-9 text-tx-1" />
        </div>
      </div>

      {!isRevoked && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-soft pt-4">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-[oklch(0.78_0.16_146)] px-3 py-1.5 text-[12px] font-semibold text-bg-0 transition hover:opacity-90"
          >
            <ExternalLink className="h-3 w-3" />
            Share via WhatsApp
          </a>
          <CopyButton value={verifyUrl} label="Copy verify link" prominent />
          {credential.skillIsVerified && (
            <span className="inline-flex items-center gap-1 rounded-full border border-teal/40 bg-teal-soft px-2.5 py-1 text-[10px] font-semibold text-teal">
              <ShieldCheck className="h-3 w-3" /> Skill still verified
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ state }: { state: VerificationState }) {
  if (state.kind === "preview") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-gold-glow bg-gold-soft px-2 py-0.5 font-mono text-[9px] font-bold text-gold">
        <ShieldCheck className="h-3 w-3" /> Preview
      </span>
    );
  }
  if (state.kind === "revoked") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-coral/40 bg-coral-soft px-2 py-0.5 font-mono text-[9px] font-bold text-coral">
        <ShieldAlert className="h-3 w-3" /> Revoked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded border border-teal/40 bg-teal-soft px-2 py-0.5 font-mono text-[9px] font-bold text-teal">
      <ShieldCheck className="h-3 w-3" /> Verified
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border-soft bg-bg-3 p-3">
      <p className="text-[9.5px] font-bold uppercase tracking-wider text-tx-2">{label}</p>
      <p className="mt-0.5 text-[12.5px] font-semibold text-tx-0">{children}</p>
    </div>
  );
}

function CopyButton({
  value,
  label,
  prominent = false,
}: {
  value: string;
  label: string;
  prominent?: boolean;
}) {
  async function copy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Clipboard not available");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={
        prominent
          ? "inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-bg-3 px-3 py-1.5 text-[12px] font-medium text-tx-0 transition hover:border-gold-glow hover:text-gold"
          : "ml-1 inline-flex items-center gap-0.5 rounded border border-border-soft bg-bg-3 px-1 py-0.5 text-[9px] text-tx-1 hover:border-gold-glow hover:text-gold"
      }
    >
      <Copy className={prominent ? "h-3 w-3" : "h-2.5 w-2.5"} />
      {prominent ? label : ""}
    </button>
  );
}
