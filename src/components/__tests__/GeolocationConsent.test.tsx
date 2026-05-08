import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { GeolocationConsent } from "@/components/GeolocationConsent";

describe("GeolocationConsent", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("does not auto-prompt the browser on mount", () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    render(<GeolocationConsent onLocation={() => {}} />);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("calls navigator.geolocation only after explicit click and forwards coords", () => {
    const onLocation = vi.fn();
    const getCurrentPosition = vi.fn((success) =>
      success({ coords: { latitude: -1.29, longitude: 36.82 } }),
    );
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<GeolocationConsent onLocation={onLocation} />);
    const btn = screen.getByRole("button", { name: /use my location/i });
    fireEvent.click(btn);

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(onLocation).toHaveBeenCalledWith({ lat: -1.29, lng: 36.82 });
    expect(window.localStorage.getItem("tg.geo.consent.v1")).toBe("granted");
  });

  it("declining persists the choice and exposes a revoke control", () => {
    const onDecline = vi.fn();
    render(<GeolocationConsent onLocation={() => {}} onDecline={onDecline} />);
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(onDecline).toHaveBeenCalled();
    expect(window.localStorage.getItem("tg.geo.consent.v1")).toBe("denied");
    expect(screen.getByText(/declined/i)).toBeTruthy();
  });
});
