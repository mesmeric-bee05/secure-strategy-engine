/**
 * Pure helpers for the per-persona skills draft persistence on /skills.
 *
 * Extracted from the route component so they can be unit-tested without
 * mounting the TanStack Router shell.
 */
import { z } from "zod";

export const DRAFT_MAP_KEY = "talentgraph:skills:draft-by-persona";
export const LANG_MAP_KEY = "talentgraph:skills:lang-by-persona";
export const LEGACY_DRAFT_KEY = "talentgraph:skills:draft";
export const LEGACY_LANG_KEY = "talentgraph:skills:lang";

/** BCP-47 codes the /skills page supports for SpeechRecognition. */
export const SUPPORTED_LANGS = [
  "en-US",
  "en-GB",
  "sw-KE",
  "sw-TZ",
  "fr-FR",
  "ha-NG",
] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/**
 * Read a JSON map from localStorage, falling back to a single legacy string
 * key (migrated under the implicit "default" persona bucket).
 */
export function readJSONMap<T extends string>(
  primaryKey: string,
  legacyKey: string,
  storage: Storage | undefined = typeof window !== "undefined"
    ? window.localStorage
    : undefined
): Record<string, T> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(primaryKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, T>;
      }
      return {};
    }
    const legacy = storage.getItem(legacyKey);
    return legacy ? ({ default: legacy as T } as Record<string, T>) : {};
  } catch {
    return {};
  }
}

/** True when `current[slug]` differs from `saved[slug]` (whitespace-trimmed). */
export function hasUnsavedChanges(
  current: Record<string, string>,
  saved: Record<string, string>,
  slug: string
): boolean {
  return (current[slug] ?? "").trim() !== (saved[slug] ?? "").trim();
}

/** Number of persona slugs in `current` that diverge from `saved`. */
export function unsavedCount(
  current: Record<string, string>,
  saved: Record<string, string>
): number {
  const slugs = new Set([...Object.keys(current), ...Object.keys(saved)]);
  let n = 0;
  for (const s of slugs) if (hasUnsavedChanges(current, saved, s)) n += 1;
  return n;
}

/* -------------------------------------------------------------------------- */
/* Export / Import                                                             */
/* -------------------------------------------------------------------------- */

export const DRAFT_EXPORT_VERSION = 1;

export const DraftExportSchema = z.object({
  version: z.literal(DRAFT_EXPORT_VERSION),
  exportedAt: z.string(),
  drafts: z.record(z.string(), z.string()),
  languages: z.record(z.string(), z.string()).default({}),
});
export type DraftExport = z.infer<typeof DraftExportSchema>;

export interface BuildExportInput {
  drafts: Record<string, string>;
  languages: Record<string, string>;
  /** Test seam — defaults to `new Date()`. */
  now?: Date;
}

export function buildExport({
  drafts,
  languages,
  now = new Date(),
}: BuildExportInput): DraftExport {
  return {
    version: DRAFT_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    drafts: { ...drafts },
    languages: { ...languages },
  };
}

export function exportFilename(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `talentgraph-skills-drafts-${y}${m}${d}.json`;
}

export interface ParsedImport {
  drafts: Record<string, string>;
  languages: Record<string, SupportedLang>;
  /** Languages that were dropped because they are not in SUPPORTED_LANGS. */
  droppedLanguages: string[];
}

/** Parse + sanitize a user-supplied JSON string. Throws on invalid input. */
export function parseImport(input: unknown): ParsedImport {
  const parsed = DraftExportSchema.parse(input);
  const droppedLanguages: string[] = [];
  const languages: Record<string, SupportedLang> = {};
  for (const [slug, code] of Object.entries(parsed.languages)) {
    if ((SUPPORTED_LANGS as readonly string[]).includes(code)) {
      languages[slug] = code as SupportedLang;
    } else {
      droppedLanguages.push(`${slug}=${code}`);
    }
  }
  return { drafts: parsed.drafts, languages, droppedLanguages };
}

/** Merge an import on top of current state ("new wins" for matching keys). */
export function mergeImport<T extends Record<string, string>>(
  current: T,
  incoming: Record<string, string>
): T {
  return { ...current, ...incoming } as T;
}
