import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import {
  startPasskeyRegistration,
  finishPasskeyRegistration,
  listPasskeys,
  deletePasskey,
  startPasskeyAuthentication,
  finishPasskeyAuthentication,
} from "@/lib/passkeys/passkeys.functions";
import { toast } from "sonner";

type PasskeyRow = {
  id: string;
  device_label: string | null;
  backed_up: boolean;
  last_used_at: string | null;
  created_at: string;
};

export function PasskeyManager() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PasskeyRow[]>([]);
  const [busy, setBusy] = useState(false);
  const list = useServerFn(listPasskeys);
  const startReg = useServerFn(startPasskeyRegistration);
  const finishReg = useServerFn(finishPasskeyRegistration);
  const del = useServerFn(deletePasskey);

  const refresh = async () => {
    try {
      const r = await list();
      setItems(r.passkeys as PasskeyRow[]);
    } catch (e) {
      console.warn("Failed to list passkeys", e);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const register = async () => {
    setBusy(true);
    try {
      const options = await startReg({ data: { origin: window.location.origin } });
      const attResp = await startRegistration({ optionsJSON: options });
      await finishReg({
        data: {
          origin: window.location.origin,
          response: attResp,
          deviceLabel: navigator.userAgent.slice(0, 60),
        },
      });
      toast.success(t("passkeys.registered"));
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await del({ data: { id } });
      toast.success(t("passkeys.removed"));
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <section className="rounded-lg border border-white/10 bg-bg-1 p-4">
      <h2 className="font-display text-lg text-tx-0">{t("passkeys.title")}</h2>
      <p className="mt-1 text-sm text-tx-1">{t("passkeys.subtitle")}</p>
      <button
        onClick={register}
        disabled={busy}
        className="mt-3 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-bg-0 disabled:opacity-50"
      >
        {t("passkeys.register")}
      </button>
      <ul className="mt-4 space-y-2">
        {items.length === 0 && (
          <li className="text-xs text-tx-1">{t("passkeys.noPasskeys")}</li>
        )}
        {items.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded border border-white/5 bg-bg-0/40 px-3 py-2 text-xs text-tx-1"
          >
            <span>
              {p.device_label ?? "Unknown device"}
              {p.backed_up && " · ☁️"}
            </span>
            <button
              onClick={() => remove(p.id)}
              className="text-red-400 hover:underline"
            >
              {t("common.delete")}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-tx-1">{t("passkeys.recovery")}</p>
    </section>
  );
}

export function PasskeySignInButton() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const start = useServerFn(startPasskeyAuthentication);
  const finish = useServerFn(finishPasskeyAuthentication);

  const signIn = async () => {
    if (!email) return;
    setBusy(true);
    try {
      const options = await start({
        data: { origin: window.location.origin, email },
      });
      const resp = await startAuthentication({ optionsJSON: options });
      const out = await finish({
        data: { origin: window.location.origin, email, response: resp },
      });
      if (out.actionLink) window.location.href = out.actionLink;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="rounded-md border border-white/10 bg-bg-1 px-3 py-2 text-sm text-tx-0"
      />
      <button
        onClick={signIn}
        disabled={busy || !email}
        className="rounded-md bg-gold px-3 py-2 text-sm font-semibold text-bg-0 disabled:opacity-50"
      >
        🔑 {t("passkeys.signInWithPasskey")}
      </button>
      <div className="text-[11px] text-tx-1">
        {t("passkeys.fallbackPassword")} · {t("passkeys.fallbackMagicLink")}
      </div>
    </div>
  );
}
