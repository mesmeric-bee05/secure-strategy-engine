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

interface InjectionPattern {
  /** Stable name used in audit-log flags. NEVER include user text here. */
  name: string;
  re: RegExp;
}

const INJECTION_PATTERNS: readonly InjectionPattern[] = [
  {
    name: "ignore_prior",
    re: /ignore\s+(?:previous|prior|above|all)\s+(?:instructions?|prompts?|rules?)/gi,
  },
  {
    name: "disregard_prior",
    re: /disregard\s+(?:previous|prior|above|all)\s+(?:instructions?|prompts?|rules?)/gi,
  },
  { name: "forget_prior", re: /forget\s+(?:everything|all|previous|prior)\b/gi },
  { name: "you_are_now", re: /you\s+are\s+now\s+(?:a|an|the)?/gi },
  { name: "act_as", re: /act\s+as\s+(?:a|an|the)\s+/gi },
  { name: "pretend_to_be", re: /pretend\s+to\s+be\s+/gi },
  { name: "jailbreak", re: /jailbreak/gi },
  { name: "system_prompt", re: /system\s+prompt/gi },
  { name: "inst_tag", re: /\[\s*INST\s*\]/gi },
  { name: "system_tag", re: /\[\s*\/?\s*SYSTEM\s*\]/gi },
  { name: "chatml_tag", re: /<\|.*?\|>/g },
  { name: "instruction_heading", re: /###\s*(?:instruction|system|new\s+instructions?)/gi },
  { name: "developer_mode", re: /developer\s+mode/gi },
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

  for (const { name, re } of INJECTION_PATTERNS) {
    if (re.test(cleaned)) {
      cleaned = cleaned.replace(re, "[redacted]");
      flags.push(`pattern:${name}`);
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
