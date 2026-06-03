/**
 * UI flow tests for PasskeyManager + PasskeySignInButton.
 *
 * Mocks the server-fn module and @simplewebauthn/browser so we test the
 * component wiring (button -> server call -> browser webauthn -> server
 * call -> UI update) without a real authenticator.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
// Initialise i18n so the component renders translated strings, not raw keys.
import "@/lib/i18n";

// Mocks must be declared before importing the component.
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: any) => fn,
}));

const mockStartReg = vi.fn();
const mockFinishReg = vi.fn();
const mockList = vi.fn();
const mockDel = vi.fn();
const mockStartAuth = vi.fn();
const mockFinishAuth = vi.fn();
vi.mock("@/lib/passkeys/passkeys.functions", () => ({
  startPasskeyRegistration: (...a: unknown[]) => mockStartReg(...a),
  finishPasskeyRegistration: (...a: unknown[]) => mockFinishReg(...a),
  listPasskeys: (...a: unknown[]) => mockList(...a),
  deletePasskey: (...a: unknown[]) => mockDel(...a),
  startPasskeyAuthentication: (...a: unknown[]) => mockStartAuth(...a),
  finishPasskeyAuthentication: (...a: unknown[]) => mockFinishAuth(...a),
}));

const mockBrowserStartReg = vi.fn();
const mockBrowserStartAuth = vi.fn();
vi.mock("@simplewebauthn/browser", () => ({
  startRegistration: (...a: unknown[]) => mockBrowserStartReg(...a),
  startAuthentication: (...a: unknown[]) => mockBrowserStartAuth(...a),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

import { PasskeyManager, PasskeySignInButton } from "@/components/PasskeyManager";

beforeEach(() => {
  [mockStartReg, mockFinishReg, mockList, mockDel, mockStartAuth, mockFinishAuth,
   mockBrowserStartReg, mockBrowserStartAuth, toastSuccess, toastError].forEach((m) => m.mockReset());
  mockList.mockResolvedValue({ passkeys: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PasskeyManager", () => {
  it("shows the 'no passkeys' empty state and recovery copy", async () => {
    render(<PasskeyManager />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(screen.getByText(/No passkeys registered yet/i)).toBeTruthy();
    // recovery + fallback copy must remain visible
    expect(screen.getByText(/Lost your device/i)).toBeTruthy();
  });

  it("registration happy path calls all 3 steps and refreshes the list", async () => {
    mockStartReg.mockResolvedValue({ challenge: "ch" });
    mockBrowserStartReg.mockResolvedValue({ id: "att" });
    mockFinishReg.mockResolvedValue({ ok: true });
    // After registration, list returns a new row
    mockList
      .mockResolvedValueOnce({ passkeys: [] })
      .mockResolvedValueOnce({
        passkeys: [
          { id: "p1", device_label: "Test Browser", backed_up: false,
            last_used_at: null, created_at: new Date().toISOString() },
        ],
      });

    render(<PasskeyManager />);
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /Add a passkey/i }));

    await waitFor(() => expect(mockFinishReg).toHaveBeenCalledTimes(1));
    expect(mockStartReg).toHaveBeenCalledTimes(1);
    expect(mockBrowserStartReg).toHaveBeenCalledWith({ optionsJSON: { challenge: "ch" } });
    expect(toastSuccess).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText(/Test Browser/)).toBeTruthy(),
    );
  });

  it("registration error surfaces a toast and does not add a row", async () => {
    mockStartReg.mockResolvedValue({ challenge: "ch" });
    mockBrowserStartReg.mockRejectedValue(new Error("User cancelled"));

    render(<PasskeyManager />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Add a passkey/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("User cancelled"));
    expect(mockFinishReg).not.toHaveBeenCalled();
  });

  it("delete removes a passkey", async () => {
    mockList
      .mockResolvedValueOnce({
        passkeys: [{ id: "p1", device_label: "Old", backed_up: false,
                     last_used_at: null, created_at: new Date().toISOString() }],
      })
      .mockResolvedValueOnce({ passkeys: [] });
    mockDel.mockResolvedValue({ ok: true });

    render(<PasskeyManager />);
    await waitFor(() => expect(screen.getByText("Old")).toBeTruthy());

    fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);
    await waitFor(() => expect(mockDel).toHaveBeenCalledWith({ data: { id: "p1" } }));
    await waitFor(() =>
      expect(screen.getByText(/No passkeys registered yet/i)).toBeTruthy(),
    );
  });
});

describe("PasskeySignInButton", () => {
  beforeEach(() => {
    // jsdom forbids assignment to window.location; replace it with a writable stub.
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { href: "https://app.example.com/" },
    });
  });

  it("happy path redirects to the action link", async () => {
    mockStartAuth.mockResolvedValue({ challenge: "auth-ch" });
    mockBrowserStartAuth.mockResolvedValue({ id: "cred" });
    mockFinishAuth.mockResolvedValue({
      ok: true,
      actionLink: "https://app.example.com/auth#token=xyz",
    });

    render(<PasskeySignInButton />);
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "u@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign in with passkey/i }));

    await waitFor(() =>
      expect(window.location.href).toBe("https://app.example.com/auth#token=xyz"),
    );
    expect(mockStartAuth).toHaveBeenCalled();
    expect(mockBrowserStartAuth).toHaveBeenCalledWith({
      optionsJSON: { challenge: "auth-ch" },
    });
  });

  it("error path surfaces a toast and does not redirect", async () => {
    mockStartAuth.mockRejectedValue(new Error("Unknown passkey."));

    render(<PasskeySignInButton />);
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "u@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign in with passkey/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Unknown passkey."));
    expect(window.location.href).toBe("https://app.example.com/");
  });

  it("renders the fallback / recovery copy so users always have an out", () => {
    render(<PasskeySignInButton />);
    expect(screen.getByText(/Use password instead/i)).toBeTruthy();
    expect(screen.getByText(/Email me a magic link/i)).toBeTruthy();
  });
});
