import { useEffect, type ReactNode } from "react";
import i18n from "@/lib/i18n";

/**
 * Initialises i18next on the client and reflects the active language onto
 * <html lang>. Wrapped in a component so SSR doesn't try to touch
 * localStorage / navigator before hydration.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const apply = () => {
      if (typeof document !== "undefined") {
        document.documentElement.lang = i18n.resolvedLanguage ?? "en";
      }
    };
    apply();
    i18n.on("languageChanged", apply);
    return () => {
      i18n.off("languageChanged", apply);
    };
  }, []);
  return <>{children}</>;
}
