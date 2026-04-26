import { useEffect, useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/* Minimal typed surface for the Web Speech API (not in lib.dom by default).  */
/* -------------------------------------------------------------------------- */

export interface SpeechRecognitionResultLite {
  0: { transcript: string };
}

export interface SpeechRecognitionEventLite {
  results: ArrayLike<SpeechRecognitionResultLite>;
}

export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLite) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

/** Safely resolve a SpeechRecognition constructor without leaking `any`. */
export function getSpeechRecognitionCtor(
  win: Window | undefined = typeof window !== "undefined" ? window : undefined,
): SpeechRecognitionCtor | null {
  if (!win) return null;
  const w = win as unknown as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechRecognitionOptions {
  onText: (transcript: string) => void;
  lang?: string;
  continuous?: boolean;
}

export interface UseSpeechRecognitionReturn {
  supported: boolean;
  listening: boolean;
  toggle: () => void;
  error: string | null;
}

export function useSpeechRecognition({
  onText,
  lang = "en-US",
  continuous = true,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const langRef = useRef(lang);

  useEffect(() => {
    langRef.current = lang;
    // If currently listening, restart with the new language.
    if (listening && recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    setSupported(!!getSpeechRecognitionCtor());
  }, []);

  function toggle() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Voice capture is not supported in this browser.");
      return;
    }
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {
        /* noop */
      }
      setListening(false);
      return;
    }
    try {
      const r = new Ctor();
      r.continuous = continuous;
      r.interimResults = false;
      r.lang = langRef.current;
      r.onresult = (e) => {
        const last = e.results[e.results.length - 1];
        if (last) onText(last[0].transcript);
      };
      r.onend = () => setListening(false);
      r.onerror = () => {
        setError("Voice capture failed. Try typing instead.");
        setListening(false);
      };
      r.start();
      recRef.current = r;
      setListening(true);
      setError(null);
    } catch {
      setError("Could not start voice capture.");
      setListening(false);
    }
  }

  return { supported, listening, toggle, error };
}
