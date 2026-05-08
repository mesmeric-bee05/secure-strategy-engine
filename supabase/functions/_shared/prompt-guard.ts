/**
 * Server-side mirror of src/lib/security/prompt-guard.ts so edge functions
 * never forward raw user input to the model.
 */
const INJECTION_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "ignore_prior", re: /ignore\s+(?:previous|prior|above|all)\s+(?:instructions?|prompts?|rules?)/gi },
  { name: "disregard_prior", re: /disregard\s+(?:previous|prior|above|all)\s+(?:instructions?|prompts?|rules?)/gi },
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
const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

export interface GuardResult {
  cleaned: string;
  modified: boolean;
  flags: string[];
}

export function sanitizeUserPrompt(input: string, maxLen = 4000): GuardResult {
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
  if (cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen);
    flags.push("length-capped");
  }
  return { cleaned: cleaned.trim(), modified: flags.length > 0, flags };
}
