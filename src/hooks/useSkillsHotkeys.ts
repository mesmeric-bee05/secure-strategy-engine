import { useEffect, useRef } from "react";

export interface UseSkillsHotkeysOptions {
  onExport: () => void;
  onImport: () => void;
  onPrevPersona: () => void;
  onNextPersona: () => void;
  /** When false, listeners are not attached. Default true. */
  enabled?: boolean;
}

/**
 * Page-level keyboard shortcuts for /skills.
 *
 * - Ctrl/Cmd+S → trigger export (preventing the browser save dialog)
 * - Ctrl/Cmd+I → open the import file picker
 * - Alt+ArrowLeft / Alt+ArrowRight → cycle personas
 *
 * Alt+arrow is suppressed when focus is inside an editable text field so it
 * doesn't fight the OS-level "jump by word" behaviour. Ctrl/Cmd+S/I always
 * fire because they have no useful default in this page context.
 */
export function useSkillsHotkeys({
  onExport,
  onImport,
  onPrevPersona,
  onNextPersona,
  enabled = true,
}: UseSkillsHotkeysOptions) {
  // Stable handler refs so consumers don't have to memoize.
  const handlersRef = useRef({
    onExport,
    onImport,
    onPrevPersona,
    onNextPersona,
  });
  handlersRef.current = {
    onExport,
    onImport,
    onPrevPersona,
    onNextPersona,
  };

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    function isTextField(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && !e.altKey && !e.shiftKey && key === "s") {
        e.preventDefault();
        handlersRef.current.onExport();
        return;
      }
      if (mod && !e.altKey && !e.shiftKey && key === "i") {
        e.preventDefault();
        handlersRef.current.onImport();
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        // Don't hijack caret-jump-by-word inside text fields.
        if (isTextField(e.target)) return;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          handlersRef.current.onNextPersona();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          handlersRef.current.onPrevPersona();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
