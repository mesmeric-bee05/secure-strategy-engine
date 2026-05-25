/**
 * WebAuthn passkey server functions.
 *
 * Registration: requires an authenticated user (link a passkey to existing account).
 * Authentication: identifier-first (email). Issues a challenge bound to the email,
 * verifies signature, then mints a Supabase session for that user.
 *
 * Fallback: email + password sign-in (Supabase default) and magic link continue
 * to work — passkeys are additive, never the only factor.
 * Recovery: a user with a verified email can always reset via Supabase's
 * resetPasswordForEmail flow if all passkeys are lost.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function rpConfig(origin: string) {
  const url = new URL(origin);
  return { rpID: url.hostname, rpName: "TalentGraph Africa", origin };
}

const ORIGIN_RE = /^https?:\/\/[a-z0-9.\-:]+$/i;

export const startPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ origin: z.string().regex(ORIGIN_RE) }).parse(i))
  .handler(async ({ context, data }) => {
    const { rpID, rpName } = rpConfig(data.origin);
    const { data: existing } = await supabaseAdmin
      .from("passkeys")
      .select("credential_id, transports")
      .eq("user_id", context.userId);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(context.userId),
      userName: context.claims?.email ?? context.userId,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: (existing ?? []).map((c) => ({
        id: c.credential_id,
        transports: (c.transports ?? []) as AuthenticatorTransport[],
      })),
    });

    await supabaseAdmin.from("webauthn_challenges").insert({
      user_id: context.userId,
      challenge: options.challenge,
      challenge_type: "registration",
    });

    return options;
  });

export const finishPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        origin: z.string().regex(ORIGIN_RE),
        deviceLabel: z.string().max(80).optional(),
        response: z.any(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { rpID, origin } = rpConfig(data.origin);

    const { data: challengeRow } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("user_id", context.userId)
      .eq("challenge_type", "registration")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challengeRow || new Date(challengeRow.expires_at) < new Date()) {
      throw new Error("Challenge expired. Please retry.");
    }

    const verification = await verifyRegistrationResponse({
      response: data.response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Passkey registration failed verification.");
    }

    const { credential, credentialBackedUp } = verification.registrationInfo;

    await supabaseAdmin.from("passkeys").insert({
      user_id: context.userId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString("base64"),
      counter: Number(credential.counter ?? 0),
      transports: credential.transports ?? [],
      device_label: data.deviceLabel ?? null,
      backed_up: !!credentialBackedUp,
    });

    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", challengeRow.id);

    return { ok: true };
  });

export const listPasskeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("passkeys")
      .select("id, device_label, backed_up, last_used_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return { passkeys: data ?? [] };
  });

export const deletePasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await supabaseAdmin
      .from("passkeys")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const startPasskeyAuthentication = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        origin: z.string().regex(ORIGIN_RE),
        email: z.string().email().max(200),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { rpID } = rpConfig(data.origin);
    const { data: userRow } = await supabaseAdmin
      .schema("auth" as never)
      .from("users" as never)
      .select("id" as never)
      .eq("email" as never, data.email)
      .maybeSingle();

    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = [];
    if (userRow && (userRow as { id?: string }).id) {
      const { data: pks } = await supabaseAdmin
        .from("passkeys")
        .select("credential_id, transports")
        .eq("user_id", (userRow as { id: string }).id);
      allowCredentials = (pks ?? []).map((p) => ({
        id: p.credential_id,
        transports: (p.transports ?? []) as AuthenticatorTransport[],
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      allowCredentials,
    });

    await supabaseAdmin.from("webauthn_challenges").insert({
      email: data.email,
      challenge: options.challenge,
      challenge_type: "authentication",
    });

    return options;
  });

export const finishPasskeyAuthentication = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        origin: z.string().regex(ORIGIN_RE),
        email: z.string().email().max(200),
        response: z.any(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { rpID, origin } = rpConfig(data.origin);

    const { data: challengeRow } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("email", data.email)
      .eq("challenge_type", "authentication")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challengeRow || new Date(challengeRow.expires_at) < new Date()) {
      throw new Error("Challenge expired.");
    }

    const credId = data.response?.id as string | undefined;
    if (!credId) throw new Error("Missing credential id.");

    const { data: pk } = await supabaseAdmin
      .from("passkeys")
      .select("id, user_id, credential_id, public_key, counter, transports")
      .eq("credential_id", credId)
      .maybeSingle();
    if (!pk) throw new Error("Unknown passkey.");

    const verification = await verifyAuthenticationResponse({
      response: data.response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: pk.credential_id,
        publicKey: new Uint8Array(Buffer.from(pk.public_key, "base64")),
        counter: Number(pk.counter ?? 0),
        transports: (pk.transports ?? []) as AuthenticatorTransport[],
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      throw new Error("Passkey signature did not verify.");
    }

    await supabaseAdmin
      .from("passkeys")
      .update({
        counter: Number(verification.authenticationInfo.newCounter ?? 0),
        last_used_at: new Date().toISOString(),
      })
      .eq("id", pk.id);

    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", challengeRow.id);

    // Mint a one-time session via magic link (long enough TTL for the browser
    // to redirect). Supabase requires email-based session minting; we never
    // hand out service-role tokens to the client.
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
    });
    if (linkErr || !link?.properties?.action_link) {
      throw new Error("Could not mint session after passkey verification.");
    }

    return { ok: true, actionLink: link.properties.action_link };
  });
