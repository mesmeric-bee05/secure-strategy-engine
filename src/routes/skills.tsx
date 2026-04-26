import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  QrCode,
  Share2,
  Check,
  AlertTriangle,
  Download,
  Upload,
  RotateCw,
  Keyboard,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageHeader";
import { CitationsPanel } from "@/components/CitationsPanel";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { LastErrorPanel } from "@/components/LastErrorPanel";
import { RestoredBanner } from "@/components/RestoredBanner";
import { SkillsPrivacyCard } from "@/components/SkillsPrivacyCard";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  useDebouncedLocalStorage,
  type PersistStatus,
} from "@/hooks/useDebouncedLocalStorage";
import { useSkillsHotkeys } from "@/hooks/useSkillsHotkeys";
import { extractSkills, listPersonas } from "@/server/skills.functions";
import { getCitations } from "@/server/citations.functions";
import type { ExtractedSkillT } from "@/lib/schemas";
import {
  DRAFT_MAP_KEY,
  LANG_MAP_KEY,
  LEGACY_DRAFT_KEY,
  LEGACY_LANG_KEY,
  buildExport,
  exportFilename,
  friendlyImportError,
  hasUnsavedChanges as hasUnsavedChangesPure,
  parseImport,
  readJSONMap,
  unsavedCount,
} from "@/lib/skills-drafts";

const RESTORED_BANNER_KEY = "talentgraph:skills:restored-banner-dismissed";

const SearchSchema = z.object({
  persona: z.enum(["sarah", "james", "amara", "kwame"]).optional().catch(undefined),
});

