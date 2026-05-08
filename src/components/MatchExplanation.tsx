import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface OpportunityForExplain {
  title: string;
  employer?: string | null;
  required_skills?: string[];
  location?: string | null;
}

export interface MatchExplanationProps {
  opportunity: OpportunityForExplain;
  personaSummary: string;
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-explanation`;
const PUB_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function MatchExplanation({ opportunity, personaSummary }: MatchExplanationProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run() {
    setOpen(true);
    if (text || loading) return;
    setLoading(true);
    setText("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PUB_KEY}`,
        },
        body: JSON.stringify({
          opportunity: {
            title: opportunity.title,
            employer: opportunity.employer ?? undefined,
            required_skills: opportunity.required_skills ?? [],
            location: opportunity.location ?? undefined,
          },
          personaSummary,
        }),
        signal: ctrl.signal,
      });

      if (resp.status === 429) {
        toast.error("Rate limited — try again shortly.");
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("AI credits exhausted. Add credits in workspace settings.");
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) {
        toast.error("Couldn't generate explanation.");
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            done = true;
            break;
          }
          try {
            const j = JSON.parse(payload);
            const delta = j.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              acc += delta;
              setText(acc);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error("Explanation failed.");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={run}
        className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold-soft px-2 py-1 text-[10.5px] font-semibold text-gold transition hover:bg-gold/20"
        aria-expanded={open}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        Explain match
      </button>
      {open && (
        <p
          aria-live="polite"
          className="mt-2 whitespace-pre-wrap rounded-md border border-border-soft bg-bg-2 p-2 text-[11px] leading-relaxed text-tx-1"
        >
          {text || (loading ? "Thinking…" : "")}
        </p>
      )}
    </div>
  );
}
