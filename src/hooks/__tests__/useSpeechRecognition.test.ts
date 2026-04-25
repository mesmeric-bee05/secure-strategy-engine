import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  getSpeechRecognitionCtor,
  useSpeechRecognition,
  type SpeechRecognitionInstance,
} from "@/hooks/useSpeechRecognition";

interface FakeWindow {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

class FakeRecognition implements SpeechRecognitionInstance {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: SpeechRecognitionInstance["onresult"] = null;
  onend: SpeechRecognitionInstance["onend"] = null;
  onerror: SpeechRecognitionInstance["onerror"] = null;
  started = false;
  start() {
    this.started = true;
  }
  stop() {
    this.started = false;
  }
}

describe("useSpeechRecognition / getSpeechRecognitionCtor", () => {
  const w = window as unknown as FakeWindow;
  beforeEach(() => {
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  });
  afterEach(() => {
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  });

  it("returns null when neither constructor is on window", () => {
    expect(getSpeechRecognitionCtor()).toBeNull();
  });

  it("prefers standard SpeechRecognition over webkit prefix", () => {
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
    expect(getSpeechRecognitionCtor()).toBe(FakeRecognition);
  });

  it("falls back to webkitSpeechRecognition when standard missing", () => {
    w.webkitSpeechRecognition = FakeRecognition;
    expect(getSpeechRecognitionCtor()).toBe(FakeRecognition);
  });

  it("hook reports unsupported and toggle is a no-op when ctor missing", () => {
    const onText = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onText }));
    expect(result.current.supported).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.listening).toBe(false);
    expect(result.current.error).toMatch(/not supported/i);
    expect(onText).not.toHaveBeenCalled();
  });

  it("hook starts and stops a recognition instance when supported", () => {
    w.SpeechRecognition = FakeRecognition;
    const onText = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onText, lang: "sw-KE" }));
    expect(result.current.supported).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.listening).toBe(true);
    expect(result.current.error).toBeNull();

    act(() => result.current.toggle());
    expect(result.current.listening).toBe(false);
  });
});
