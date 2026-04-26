/**
 * Best-effort PII / secret redaction for strings that flow into the
 * append-only `audit_log` (server-side) or the local `skills-audit` log.
 *
 * The patterns are intentionally conservative — false positives that turn an
 * email into "[email]" or a JWT into "[token]" are preferable to a real
 * secret hitting an immutable log. Callers that have a stronger signal
 * (e.g. a known schema) should redact at that layer first.
 *
 * What we strip:
 *   - Email addresses
 *   - Bearer / Basic auth headers
 *   - JWT-shaped tokens (3 base64url segments separated by ".")
 *   - Long hex blobs (>= 24 hex chars — captures access tokens, hashes)
 *   - Long base64 blobs (>= 32 base64 chars)
 *   - Common secret-looking key/value forms (password=…, api_key=…, etc.)
 *   - Credit-card-shaped digit runs (13–19 digits) — Luhn-blind, just length
 *   - URLs with `?…` query strings — query stripped, path kept
 *
 * What we deliberately leave alone:
 *   - IP addresses (we already hash these at the audit layer)
 *   - User-supplied free-form text (`message`/`stack`) is still allowed
 *     through after redaction so engineers can act on the report.
 */

const MAX_LEN = 2_000;

/** Ordered: longer / more-specific patterns first so they win. */
const PATTERNS: ReadonlyArray<{ name: string; re: RegExp; replace: string }> = [
  {
    name: "auth_header",
    re: /\b(?:Bearer|Basic|Token)\s+[A-Za-z0-9._\-+/=]{8,}/gi,
    replace: "[auth]",
  },
  {
    name: "jwt",
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replace: "[jwt]",
  },
  {
    name: "kv_secret",
    re: /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|service[_-]?role[_-]?key|private[_-]?key)\s*[:=]\s*['"]?[^\s'",]{4,}['"]?/gi,
    replace: "[secret]",
  },
  {
    name: "email",
    re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replace: "[email]",
  },
  {
    name: "url_query",
    // Strip the query string from any URL-like substring.
    re: /(https?:\/\/[^\s'"]+?)\?[^\s'"]*/gi,
    replace: "$1?[stripped]",
  },
  {
    name: "ccn",
    re: /\b(?:\d[ -]?){13,19}\b/g,
    replace: "[ccn]",
  },
  {
    name: "long_hex",
    re: /\b[0-9a-fA-F]{24,}\b/g,
    replace: "[hex]",
  },
  {
    name: "long_b64",
    re: /\b[A-Za-z0-9+/]{32,}={0,2}\b/g,
    replace: "[b64]",
  },
];

export interface RedactResult {
  /** Redacted string, capped at MAX_LEN. */
  text: string;
  /** Names of pattern classes that fired. Useful for histograms; never raw matches. */
  flags: string[];
  /** True if anything changed (length truncation OR pattern replacement). */
  modified: boolean;
}

/**
 * Run all redaction patterns against `input`. The returned `text` is safe to
 * persist in the immutable audit log; the returned `flags` list is a coarse
 * summary that NEVER contains raw matched substrings.
 */
export function redactForAudit(input: unknown): RedactResult {
  if (typeof input !== "string") {
    return { text: "", flags: [], modified: input !== "" };
  }
  let out = input;
  const flags: string[] = [];
  for (const { name, re, replace } of PATTERNS) {
    if (re.test(out)) {
      out = out.replace(re, replace);
      flags.push(name);
    }
  }
  let modified = flags.length > 0;
  if (out.length > MAX_LEN) {
    out = out.slice(0, MAX_LEN) + "…[truncated]";
    flags.push("truncated");
    modified = true;
  }
  return { text: out, flags, modified };
}

/**
 * Convenience: deeply redact a JSON-serialisable metadata object. Strings get
 * the full PII pass; numbers / booleans / null pass through untouched. Arrays
 * and plain objects are recursed (one level of cycle protection — we throw if
 * the structure is too deep, since audit metadata should be shallow).
 */
export function redactMetadata<T>(value: T, depth = 0): T {
  if (depth > 6) return "[depth-cap]" as unknown as T;
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactForAudit(value).text as unknown as T;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redactMetadata(v, depth + 1)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (n++ > 50) {
      out["__truncated__"] = true;
      break;
    }
    // Drop keys whose names look secret-y outright.
    if (
      /^(?:password|passwd|pwd|secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|service[_-]?role[_-]?key|private[_-]?key|cookie|set[_-]?cookie|authorization)$/i.test(
        k,
      )
    ) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = redactMetadata(v, depth + 1);
  }
  return out as unknown as T;
}
