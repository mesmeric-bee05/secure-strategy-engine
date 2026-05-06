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
export const SUPPORTED_LANGS = ["en-US", "en-GB", "sw-KE", "sw-TZ", "fr-FR", "ha-NG"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/**
 * Read a JSON map from localStorage, falling back to a single legacy string
 * key (migrated under the implicit "default" persona bucket).
 */
export function readJSONMap<T extends string>(
  primaryKey: string,
  legacyKey: string,
  storage: Storage | undefined = typeof window !== "undefined" ? window.localStorage : undefined,
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
  slug: string,
): boolean {
  return (current[slug] ?? "").trim() !== (saved[slug] ?? "").trim();
}

/** Number of persona slugs in `current` that diverge from `saved`. */
export function unsavedCount(
  current: Record<string, string>,
  saved: Record<string, string>,
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

/** Hard cap on user-supplied import file size, enforced by the route layer. */
export const MAX_IMPORT_FILE_BYTES = 1_000_000; // 1 MB

/** Keys that must never appear in user-supplied JSON (prototype pollution). */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Returns true only for objects whose prototype is `Object.prototype` —
 * rejects arrays, Maps, Dates, and class instances even when they would
 * structurally satisfy a `Record<string, string>` zod schema.
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  if (Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Strip prototype-pollution keys from a record before validation. */
function stripForbiddenKeys<T>(rec: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!FORBIDDEN_KEYS.has(k)) out[k] = v;
  }
  return out;
}

/** Slug keys: short, alphanumeric+`-_`, never empty, never prototype-pollution. */
const SlugKey = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "slug must be alphanumeric (with - or _)")
  .refine((k) => !FORBIDDEN_KEYS.has(k), {
    message: "forbidden key name",
  });

/* -------------------------------------------------------------------------- */
/* Safe-text content validation                                                */
/* -------------------------------------------------------------------------- */

/**
 * Patterns that we never want landing in localStorage even if structurally
 * valid. We don't render imported text as HTML today, but defence-in-depth:
 * if a future change ever sets innerHTML on a draft, this gate will block
 * the obvious vectors.
 */
const UNSAFE_CONTENT_PATTERNS: ReadonlyArray<RegExp> = [
  /<\s*script\b/i,
  /<\s*iframe\b/i,
  /<\s*object\b/i,
  /<\s*embed\b/i,
  /<\s*svg\b[^>]*\bon\w+\s*=/i,
  /\bjavascript\s*:/i,
  /\bdata\s*:\s*text\/html/i,
  /\bon[a-z]+\s*=\s*["']?[^"'>]*["']?/i,
];

/**
 * Throws when `text` is not "safe plain text" suitable for re-display:
 *   - contains control characters other than \t \n \r
 *   - matches an HTML/JS smuggling pattern
 *   - decodes as binary (>1% non-printable bytes)
 *
 * Strict mode caps length at 20,000 chars (matches the schema cap).
 */
export function assertSafeText(text: unknown): asserts text is string {
  if (typeof text !== "string") {
    throw new SafeTextError("not a string");
  }
  if (text.length > 20_000) {
    throw new SafeTextError("text exceeds 20,000 characters");
  }
  // Reject control chars except \t \n \r.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    throw new SafeTextError("contains control characters");
  }
  for (const re of UNSAFE_CONTENT_PATTERNS) {
    if (re.test(text)) {
      throw new SafeTextError("contains HTML/JS-like content");
    }
  }
  // Binary heuristic — count non-printable bytes after stripping \t \n \r.
  let nonPrintable = 0;
  const cleaned = text.replace(/[\t\n\r]/g, "");
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned.charCodeAt(i);
    // Allow standard printable ASCII (0x20–0x7E) and any non-ASCII (≥ 0xA0).
    // The 0x80–0x9F range and other low control chars are flagged above.
    if (!((c >= 0x20 && c <= 0x7e) || c >= 0xa0)) nonPrintable += 1;
  }
  if (cleaned.length > 0 && nonPrintable / cleaned.length > 0.01) {
    throw new SafeTextError("looks like binary data");
  }
}

