import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { extractSkillsMultimodal, type ExtractedProfile, AiQuotaError } from "@/lib/ai/extract-skills";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];

// Magic-byte check (defence in depth — don't trust file.type alone).
async function detectImageMime(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
  ) return "image/png";
  // RIFF????WEBP
  if (
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) return "image/webp";
  return null;
}

async function resizeToBase64(file: File, maxDim = 1024): Promise<{ b64: string; mime: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  // Re-encode strips EXIF (incl. GPS) by construction.
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
  return { b64: btoa(bin), mime: "image/jpeg" };
}

export interface ImagePortfolioUploadProps {
  onProfile: (profile: ExtractedProfile) => void;
  contextText?: string;
}

export function ImagePortfolioUpload({ onProfile, contextText }: ImagePortfolioUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("Image is larger than 4 MB.");
      return;
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      toast.error("Use JPEG, PNG, or WebP.");
      return;
    }
    const mime = await detectImageMime(file);
    if (!mime) {
      toast.error("File doesn't look like a real image.");
      return;
    }
    setBusy(true);
    try {
      const { b64, mime: outMime } = await resizeToBase64(file);
      const profile = await extractSkillsMultimodal({
        text: contextText,
        imageBase64: b64,
        mimeType: outMime,
      });
      onProfile(profile);
      toast.success(`Extracted ${profile.skills.length} skills`);
    } catch (e) {
      if (e instanceof AiQuotaError) {
        toast.error(e.message);
      } else {
        toast.error((e as Error).message || "Extraction failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-bg-3 px-3 py-1.5 text-[11px] font-medium text-tx-1 transition hover:border-gold-glow hover:text-gold disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ImageIcon className="h-3.5 w-3.5" />
        )}
        Upload work-sample image
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handle(f);
          e.target.value = "";
        }}
      />
      <p className="mt-1 text-[10px] text-tx-2">
        Max 4 MB. JPG/PNG/WebP. Image is re-encoded locally to strip EXIF (location) before upload.
      </p>
    </div>
  );
}
