import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("LanguageSwitcher", () => {
  it("renders an option for every supported language", () => {
    render(<LanguageSwitcher />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const codes = Array.from(select.options).map((o) => o.value);
    expect(codes.sort()).toEqual(SUPPORTED_LANGUAGES.map((l) => l.code).sort());
  });

  it("changes i18n language when a different option is selected", async () => {
    render(<LanguageSwitcher />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "sw" } });
    // changeLanguage is async; wait a tick
    await new Promise((r) => setTimeout(r, 0));
    expect(i18n.language.startsWith("sw")).toBe(true);

    fireEvent.change(select, { target: { value: "fr" } });
    await new Promise((r) => setTimeout(r, 0));
    expect(i18n.language.startsWith("fr")).toBe(true);
  });
});
