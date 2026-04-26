/**
 * Prompt-injection sanitizer.
 *
 * Strips well-known jailbreak/injection patterns from free-form user text
 * before it is forwarded to an LLM. We intentionally do NOT throw — we
 * neutralize patterns and return the cleaned string so legitimate text that
 * happens to contain a substring still flows through.
 *
 * Always pair this with role separation (system vs user) at the API call
 * site — this is defense in depth, not a complete defense.
 */

const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(?:previous|prior|above|all)\s+(?:instructions?|prompts?|rules?)/gi,
  /disregard\s+(?:previous|prior|above|all)\s+(?:instructions?|prompts?|rules?)/gi,
  /forget\s+(?:everything|all|previous|prior)\b/gi,
  /you\s+are\s+now\s+(?:a|an|the)?/gi,
  /act\s+as\s+(?:a|an|the)\s+/gi,
  /pretend\s+to\s+be\s+/gi,
  /jailbreak/gi,
  /system\s+prompt/gi,
  /\[\s*INST\s*\]/gi,
  /\[\s*\/?\s*SYSTEM\s*\]/gi,
  /<\|.*?\|>/g,
  /###\s*(?:instruction|system|new\s+instructions?)/gi,
  /developer\s+mode/gi,
  /do\s+anything\s+now/gi,
  /DAN\s+mode/gi,
  /bypass\s+(?:all|any|your)\s+(?:restrictions?|filters?|rules?|guidelines?)/gi,
  /override\s+(?:your|all|any)\s+(?:instructions?|rules?|guidelines?)/gi,
  /new\s+(?:system|initial)\s+(?:prompt|instruction)/gi,
  /\bsudo\s+mode\b/gi,
  /reveal\s+(?:your|the)\s+(?:system|initial|original)\s+(?:prompt|instructions?)/gi,
  /repeat\s+(?:your|the)\s+(?:system|initial|original)\s+(?:prompt|instructions?)/gi,
  /(?:output|print|show|display)\s+(?:your|the)\s+(?:system|initial)\s+(?:prompt|instructions?)/gi,
  /simulate\s+(?:a|an)\s+(?:unrestricted|unfiltered|jailbroken)/gi,
  /hypothetical(?:ly)?\s+(?:speaking|scenario)\s+(?:where|in\s+which)\s+you/gi,
  /roleplay\s+as\s+/gi,
  /in\s+(?:a|this)\s+(?:fictional|hypothetical)\s+(?:world|scenario|universe)/gi,
  /\bbase64\s*:/gi,
  /eval\s*\(/gi,
];

// Zero-width / bidi / control characters frequently used to smuggle prompts.
const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

const MAX_LEN = 4000;

export interface GuardResult {
  cleaned: string;
  modified: boolean;
  flags: string[];
}

export function sanitizeUserPrompt(input: string): GuardResult {
  const flags: string[] = [];
  let cleaned = (input ?? "").normalize("NFKC");

  if (ZERO_WIDTH.test(cleaned)) {
    cleaned = cleaned.replace(ZERO_WIDTH, "");
    flags.push("zero-width-stripped");
  }

  for (const pat of INJECTION_PATTERNS) {
    if (pat.test(cleaned)) {
      cleaned = cleaned.replace(pat, "[redacted]");
      flags.push(`pattern:${pat.source.slice(0, 32)}`);
    }
  }

  // Hard length cap regardless of validator
  if (cleaned.length > MAX_LEN) {
    cleaned = cleaned.slice(0, MAX_LEN);
    flags.push("length-capped");
  }

  return {
    cleaned: cleaned.trim(),
    modified: flags.length > 0,
    flags,
  };
}

/** SHA-256 hex of a string, using Web Crypto (works in Node 20+ and the Worker). */
export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
