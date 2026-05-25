import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? "en") as LanguageCode;

  return (
    <label className={`inline-flex items-center gap-2 text-xs text-tx-1 ${className}`}>
      <span className="sr-only">{t("common.language")}</span>
      <span aria-hidden="true">🌐</span>
      <select
        aria-label={t("common.language")}
        value={current}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        className="rounded-md border border-white/10 bg-bg-1 px-2 py-1 text-xs text-tx-0 focus:outline-none focus:ring-2 focus:ring-gold"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