/** Sentinel error so callers can branch on content rejections. */
export class SafeTextError extends Error {
  override readonly name = "SafeTextError";
  constructor(message: string) {
    super(message);
  }
}

const SafeText = (maxLen: number) =>
  z
    .string()
    .max(maxLen)
    .superRefine((val, ctx) => {
      try {
        assertSafeText(val);
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: e instanceof SafeTextError ? `unsafe content: ${e.message}` : "unsafe content",
          params: { unsafeContent: true },
        });
      }
    });

const PlainStringRecord = (maxLen: number) =>
  z
    .unknown()
    .refine(isPlainObject, {
      message: "must be a plain object of slug → string",
    })
    .transform((v) => stripForbiddenKeys(v as Record<string, unknown>))
    .pipe(z.record(SlugKey, SafeText(maxLen)));

export const DraftExportSchema = z
  .object({
    version: z.literal(DRAFT_EXPORT_VERSION),
    exportedAt: z.string(),
    drafts: PlainStringRecord(20_000),
    languages: PlainStringRecord(16).default({}),
  })
  .strict();
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
  // Drop empty/whitespace-only drafts so we don't overwrite real data with "".
  const drafts: Record<string, string> = {};
  for (const [slug, text] of Object.entries(parsed.drafts)) {
    if (text.trim().length > 0) drafts[slug] = text;
  }
  const droppedLanguages: string[] = [];
  const languages: Record<string, SupportedLang> = {};
  for (const [slug, code] of Object.entries(parsed.languages)) {
    if ((SUPPORTED_LANGS as readonly string[]).includes(code)) {
      languages[slug] = code as SupportedLang;
    } else {
      droppedLanguages.push(`${slug}=${code}`);
    }
  }
  return { drafts, languages, droppedLanguages };
}

/** Merge an import on top of current state ("new wins" for matching keys). */
export function mergeImport<T extends Record<string, string>>(
  current: T,
  incoming: Record<string, string>,
): T {
  return { ...current, ...incoming } as T;
}

/* -------------------------------------------------------------------------- */
/* Per-persona conflict-resolution defaults for multi-file imports             */
/* -------------------------------------------------------------------------- */

export type ConflictAction = "keep" | "overwrite" | "append";

export interface PickDefaultActionInput {
  incomingText: string;
  currentText: string;
  /** ISO export-time of the incoming file (root `exportedAt`). */
  incomingExportedAt?: string;
  /** ISO last-saved-time we have for the current persona, if any. */
  currentSavedAt?: string;
}

/**
 * Sensible default conflict action for a single persona row in a multi-file
 * import:
 *   - empty current → overwrite (no risk).
 *   - identical content → keep.
 *   - incoming clearly newer than current saved snapshot → overwrite.
 *   - everything else → keep (safe; user must opt in to clobber).
 */
export function pickDefaultAction({
  incomingText,
  currentText,
  incomingExportedAt,
  currentSavedAt,
}: PickDefaultActionInput): ConflictAction {
  if (currentText.trim().length === 0) return "overwrite";
  if (incomingText.trim() === currentText.trim()) return "keep";
  if (incomingExportedAt && currentSavedAt) {
    const incoming = Date.parse(incomingExportedAt);
    const current = Date.parse(currentSavedAt);
    if (Number.isFinite(incoming) && Number.isFinite(current) && incoming > current) {
      return "overwrite";
    }
  }
  return "keep";
}

export const SAVED_AT_MAP_KEY = "talentgraph:skills:saved-at-by-persona";

/* -------------------------------------------------------------------------- */
/* Friendly error messages for import failures                                 */
/* -------------------------------------------------------------------------- */

/**
 * Convert any thrown import error into a single human-readable string suitable
 * for a toast notification. Never reveals stack traces or internal details.
 */
