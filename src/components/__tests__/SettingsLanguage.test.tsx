/**
 * Verifies that switching language on the /settings surface re-renders
 * PasskeyManager strings AND persists the choice to localStorage.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import i18n from "@/lib/i18n";
import { I18nProvider } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// Mock the passkey server fns + browser webauthn so PasskeyManager renders
// without trying to hit the backend.
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: any) => fn }));
vi.mock("@/lib/passkeys/passkeys.functions", () => ({
  startPasskeyRegistration: vi.fn(),
  finishPasskeyRegistration: vi.fn(),
  listPasskeys: vi.fn().mockResolvedValue({ passkeys: [] }),
  deletePasskey: vi.fn(),
  startPasskeyAuthentication: vi.fn(),
  finishPasskeyAuthentication: vi.fn(),
}));
vi.mock("@simplewebauthn/browser", () => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PasskeyManager } from "@/components/PasskeyManager";

function SettingsLike() {
  const { t } = useTranslation();
  return (
    <I18nProvider>
      <div>
        <LanguageSwitcher />
        <h1 data-testid="heading">{t("nav.settings")}</h1>
        <PasskeyManager />
      </div>
    </I18nProvider>
  );
}

beforeEach(async () => {
  window.localStorage.clear();
  await i18n.changeLanguage("en");
});

describe("Settings page language switching", () => {
  it("switching to Hausa re-renders all surface strings and persists", async () => {
    render(<SettingsLike />);
    expect(screen.getByTestId("heading").textContent).toBe("Settings");

    const select = screen.getByLabelText(/Language/i) as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: "ha" } });
    });

    await waitFor(() => {
      expect(i18n.resolvedLanguage).toBe("ha");
    });
    // Heading translated
    expect(screen.getByTestId("heading").textContent).not.toBe("Settings");
    // PasskeyManager recovery copy translated (must-translate key)
    const recoveryEn = "Lost your device? Use email + password to recover access.";
    expect(screen.queryByText(recoveryEn)).toBeNull();
    // Persisted
    expect(window.localStorage.getItem("lng")).toBe("ha");
  });

  it("switching to Swahili then French rotates the visible strings (no stale cache)", async () => {
    render(<SettingsLike />);
    const select = screen.getByLabelText(/Language/i) as HTMLSelectElement;

    await act(async () => {
      fireEvent.change(select, { target: { value: "sw" } });
    });
    await waitFor(() => expect(i18n.resolvedLanguage).toBe("sw"));
    const swHeading = screen.getByTestId("heading").textContent;

    await act(async () => {
      fireEvent.change(select, { target: { value: "fr" } });
    });
    await waitFor(() => expect(i18n.resolvedLanguage).toBe("fr"));
    const frHeading = screen.getByTestId("heading").textContent;

    expect(frHeading).not.toBe(swHeading);
    expect(frHeading).toBe("Paramètres");
  });
});
