import { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";

import type { LatLngT } from "@/lib/geo";

const CONSENT_KEY = "tg.geo.consent.v1";

type Consent = "granted" | "denied" | "ask";

function readConsent(): Consent {
  if (typeof window === "undefined") return "ask";
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    if (v === "granted" || v === "denied") return v;
  } catch {
    /* ignore */
  }
  return "ask";
}

export interface GeolocationConsentProps {
  onLocation: (loc: LatLngT) => void;
  onDecline?: () => void;
}

/**
 * Privacy-first geolocation gate.
 * - Never auto-prompts the browser.
 * - Only after explicit user click does it call navigator.geolocation.
 * - Consent (or refusal) is remembered in localStorage and revocable.
 */
export function GeolocationConsent({ onLocation, onDecline }: GeolocationConsentProps) {
  const [consent, setConsent] = useState<Consent>("ask");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
  }, []);

  function persist(next: Consent) {
    try {
      window.localStorage.setItem(CONSENT_KEY, next);
    } catch {
      /* ignore */
    }
    setConsent(next);
  }

  async function requestLocation() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation isn't available in this browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        persist("granted");
        onLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setBusy(false);
        setError(err.message || "Couldn't read your location.");
        persist("denied");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  function decline() {
    persist("denied");
    onDecline?.();
  }

  function reset() {
    persist("ask");
    setError(null);
  }

  if (consent === "granted") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-teal/30 bg-teal-soft px-3 py-2 text-[11px] text-teal">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3 w-3" aria-hidden="true" /> Using your approximate location
        </span>
        <button type="button" onClick={reset} className="underline hover:opacity-80">
          Revoke
        </button>
      </div>
    );
  }

  if (consent === "denied") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border-soft bg-bg-3 px-3 py-2 text-[11px] text-tx-2">
        <span>Location access declined. Showing all opportunities.</span>
        <button type="button" onClick={reset} className="underline hover:text-tx-0">
          Change
        </button>
      </div>
    );
  }

  return (
    <section
      role="region"
      aria-label="Use my location"
      className="rounded-lg border border-border-soft bg-bg-3 p-3"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold">
          <MapPin className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-tx-0">Show opportunities near you?</p>
          <p className="mt-0.5 text-[11px] text-tx-2">
            Your coordinates stay on this device — we filter the map locally and never send them to
            our servers.
          </p>
          {error && (
            <p role="alert" className="mt-1 text-[10.5px] text-coral">
              {error}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={requestLocation}
              disabled={busy}
              className="rounded-md bg-gold px-3 py-1 text-[11px] font-semibold text-bg-0 transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Locating…" : "Use my location"}
            </button>
            <button
              type="button"
              onClick={decline}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-2 px-3 py-1 text-[11px] text-tx-1 hover:bg-bg-4"
            >
              <X className="h-3 w-3" aria-hidden="true" /> Not now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
