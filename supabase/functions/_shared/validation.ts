// Lightweight zod-free request validation for edge functions.
// Keeps Deno cold-start light; mirrors the strict caps documented in the plan.

export interface ValidationError {
  code: string;
  message: string;
  status: number;
}

export class BadRequest extends Error {
  status = 400 as const;
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Magic-byte sniff on first ~16 bytes of decoded image. Returns null when unknown.
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  // WEBP: "RIFF"...."WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

export interface ExtractSkillsBody {
  text?: string;
  imageBase64?: string;
  mimeType?: string;
}

export interface ExtractSkillsClean {
  text: string;
  image: { mime: string; base64: string } | null;
}

const MAX_TEXT = 8_000;
const MAX_IMAGE_B64 = 6_000_000; // ~4.4 MB raw

export function validateExtractSkills(input: unknown): ExtractSkillsClean {
  if (!input || typeof input !== "object") throw new BadRequest("bad_body", "Body must be a JSON object");
  const b = input as ExtractSkillsBody;

  const text = typeof b.text === "string" ? b.text : "";
  if (text.length > MAX_TEXT) throw new BadRequest("text_too_long", `text exceeds ${MAX_TEXT} chars`);

  let image: { mime: string; base64: string } | null = null;
  if (b.imageBase64) {
    if (typeof b.imageBase64 !== "string") throw new BadRequest("bad_image", "imageBase64 must be a string");
    if (!/^[A-Za-z0-9+/=\s]+$/.test(b.imageBase64)) throw new BadRequest("bad_image", "imageBase64 not base64");
    if (b.imageBase64.length > MAX_IMAGE_B64) throw new BadRequest("image_too_large", "image exceeds size limit");
    const declared = (b.mimeType || "image/jpeg").toLowerCase();
    if (!ALLOWED_IMAGE_MIMES.has(declared)) throw new BadRequest("bad_mime", "unsupported mime type");

    let raw: Uint8Array;
    try {
      const bin = atob(b.imageBase64.replace(/\s+/g, "").slice(0, 64));
      raw = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
    } catch {
      throw new BadRequest("bad_image", "imageBase64 decode failed");
    }
    const sniffed = sniffImageMime(raw);
    if (!sniffed) throw new BadRequest("bad_image", "unrecognised image bytes");
    if (sniffed !== declared) throw new BadRequest("mime_mismatch", `declared ${declared} but bytes are ${sniffed}`);

    image = { mime: sniffed, base64: b.imageBase64.replace(/\s+/g, "") };
  }

  if (!text.trim() && !image) throw new BadRequest("empty_input", "Provide text or imageBase64");
  return { text, image };
}

export interface ExplainBody {
  opportunity: { title: string; employer?: string; required_skills?: string[]; location?: string };
  personaSummary: string;
}

export function validateExplain(input: unknown): ExplainBody {
  if (!input || typeof input !== "object") throw new BadRequest("bad_body", "Body must be JSON object");
  const b = input as Partial<ExplainBody>;
  if (!b.opportunity || typeof b.opportunity !== "object")
    throw new BadRequest("bad_body", "opportunity required");
  const opp = b.opportunity;
  if (typeof opp.title !== "string" || opp.title.length === 0 || opp.title.length > 300)
    throw new BadRequest("bad_opportunity", "opportunity.title invalid");
  if (opp.employer !== undefined && (typeof opp.employer !== "string" || opp.employer.length > 200))
    throw new BadRequest("bad_opportunity", "employer invalid");
  if (opp.location !== undefined && (typeof opp.location !== "string" || opp.location.length > 200))
    throw new BadRequest("bad_opportunity", "location invalid");
  if (opp.required_skills !== undefined) {
    if (!Array.isArray(opp.required_skills) || opp.required_skills.length > 50)
      throw new BadRequest("bad_opportunity", "required_skills invalid");
    for (const s of opp.required_skills) {
      if (typeof s !== "string" || s.length > 100)
        throw new BadRequest("bad_opportunity", "required_skills item invalid");
    }
  }
  if (typeof b.personaSummary !== "string" || b.personaSummary.length === 0 || b.personaSummary.length > 4_000)
    throw new BadRequest("bad_persona", "personaSummary invalid");
  return b as ExplainBody;
}