export function friendlyImportError(e: unknown): string {
  if (e instanceof SyntaxError) {
    return "Invalid backup: file is not valid JSON";
  }
  if (e instanceof SafeTextError) {
    return `Invalid backup: ${e.message}`;
  }
  if (e instanceof z.ZodError) {
    const issue = e.issues[0];
    if (!issue) return "Invalid backup: unrecognised shape";
    const path = issue.path.join(".") || "(root)";
    // Version mismatch: surface the user's version explicitly.
    if (issue.path[0] === "version" && issue.code === "invalid_literal") {
      return `Backup version is not supported (expected version ${DRAFT_EXPORT_VERSION})`;
    }
    if (issue.path[0] === "version") {
      return `Backup version is not supported (expected version ${DRAFT_EXPORT_VERSION})`;
    }
    // Unsafe content surfaced via SafeText superRefine.
    const params = (issue as z.ZodIssue & { params?: { unsafeContent?: boolean } }).params;
    if (params?.unsafeContent) {
      return `Invalid backup at ${path}: ${issue.message}`;
    }
    if (issue.path[0] === "drafts" && issue.path.length === 1) {
      return "Invalid backup: drafts must be an object of slug → text";
    }
    if (issue.path[0] === "languages" && issue.path.length === 1) {
      return "Invalid backup: languages must be an object of slug → code";
    }
    if (issue.code === "unrecognized_keys") {
      return "Invalid backup: contains unexpected fields";
    }
    return `Invalid backup at ${path}: ${issue.message}`;
  }
  if (e instanceof Error && e.message) {
    return `Could not import file: ${e.message}`;
  }
  return "Could not import file";
}

/* -------------------------------------------------------------------------- */
/* Local-data dump (human-readable, distinct from re-importable Export)        */
/* -------------------------------------------------------------------------- */

export interface LocalDataDumpInput {
  drafts: Record<string, string>;
  languages: Record<string, string>;
  /** Per-persona "saved snapshot" so we can flag unsaved-at-export-time. */
  savedSnapshot?: Record<string, string>;
  /** Test seam — defaults to `new Date()`. */
  now?: Date;
  /** Build/version label injected by the route from `import.meta.env`. */
  appVersion?: string;
}

export interface LocalDataDumpPersona {
  slug: string;
  charCount: number;
  lastSavedLanguage: string | null;
  unsavedAtExportTime: boolean;
  /** First 80 chars of the draft for human inspection. Always plain text. */
  preview: string;
  /** Full draft text. */
  text: string;
}

/** Top-level migrator hook for the local-data dump format. */
export const LOCAL_DATA_DUMP_VERSION = 1 as const;
export type LocalDataDumpVersion = typeof LOCAL_DATA_DUMP_VERSION;

export interface LocalDataDump {
  /** Flat top-level version field — single source of truth for migrators. */
  schemaVersion: LocalDataDumpVersion;
  generatedAt: string;
  app: "TalentGraph Africa — Skills";
  appVersion: string;
  schema: {
    version: 1;
    format: "talentgraph.local-data.v1";
    /** Re-import path: this file is NOT a re-importable export. */
    reImportable: false;
  };
  storage: Record<
    string,
    { scope: "localStorage"; bytes: number; keys: number; value: Record<string, string> }
  >;
  personas: LocalDataDumpPersona[];
  notes: string[];
}