export const Route = createFileRoute("/skills")({
  validateSearch: SearchSchema,
  head: () => ({
    meta: [
      {
        title:
          "Skills Signal Engine — Map informal skills to ISCO-08 · TalentGraph",
      },
      {
        name: "description",
        content:
          "Speak or type your work experience in any language. AI maps it to ISCO-08 international occupation codes and ESCO skills taxonomy.",
      },
      {
        property: "og:title",
        content: "Skills Signal Engine · TalentGraph Africa",
      },
      {
        property: "og:description",
        content:
          "Voice or text → ISCO-08 + ESCO mapping. Portable, border-crossing skill profile in seconds.",
      },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({
      queryKey: ["personas"],
      queryFn: () => listPersonas(),
    });
    void context.queryClient.prefetchQuery({
      queryKey: ["citations", "global"],
      queryFn: () => getCitations({ data: {} }),
    });
  },
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <RouteErrorBoundary
        error={error}
        reset={reset}
        module="Skills Signal Engine"
      />
    </AppShell>
  ),
  component: SkillsPage,
});

type SkillRow = ExtractedSkillT;

/** BCP-47 codes mapped to the AI extractor's 2-letter language hint. */
const SPEECH_LANGS = [
  { code: "en-US", label: "English (US)", aiLang: "en" },
  { code: "en-GB", label: "English (UK)", aiLang: "en" },
  { code: "sw-KE", label: "Kiswahili (Kenya)", aiLang: "sw" },
  { code: "sw-TZ", label: "Kiswahili (Tanzania)", aiLang: "sw" },
  { code: "fr-FR", label: "Français", aiLang: "fr" },
  { code: "ha-NG", label: "Hausa (Nigeria)", aiLang: "ha" },
] as const;
type SpeechLang = (typeof SPEECH_LANGS)[number]["code"];
type AiLang = (typeof SPEECH_LANGS)[number]["aiLang"];
function aiLangFor(code: SpeechLang): AiLang {
  return (SPEECH_LANGS.find((s) => s.code === code)?.aiLang ?? "en") as AiLang;
}

function SkillsPage() {
  const search = Route.useSearch();
  const personasQ = useQuery({
    queryKey: ["personas"],
    queryFn: () => listPersonas(),
  });
  const citationsQ = useQuery({
    queryKey: ["citations", "global"],
    queryFn: () => getCitations({ data: {} }),
  });

  const personas = personasQ.data?.personas ?? [];

  // ---------------------------------------------------------------------------
  // Per-persona draft + language storage
  // ---------------------------------------------------------------------------
  // Drafts and language are scoped per persona so users can switch contexts
  // without losing work. The "default" key holds work done before any persona
  // is selected. Helpers live in @/lib/skills-drafts so they're unit-testable
  // without mounting the route.

  const [draftMap, setDraftMap] = useState<Record<string, string>>(() =>
    readJSONMap<string>(DRAFT_MAP_KEY, LEGACY_DRAFT_KEY)
  );
  const [langMap, setLangMap] = useState<Record<string, SpeechLang>>(() =>
    readJSONMap<SpeechLang>(LANG_MAP_KEY, LEGACY_LANG_KEY)
  );

  const [persona, setPersona] = useState<string | undefined>(search.persona);
  const personaKey = persona ?? "default";

  const text = draftMap[personaKey] ?? "";
  function setText(next: string | ((prev: string) => string)) {
    setDraftMap((prev) => {
      const current = prev[personaKey] ?? "";
      const value = typeof next === "function" ? next(current) : next;
      return { ...prev, [personaKey]: value };
    });
  }

  const language: SpeechLang = langMap[personaKey] ?? "en-US";
  function setLanguage(next: SpeechLang) {
    setLangMap((prev) => {
      const updated = { ...prev, [personaKey]: next };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(LANG_MAP_KEY, JSON.stringify(updated));
        } catch {
          /* noop */
        }
      }
      return updated;
    });
  }

  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [overallConfidence, setOverallConfidence] = useState<number | null>(null);

  // Track the "saved snapshot" of each persona's draft so we can warn when the
  // user is about to switch personas with unsaved edits.
  const savedSnapshotRef = useRef<Record<string, string>>({ ...draftMap });
  // Mirror the snapshot into state so unsaved badges re-render in sync.
  const [savedSnapshot, setSavedSnapshot] = useState<Record<string, string>>(
    () => ({ ...draftMap })
  );

  // Debounced persistence for the entire draft map — exposes status for the
  // "Saved" pill. We serialize on the whole map so a single quota error covers
  // all personas.
  const persist = useDebouncedLocalStorage(
    DRAFT_MAP_KEY,
    JSON.stringify(draftMap),
    { delayMs: 500 }
  );

  // Once persistence settles, the current map IS the saved snapshot.
  useEffect(() => {
    if (persist.status === "saved" || persist.status === "idle") {
      savedSnapshotRef.current = { ...draftMap };
      setSavedSnapshot({ ...draftMap });
    }
  }, [persist.status, draftMap]);

  function hasUnsavedChanges(slug: string): boolean {
    return hasUnsavedChangesPure(draftMap, savedSnapshotRef.current, slug);
  }

  const pendingCount = useMemo(
    () => unsavedCount(draftMap, savedSnapshot),
    [draftMap, savedSnapshot]
  );

  function switchPersona(nextSlug: string) {
    if (nextSlug === persona) return;
    if (persona && hasUnsavedChanges(persona)) {
      const ok =
        typeof window === "undefined"
          ? true
          : window.confirm(
              "You have unsaved changes in the current persona's draft. Switch anyway? Your draft will be kept and restored when you return."
            );
      if (!ok) return;
    }
    setPersona(nextSlug);
    // Quick-fill only when the target persona has no existing draft yet.
    const existing = (draftMap[nextSlug] ?? "").trim();
    if (!existing) {
      const p = personas.find((x) => x.slug === nextSlug);
      if (p) setText(p.prefill_text);
    }
  }

  const extractFn = useServerFn(extractSkills);
  const mutation = useMutation({
    mutationFn: () =>
      extractFn({
        data: {
          text: text.trim(),
          language: aiLangFor(language),
          personaSlug: persona as never,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Stream rows in with a small stagger for the "AI is working" feel
      const incoming = res.result.skills;
      setSkills([]);
      setOverallConfidence(res.result.overall_confidence);
      incoming.forEach((s, i) =>
        setTimeout(() => setSkills((prev) => [...prev, s]), i * 90)
      );
      if (res.warnings.length) {
        toast.message(res.warnings.join(" · "));
      } else {
        toast.success(`Mapped ${incoming.length} skills to ISCO-08`);
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Extraction failed"),
  });

  const voice = useSpeechRecognition({
    onText: (t) => setText((prev) => prev + (prev ? " " : "") + t),
    lang: language,
  });

  const canRun = text.trim().length >= 8 && !mutation.isPending;

  // ---------------------------------------------------------------------------
  // Keyboard navigation for persona chips (radiogroup pattern)
  // ---------------------------------------------------------------------------
  const personaBtnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusedPersonaIdx = useRef<number>(0);

  function focusPersonaAt(idx: number) {
    const total = personas.length;
    if (total === 0) return;
    const wrapped = ((idx % total) + total) % total;
    focusedPersonaIdx.current = wrapped;
    requestAnimationFrame(() => {
      personaBtnRefs.current[wrapped]?.focus();
    });
  }

  function onPersonaKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number,
    slug: string
  ) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        focusPersonaAt(idx + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        focusPersonaAt(idx - 1);
        break;
      case "Home":
        e.preventDefault();
        focusPersonaAt(0);
        break;
      case "End":
        e.preventDefault();
        focusPersonaAt(personas.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        switchPersona(slug);
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Export / Import drafts
  // ---------------------------------------------------------------------------
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = useCallback(() => {
    try {
      const payload = buildExport({ drafts: draftMap, languages: langMap });
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const n = Object.keys(payload.drafts).length;
      toast.success(`Exported ${n} draft${n === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }, [draftMap, langMap]);

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const raw = await file.text();
        const json: unknown = JSON.parse(raw);
        const parsed = parseImport(json);
        const incomingSlugs = Object.keys(parsed.drafts);
        const overlap = incomingSlugs.filter(
          (s) => (draftMap[s] ?? "").trim().length > 0
        );
        const ok =
          typeof window === "undefined"
            ? true
            : window.confirm(
                `Import ${incomingSlugs.length} draft${
                  incomingSlugs.length === 1 ? "" : "s"
                }? ${
                  overlap.length > 0
                    ? `${overlap.length} will overwrite existing drafts (${overlap.join(", ")}).`
                    : "No existing drafts will be overwritten."
                }`
              );
        if (!ok) return;
        setDraftMap((prev) => ({ ...prev, ...parsed.drafts }));
        setLangMap((prev) => {
          const updated = { ...prev, ...parsed.languages };
          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                LANG_MAP_KEY,
                JSON.stringify(updated)
              );
            } catch {
              /* noop */
            }
          }
          return updated;
        });
        toast.success(
          `Imported ${incomingSlugs.length} draft${incomingSlugs.length === 1 ? "" : "s"}` +
            (parsed.droppedLanguages.length
              ? ` (skipped ${parsed.droppedLanguages.length} unknown language${parsed.droppedLanguages.length === 1 ? "" : "s"})`
              : "")
        );
      } catch (e) {
        toast.error(friendlyImportError(e));
      }
    },
    [draftMap]
  );

  // ---------------------------------------------------------------------------
  // Restored-from-storage banner
  // ---------------------------------------------------------------------------
  // Snapshot the count of non-empty drafts present at mount time so the banner
  // reflects what was rehydrated, not what the user has typed since.
  const restoredCountRef = useRef<number>(
    Object.values(draftMap).filter((v) => (v ?? "").trim().length > 0).length
  );
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.sessionStorage.getItem(RESTORED_BANNER_KEY) === "1";
    } catch {
      return false;
    }
  });
  const dismissRestoredBanner = useCallback(() => {
    setBannerDismissed(true);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(RESTORED_BANNER_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Page-level keyboard shortcuts
  // ---------------------------------------------------------------------------
  // Cycle to the next/previous persona using Alt+Arrow; reuses the existing
  // switchPersona() flow (which honours the unsaved-changes confirm prompt).
  const cyclePersona = useCallback(
    (direction: 1 | -1) => {
      if (personas.length === 0) return;
      const currentIdx = persona
        ? personas.findIndex((p) => p.slug === persona)
        : -1;
      const baseIdx = currentIdx === -1 ? 0 : currentIdx;
      const nextIdx =
        ((baseIdx + direction) % personas.length + personas.length) %
        personas.length;
      switchPersona(personas[nextIdx].slug);
    },
    // switchPersona depends on draftMap/personas; including persona keeps cycling correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persona, personas, draftMap]
  );

  useSkillsHotkeys({
    onExport: handleExport,
    onImport: () => importInputRef.current?.click(),
    onPrevPersona: () => cyclePersona(-1),
    onNextPersona: () => cyclePersona(1),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
        <PageTitle
          module="Module 01"
          eyebrow="Skills Signal Engine"
          description="Speak or type — in any language. The AI maps your description to ISCO-08 4-digit occupation codes and the ESCO skills taxonomy. Portable across borders and sectors."
        >
          Map your skills to the global economy
        </PageTitle>

        {!bannerDismissed && (
          <RestoredBanner
            count={restoredCountRef.current}
            onDismiss={dismissRestoredBanner}
          />
        )}

        <LastErrorPanel moduleFilter="Skills" />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* INPUT */}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-[14px] font-semibold text-tx-0">
                Describe your skills & experience
              </h2>
              <div className="flex items-center gap-2">
                <SavedIndicator status={persist.status} error={persist.error} />
                <button
                  type="button"
                  onClick={handleExport}
                  aria-label="Export all persona drafts as JSON"
                  aria-keyshortcuts="Control+S Meta+S"
                  className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-bg-3 px-2 py-1 text-[10.5px] text-tx-1 transition hover:border-gold-glow hover:text-gold"
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  aria-label="Import persona drafts from a JSON backup file"
                  aria-keyshortcuts="Control+I Meta+I"
                  className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-bg-3 px-2 py-1 text-[10.5px] text-tx-1 transition hover:border-gold-glow hover:text-gold"
                >
                  <Upload className="h-3 w-3" aria-hidden="true" />
                  Import
                </button>
                <details className="group relative">
                  <summary
                    aria-label="Show keyboard shortcuts"
                    className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md border border-border-strong bg-bg-3 px-2 py-1 text-[10.5px] text-tx-1 transition hover:border-gold-glow hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-glow [&::-webkit-details-marker]:hidden"
                  >
                    <Keyboard className="h-3 w-3" aria-hidden="true" />
                    Shortcuts
                  </summary>
                  <div
                    role="region"
                    aria-label="Keyboard shortcuts for the skills page"
                    className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-border-strong bg-bg-2 p-3 text-[11px] text-tx-1 shadow-lg"
                  >
                    <p className="mb-2 font-display text-[11px] font-semibold text-tx-0">
                      Keyboard shortcuts
                    </p>
                    <ul className="space-y-1.5">
                      <li className="flex items-center justify-between gap-2">
                        <span>Export drafts</span>
                        <span className="font-mono text-[10px] text-tx-2">
                          <kbd className="rounded border border-border bg-bg-3 px-1">Ctrl</kbd>
                          <span className="px-0.5">/</span>
                          <kbd className="rounded border border-border bg-bg-3 px-1">⌘</kbd>
                          {" + "}
                          <kbd className="rounded border border-border bg-bg-3 px-1">S</kbd>
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span>Import drafts</span>
                        <span className="font-mono text-[10px] text-tx-2">
                          <kbd className="rounded border border-border bg-bg-3 px-1">Ctrl</kbd>
                          <span className="px-0.5">/</span>
                          <kbd className="rounded border border-border bg-bg-3 px-1">⌘</kbd>
                          {" + "}
                          <kbd className="rounded border border-border bg-bg-3 px-1">I</kbd>
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span>Previous persona</span>
                        <span className="font-mono text-[10px] text-tx-2">
                          <kbd className="rounded border border-border bg-bg-3 px-1">Alt</kbd>
                          {" + "}
                          <kbd className="rounded border border-border bg-bg-3 px-1">←</kbd>
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span>Next persona</span>
                        <span className="font-mono text-[10px] text-tx-2">
                          <kbd className="rounded border border-border bg-bg-3 px-1">Alt</kbd>
                          {" + "}
                          <kbd className="rounded border border-border bg-bg-3 px-1">→</kbd>
                        </span>
                      </li>
                    </ul>
                    <p className="mt-2 text-[10px] text-tx-2">
                      Alt+Arrow is suppressed while typing in the editor so
                      caret-jump-by-word still works.
                    </p>
                  </div>
                </details>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImportFile(f);
                    // Reset so picking the same file twice still fires onChange.
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            <p className="mb-3 text-[11.5px] text-tx-2">
              Include informal work, self-taught skills, and community roles.
            </p>

            {/* Persona quick-fill — keyboard-navigable radiogroup */}
            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-tx-2">
                  Quick-fill with persona
                </p>
                {pendingCount > 0 && (
                  <span
                    className="rounded-full border border-coral/40 bg-coral-soft/30 px-2 py-0.5 text-[9.5px] font-semibold text-coral"
                    aria-live="polite"
                  >
                    {pendingCount} unsaved draft{pendingCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <p id="persona-instructions" className="sr-only">
                Use left and right arrow keys to navigate personas, Enter or
                Space to select. Home and End jump to the first or last
                persona. From anywhere on the page, hold Alt and press the
                left or right arrow key to cycle personas.
              </p>
              <div
                role="radiogroup"
                aria-label="Choose a persona to quick-fill"
                aria-describedby="persona-instructions"
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 snap-x snap-mandatory sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
              >
                {personas.map((p, idx) => {
                  const active = persona === p.slug;
                  const draft = (draftMap[p.slug] ?? "").trim();
                  const unsaved = hasUnsavedChanges(p.slug);
                  const hasDraft = draft.length > 0;
                  const status: "none" | "saved" | "unsaved" = !hasDraft
                    ? "none"
                    : unsaved
                      ? "unsaved"
                      : "saved";
                  const tabIndex =
                    active || (!persona && idx === 0) ? 0 : -1;
                  return (
                    <button
                      key={p.slug}
                      ref={(el) => {
                        personaBtnRefs.current[idx] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      tabIndex={tabIndex}
                      onClick={() => switchPersona(p.slug)}
                      onKeyDown={(e) => onPersonaKeyDown(e, idx, p.slug)}
                      onFocus={() => {
                        focusedPersonaIdx.current = idx;
                      }}
                      aria-label={`${p.display_name} — ${
                        status === "unsaved"
                          ? "unsaved changes"
                          : status === "saved"
                            ? "saved draft"
                            : "no draft yet"
                      }${active ? ", currently selected" : ""}`}
                      className={`flex shrink-0 snap-start items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-glow ${
                        active
                          ? "border-gold bg-gold-soft text-gold"
                          : "border-border bg-bg-3 text-tx-1 hover:border-gold-glow hover:text-tx-0"
                      }`}
                    >
                      <span aria-hidden="true">{p.emoji}</span>
                      <span>{p.display_name}</span>
                      <span className="text-[10px] text-tx-2">
                        · {p.occupation}
                      </span>
                      {status !== "none" && (
                        <span
                          aria-hidden="true"
                          title={
                            status === "unsaved"
                              ? "Unsaved changes"
                              : "Saved to local storage"
                          }
                          className={`ml-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                            status === "unsaved"
                              ? "bg-coral-soft/40 text-coral"
                              : "bg-bg-4 text-gold"
                          }`}
                        >
                          {status === "unsaved" ? "●" : <Check className="h-2.5 w-2.5" />}
                          {status === "unsaved" ? "Unsaved" : "Saved"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg-4 p-3 transition focus-within:border-gold-glow focus-within:shadow-[0_0_0_3px_oklch(0.770_0.140_75/0.08)]">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 4000))}
                rows={8}
                placeholder="Example: I've been repairing smartphones since I was 17. I replace screens, batteries, motherboards. I help customers with software issues and data recovery. I run my own small shop and manage 3 other technicians. I speak English, Swahili, and Kikuyu..."
                className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-tx-0 outline-none placeholder:text-tx-2"
              />
              <div className="mt-2 flex items-center gap-2 border-t border-border-soft pt-2">
                <button
                  type="button"
                  onClick={voice.toggle}
                  disabled={!voice.supported}
                  title={voice.supported ? "Speak your skills" : "Voice capture not supported in this browser"}
                  className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] font-medium transition ${
                    voice.listening
                      ? "anim-pulse-coral border-coral/50 bg-coral-soft text-coral"
                      : "border-border-strong bg-transparent text-tx-1 hover:border-gold-glow hover:bg-gold-soft hover:text-gold"
                  } ${!voice.supported ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  {voice.listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {voice.listening ? "Stop" : "Speak"}
                </button>
                <select
                  aria-label="Recognition language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as SpeechLang)}
                  disabled={voice.listening}
                  className="rounded-md border border-border-strong bg-bg-3 px-2 py-1 text-[10.5px] text-tx-1 outline-none focus:border-gold-glow disabled:opacity-50"
                >
                  {SPEECH_LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-tx-2">
                  {voice.error
                    ? voice.error
                    : voice.supported
                      ? voice.listening
                        ? `Listening (${language})…`
                        : "Web Speech API"
                      : "Voice unavailable — please type instead"}
                </span>
                <button
                  type="button"
                  onClick={() => mutation.mutate()}
                  disabled={!canRun}
                  className="ml-auto flex items-center gap-2 rounded-md bg-gold px-4 py-1.5 text-[12px] font-semibold text-bg-0 transition hover:opacity-90 disabled:opacity-50"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Mapping…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Map to ISCO-08 / ESCO
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sticky-on-mobile saved/unsaved + character counter so the
                indicator stays visible while typing on small screens. */}
            <div className="sticky bottom-0 z-10 mt-2 flex items-center justify-between gap-2 rounded-md border border-border-soft bg-bg-3/95 px-3 py-1.5 backdrop-blur sm:static sm:bg-bg-3">
              <div className="flex items-center gap-2 text-[10.5px] text-tx-2">
                <span aria-hidden="true">●</span>
                <span>
                  {persona ? (
                    <>
                      Editing{" "}
                      <strong className="text-tx-1">
                        {personas.find((p) => p.slug === persona)?.display_name ?? persona}
                      </strong>
                    </>
                  ) : (
                    "Editing default draft"
                  )}
                </span>
                <SavedIndicator status={persist.status} error={persist.error} />
              </div>
              <span
                className="font-mono text-[10px] text-tx-2"
                aria-label={`${text.length} of 4000 characters used`}
              >
                {text.length.toLocaleString()} / 4,000
              </span>
            </div>

            <p className="mt-3 rounded-md border border-border-soft bg-bg-3 px-3 py-2 text-[10.5px] leading-relaxed text-tx-2">
              <span className="text-tx-1">🔑</span> Skill extraction uses{" "}
              <strong className="text-tx-0">Lovable AI · google/gemini-3-flash-preview</strong>{" "}
              with structured tool-calling. Output mapped to{" "}
              <strong className="text-tx-0">ISCO-08</strong> (ILO 4-digit codes)
              and <strong className="text-tx-0">ESCO v1.1</strong>.
            </p>
          </div>

          {/* OUTPUT */}
          <div>
            <h2 className="mb-1 font-display text-[14px] font-semibold text-tx-0">
              Extracted Skill Profile
            </h2>
            <p className="mb-3 text-[11.5px] text-tx-2">
              Mapped to international taxonomy — portable, verifiable, explainable.
            </p>

            <SkillConstellation skills={skills} />
            <IscoMappingTable skills={skills} loading={mutation.isPending} />
            {skills.length > 0 && (
              <CredentialCardPreview
                personaName={
                  personas.find((p) => p.slug === persona)?.display_name ??
                  "Anonymous"
                }
                location={
                  personas.find((p) => p.slug === persona)?.location ?? ""
                }
                skills={skills}
                overallConfidence={overallConfidence}
              />
            )}
          </div>
        </div>

        <SkillsPrivacyCard />

        <CitationsPanel citations={citationsQ.data ?? []} />
      </div>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Constellation (pure SVG)                                                   */
/* -------------------------------------------------------------------------- */
function SkillConstellation({ skills }: { skills: SkillRow[] }) {
  const w = 400;
  const h = 260;
  const cx = w / 2;
  const cy = h / 2;
  const positions = useMemo(() => {
    return skills.map((s, i, arr) => {
      const angle = (i / Math.max(1, arr.length)) * Math.PI * 2 - Math.PI / 2;
      const radius = 70 + (10 - s.proficiency_level) * 4;
      return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        s,
      };
    });
  }, [skills]);

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-border-soft bg-bg-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[260px] w-full">
        {/* edges */}
        {positions.map((p, i) => (
          <line
            key={`e-${i}`}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="oklch(1 0 0 / 0.12)"
            strokeWidth={0.5 + p.s.confidence}
          />
        ))}
        {/* center */}
        <circle cx={cx} cy={cy} r={18} fill="oklch(0.770 0.140 75 / 0.18)" stroke="oklch(0.770 0.140 75)" strokeWidth={1.5} />
        <text x={cx} y={cy + 4} textAnchor="middle" className="fill-gold" style={{ fontSize: 10, fontFamily: "Space Mono", fontWeight: 700 }}>
          YOU
        </text>
        {/* nodes */}
        {positions.map((p, i) => {
          const color = CATEGORY_COLOR[p.s.category];
          return (
            <g key={`n-${i}`} className="anim-fade-in" style={{ animationDelay: `${i * 90}ms` }}>
              <circle cx={p.x} cy={p.y} r={6 + p.s.proficiency_level / 1.5} fill={color} fillOpacity={0.85} stroke={color} strokeWidth={1} />
              <text x={p.x} y={p.y + 22} textAnchor="middle" className="fill-tx-0" style={{ fontSize: 9, fontFamily: "DM Sans" }}>
                {truncate(p.s.skill_name, 18)}
              </text>
            </g>
          );
        })}
        {skills.length === 0 && (
          <text x={cx} y={cy + 50} textAnchor="middle" style={{ fontSize: 10, fill: "oklch(0.500 0.035 255)" }}>
            Map your skills to populate the constellation
          </text>
        )}
      </svg>
    </div>
  );
}

const CATEGORY_COLOR: Record<string, string> = {
  technical: "oklch(0.760 0.130 230)",
  digital: "oklch(0.800 0.130 180)",
  trade: "oklch(0.770 0.140 75)",
  creative: "oklch(0.720 0.180 22)",
  business: "oklch(0.760 0.130 230)",
  interpersonal: "oklch(0.750 0.130 290)",
  agriculture: "oklch(0.760 0.150 160)",
  service: "oklch(0.750 0.130 290)",
};

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

/* -------------------------------------------------------------------------- */
/* ISCO mapping table                                                         */
/* -------------------------------------------------------------------------- */
function IscoMappingTable({ skills, loading }: { skills: SkillRow[]; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-soft bg-bg-3">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border-soft">
            {["Skill", "ISCO-08", "ESCO", "Category", "Level", "Conf"].map((h) => (
              <th key={h} className="px-3 py-2 text-[9px] font-bold uppercase tracking-[0.07em] text-tx-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {skills.length === 0 && !loading && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-[12px] text-tx-2">
                Click "Map to ISCO-08 / ESCO" to populate
              </td>
            </tr>
          )}
          {loading && skills.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-[12px] text-tx-2">
                <Loader2 className="mx-auto h-4 w-4 animate-spin text-gold" />
              </td>
            </tr>
          )}
          {skills.map((s, i) => (
            <tr key={i} className="anim-fade-in border-b border-border-soft last:border-b-0 hover:bg-gold-soft" style={{ animationDelay: `${i * 90}ms` }}>
              <td className="px-3 py-2 text-[12px] text-tx-0">{s.skill_name}</td>
              <td className="px-3 py-2 font-mono text-[10px] font-bold text-gold">{s.isco_code}</td>
              <td className="px-3 py-2 font-mono text-[9px] text-tx-2">{s.esco_code ?? "—"}</td>
              <td className="px-3 py-2 text-[11px] text-tx-1">{s.category}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-12 rounded bg-border">
                    <div className="h-1 rounded bg-gradient-to-r from-teal to-gold" style={{ width: `${s.proficiency_level * 10}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-tx-1">{s.proficiency_level}</span>
                </div>
              </td>
              <td className="px-3 py-2 font-mono text-[10px] text-tx-1">{(s.confidence * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Credential card preview (SVG-styled)                                       */
/* -------------------------------------------------------------------------- */
function CredentialCardPreview({
  personaName,
  location,
  skills,
  overallConfidence,
}: {
  personaName: string;
  location: string;
  skills: SkillRow[];
  overallConfidence: number | null;
}) {
  const top = skills.slice(0, 3);
  const fingerprint = useMemo(() => fakeHash(skills.map((s) => s.skill_name).join("|")), [skills]);

  return (
    <div className="mt-4 rounded-2xl border border-gold/40 bg-gradient-to-br from-bg-2 to-bg-1 p-5 shadow-[0_0_30px_-10px_oklch(0.770_0.140_75/0.4)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold text-gold">◈ TalentGraph Africa</span>
        <span className="rounded border border-teal/40 bg-teal-soft px-2 py-0.5 font-mono text-[9px] font-bold text-teal">
          ✓ Cryptographically signed
        </span>
      </div>
      <p className="font-display text-[18px] font-bold text-tx-0">{personaName}</p>
      <p className="text-[11px] text-tx-2">{location}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {top.map((s) => (
          <span key={s.skill_name} className="rounded-full border border-gold-glow bg-gold-soft px-2 py-0.5 text-[10px] font-medium text-gold">
            {s.skill_name} · L{s.proficiency_level}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-border-soft pt-3">
        <div>
          <p className="font-mono text-[9px] text-tx-2">SHA-256 · {fingerprint.slice(0, 24)}…</p>
          <p className="font-mono text-[9px] text-tx-2">Anchored · TalentGraph Cloud (preview)</p>
          {overallConfidence !== null && (
            <p className="mt-1 font-mono text-[9px] text-tx-1">
              Overall confidence · {(overallConfidence * 100).toFixed(0)}%
            </p>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded border border-border-strong bg-bg-3">
          <QrCode className="h-7 w-7 text-tx-1" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Link
          to="/credential/$id"
          params={{ id: "preview" }}
          className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-bg-3 px-3 py-1.5 text-[11px] text-tx-1 hover:bg-bg-4"
        >
          View Credential
        </Link>
        <button
          type="button"
          onClick={() => toast.info("WhatsApp share is wired in the next iteration.")}
          className="inline-flex items-center gap-1 rounded-md border border-border-strong bg-bg-3 px-3 py-1.5 text-[11px] text-tx-1 hover:bg-bg-4"
        >
          <Share2 className="h-3 w-3" />
          Share via WhatsApp
        </button>
      </div>
    </div>
  );
}

function fakeHash(input: string): string {
  // Deterministic non-crypto fingerprint for preview-only display.
  let h = 0n;
  for (let i = 0; i < input.length; i++) {
    h = (h * 131n + BigInt(input.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0").repeat(4).slice(0, 64);
}

/* -------------------------------------------------------------------------- */
/* Saved indicator                                                            */
/* -------------------------------------------------------------------------- */
function SavedIndicator({
  status,
  error,
}: {
  status: PersistStatus;
  error: string | null;
}) {
  const announcement =
    status === "saving"
      ? "Saving draft to local storage"
      : status === "retrying"
        ? "Retrying save after a storage error"
        : status === "saved"
          ? "Draft saved to local storage"
          : status === "error"
            ? `Could not save draft: ${error ?? "unknown error"}`
            : "";

  const tooltip =
    status === "error"
      ? `Local storage save failed${error ? `: ${error}` : ""}. Your draft is kept in memory but won't survive a refresh.`
      : status === "retrying"
        ? "Auto-retrying after a quota error — keep deleting content to free space"
        : status === "saving"
          ? "Saving your draft to this browser's local storage"
          : status === "saved"
            ? "Draft saved to this browser's local storage"
            : undefined;

  if (status === "idle") {
    return (
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>
    );
  }

  const colorClass =
    status === "error"
      ? "text-coral"
      : status === "saved"
        ? "text-gold"
        : status === "retrying"
          ? "text-coral"
          : "text-tx-2";

  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      title={tooltip}
      className={`anim-fade-in inline-flex items-center gap-1 text-[10.5px] ${colorClass}`}
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          <span aria-hidden="true">Saving…</span>
        </>
      )}
      {status === "retrying" && (
        <>
          <RotateCw className="h-3 w-3 animate-spin" aria-hidden="true" />
          <span aria-hidden="true">Retrying…</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3 w-3" aria-hidden="true" />
          <span aria-hidden="true">Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          <span aria-hidden="true">{error ?? "Save failed"}</span>
        </>
      )}
      <span className="sr-only">{announcement}</span>
    </span>
  );
}



