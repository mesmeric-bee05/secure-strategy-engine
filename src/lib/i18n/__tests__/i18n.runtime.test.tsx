import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { I18nProvider } from "@/components/I18nProvider";

function Probe() {
  const { t } = useTranslation();
  return (
    <div>
      <span data-testid="settings">{t("nav.settings")}</span>
      <span data-testid="prompt">{t("ai.promptLocale", { language: "Swahili" })}</span>
    </div>
  );
}

const expected: Record<string, string> = {
  en: "Settings",
  sw: "Mipangilio",
  fr: "Paramètres",
  ha: "Saituna",
};

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("i18n runtime", () => {
  it("renders translated strings for each supported language", async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    for (const [code, label] of Object.entries(expected)) {
      await act(async () => {
        await i18n.changeLanguage(code);
      });
      expect(screen.getByTestId("settings").textContent).toBe(label);
    }
  });

  it("syncs <html lang> via I18nProvider", async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    await act(async () => {
      await i18n.changeLanguage("fr");
    });
    expect(document.documentElement.lang).toBe("fr");
    await act(async () => {
      await i18n.changeLanguage("ha");
    });
    expect(document.documentElement.lang).toBe("ha");
  });

  it("falls back to English for an unknown language", async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    await act(async () => {
      await i18n.changeLanguage("xx-unknown");
    });
    expect(screen.getByTestId("settings").textContent).toBe("Settings");
  });

  it("interpolates {{language}} placeholder", async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(screen.getByTestId("prompt").textContent).toContain("Swahili");
  });
});
