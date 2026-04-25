import { useState } from "react";
import { ChevronDown, BookOpen, ExternalLink } from "lucide-react";

export interface Citation {
  key: string;
  label: string;
  citation: string;
  url?: string;
  category: "labor" | "automation" | "education" | "skills" | "ai" | "data";
}

const CATEGORY_TONE: Record<Citation["category"], string> = {
  labor: "border-coral/40 bg-coral-soft text-coral",
  automation: "border-gold/40 bg-gold-soft text-gold",
  education: "border-teal/40 bg-teal-soft text-teal",
  skills: "border-lavender/40 bg-lavender-soft text-lavender",
  ai: "border-sky/40 bg-sky/10 text-sky",
  data: "border-emerald/40 bg-emerald/10 text-emerald",
};

export function CitationsPanel({
  title = "Data sources & citations",
  citations,
  defaultOpen = false,
}: {
  title?: string;
  citations: Citation[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!citations.length) return null;

  return (
    <section className="mt-8 rounded-xl border border-border-soft bg-bg-3/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-bg-3"
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-tx-1">
          <BookOpen className="h-3.5 w-3.5 text-gold" />
          {title}
          <span className="ml-1 rounded-full bg-bg-4 px-2 py-0.5 font-mono text-[10px] text-tx-2">
            {citations.length}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-tx-2 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
          {citations.map((c) => (
            <li
              key={c.key}
              className="rounded-lg border border-border-soft bg-bg-2 p-3"
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${CATEGORY_TONE[c.category]}`}
                >
                  {c.category}
                </span>
                <span className="text-[12px] font-semibold text-tx-0">
                  {c.label}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-tx-1">
                {c.citation}
              </p>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-gold hover:underline"
                >
                  Source
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CitationChip({
  label,
  title,
}: {
  label: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-3 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-tx-2"
    >
      <span className="h-1 w-1 rounded-full bg-gold" />
      {label}
    </span>
  );
}
