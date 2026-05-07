import { useRef, useState } from "react";
import { Upload } from "lucide-react";

export interface DropImportZoneProps {
  onFiles: (files: File[]) => void;
}

/**
 * Keyboard-accessible drag-and-drop zone for backup files.
 * Delegates validation/staging to the parent (same pipeline as the file picker).
 */
export function DropImportZone({ onFiles }: DropImportZoneProps) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div className="mb-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop backup JSON files here, or press Enter to choose files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-[11px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-glow ${
          over
            ? "border-gold bg-gold-soft/30 text-gold"
            : "border-border-strong bg-bg-3 text-tx-2 hover:border-gold-glow hover:text-tx-1"
        }`}
      >
        <Upload className="h-3 w-3" aria-hidden="true" />
        Drop backup JSON files here, or press Enter to choose
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
