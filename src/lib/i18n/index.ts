import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import sw from "./locales/sw.json";
import fr from "./locales/fr.json";
import ha from "./locales/ha.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "sw", label: "Kiswahili", flag: "🇰🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ha", label: "Hausa", flag: "🇳🇬" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

if (!i18n.isInitialized) {
  const chain = typeof window !== "undefined" ? i18n.use(LanguageDetector) : i18n;
  void chain.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      sw: { translation: sw },
      fr: { translation: fr },
      ha: { translation: ha },
    },
    lng: typeof window === "undefined" ? "en" : undefined,
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ["querystring", "cookie", "localStorage", "navigator"],
      lookupQuerystring: "lng",
      lookupCookie: "lng",
      lookupLocalStorage: "lng",
      caches: ["cookie", "localStorage"],
    },
    react: { useSuspense: false },
  });
}

export default i18n;