function bytesOf(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

export function buildLocalDataDump({
  drafts,
  languages,
  savedSnapshot,
  now = new Date(),
  appVersion = "preview",
}: LocalDataDumpInput): LocalDataDump {
  const slugs = Array.from(new Set([...Object.keys(drafts), ...Object.keys(languages)])).sort();
  const personas: LocalDataDumpPersona[] = slugs.map((slug) => {
    const text = drafts[slug] ?? "";
    return {
      slug,
      charCount: text.length,
      lastSavedLanguage: languages[slug] ?? null,
      unsavedAtExportTime: savedSnapshot ? hasUnsavedChanges(drafts, savedSnapshot, slug) : false,
      preview: text.slice(0, 80),
      text,
    };
  });
  return {
    schemaVersion: LOCAL_DATA_DUMP_VERSION,
    generatedAt: now.toISOString(),
    app: "TalentGraph Africa — Skills",
    appVersion,
    schema: {
      version: 1,
      format: "talentgraph.local-data.v1",
      reImportable: false,
    },
    storage: {
      [DRAFT_MAP_KEY]: {
        scope: "localStorage",
        bytes: bytesOf(drafts),
        keys: Object.keys(drafts).length,
        value: drafts,
      },
      [LANG_MAP_KEY]: {
        scope: "localStorage",
        bytes: bytesOf(languages),
        keys: Object.keys(languages).length,
        value: languages,
      },
    },
    personas,
    notes: [
      "This file is a human-readable snapshot of the data this app stores on YOUR device.",
      "It is NOT the re-importable backup — use the Export button for that.",
      "No information is sent to any server when you generate this file.",
      `Generated at ${now.toISOString()}.`,
    ],
  };
}

export function localDataFilename(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `talentgraph-skills-local-data-${y}${m}${d}-${hh}${mm}${ss}.json`;
}

export type ParseLocalDataDumpResult =
  | { ok: true; dump: LocalDataDump }
  | { ok: false; reason: "invalid_shape" | "unknown_schema_version"; got?: unknown };

/**
 * Validate a parsed JSON snapshot produced by `buildLocalDataDump`.
 * Used by future migrators / re-import flows; today it guarantees that
 * snapshots taken now will be reliably re-readable across app updates.
 */
export function parseLocalDataDump(input: unknown): ParseLocalDataDumpResult {
  if (!isPlainObject(input)) return { ok: false, reason: "invalid_shape" };
  const v = (input as { schemaVersion?: unknown }).schemaVersion;
  if (typeof v !== "number") return { ok: false, reason: "invalid_shape" };
  if (v !== LOCAL_DATA_DUMP_VERSION) {
    return { ok: false, reason: "unknown_schema_version", got: v };
  }
  // Spot-check a couple of required fields.
  const obj = input as Record<string, unknown>;
  if (typeof obj.generatedAt !== "string" || !Array.isArray(obj.personas)) {
    return { ok: false, reason: "invalid_shape" };
  }
  return { ok: true, dump: input as unknown as LocalDataDump };
}

export interface MigrationOutcome {
  dump: LocalDataDump;
  /** True if the input was on an older schema and we upgraded it. */
  migrated: boolean;
  /** The original version we observed (may be 0 for pre-versioned dumps). */
  fromVersion: number;
  /** Human-readable notes about what was changed. */
  notes: string[];
}

/**
 * Attempt to migrate a local-data dump from an older schemaVersion to the
 * current one. Returns null if the input is unrecognisable or its version is
 * newer than this app understands.
 *
 * Version history:
 *   - v0 (legacy / pre-versioned): no `schemaVersion`, but has `personas[]`
 *     and `generatedAt`. We assign schemaVersion=1.
 *   - v1 (current): pass-through.
 */
export function migrateLocalDataDump(input: unknown): MigrationOutcome | null {
  if (!isPlainObject(input)) return null;
  const obj = input as Record<string, unknown>;
  const v = typeof obj.schemaVersion === "number" ? obj.schemaVersion : 0;

  if (v > LOCAL_DATA_DUMP_VERSION) return null; // newer than we know
  if (typeof obj.generatedAt !== "string" || !Array.isArray(obj.personas)) return null;

  if (v === LOCAL_DATA_DUMP_VERSION) {
    return {
      dump: input as unknown as LocalDataDump,
      migrated: false,
      fromVersion: v,
      notes: [],
    };
  }

  // v0 → v1: stamp schemaVersion + ensure schema block exists.
  const upgraded: LocalDataDump = {
    ...(input as unknown as LocalDataDump),
    schemaVersion: LOCAL_DATA_DUMP_VERSION,
    schema: (obj.schema as LocalDataDump["schema"]) ?? {
      version: 1,
      format: "talentgraph.local-data.v1",
      reImportable: false,
    },
  };
  return {
    dump: upgraded,
    migrated: true,
    fromVersion: v,
    notes: [`Upgraded snapshot from schemaVersion ${v} to ${LOCAL_DATA_DUMP_VERSION}.`],
  };
}
