import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sanitizeUserPrompt } from "../_shared/prompt-guard.ts";
import { LOVABLE_AI_URL, aiHeaders, mapGatewayError } from "../_shared/lovable-ai.ts";

interface Body {
  opportunity: { title: string; employer?: string; required_skills?: string[]; location?: string };
  personaSummary: string;
}

const SYSTEM = `You are a careful labour-market analyst. Explain in 2 short paragraphs (max ~120 words)
WHY a given person's skill profile matches an opportunity. Be honest about gaps. Cite the specific
required skills you saw evidence for. Avoid hype; do not invent qualifications.`;

const sseHeaders = {
  ...corsHeaders,
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    if (!body?.opportunity?.title || !body?.personaSummary) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const persona = sanitizeUserPrompt(body.personaSummary, 1500).cleaned;
    const opp = body.opportunity;

    const userText =
      `OPPORTUNITY\nTitle: ${opp.title}\nEmployer: ${opp.employer ?? "—"}\n` +
      `Location: ${opp.location ?? "—"}\nRequired skills: ${(opp.required_skills ?? []).join(", ")}\n\n` +
      `CANDIDATE PROFILE\n${persona}`;

    const upstream = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userText },
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      return mapGatewayError(upstream.status, corsHeaders);
    }

    return new Response(upstream.body, { status: 200, headers: sseHeaders });
  } catch (e) {
    console.error("match-explanation", e);
    return new Response(
      JSON.stringify({ error: "internal", message: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
