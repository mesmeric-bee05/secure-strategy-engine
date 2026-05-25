import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PasskeyManager } from "@/components/PasskeyManager";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · TalentGraph Africa" },
      { name: "description", content: "Manage passkeys, language and account security." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-bg-0 px-6 py-12 text-tx-0">
      <p className="eyebrow text-gold">{t("nav.settings")}</p>
      <h1 className="mb-6 font-display text-3xl">{t("nav.settings")}</h1>
      <PasskeyManager />
    </main>
  );
}
