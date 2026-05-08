import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sanitizeUserPrompt } from "../_shared/prompt-guard.ts";
import { LOVABLE_AI_URL, aiHeaders, mapGatewayError } from "../_shared/lovable-ai.ts";

interface Body {
  text?: string;
  imageBase64?: string;
  mimeType?: string;
}

const SYSTEM = `You are an expert talent assessor focused on informal-economy skills in Sub-Saharan Africa.
Extract a structured skill profile from the user's portfolio evidence (text and/or image).
Be generous: recognise embedded business, customer-service, and quality-control skills inside trade work.
Return your answer ONLY by calling the extract_skills tool — never as plain text.`;

const TOOL = {
  type: "function",
  function: {
    name: "extract_skills",
    description: "Return a structured skill profile.",
    parameters: {
      type: "object",
      properties: {
        skills: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              category: {
                type: "string",
                enum: ["technical", "creative", "trade", "business", "interpersonal", "digital"],
              },
              proficiency: { type: "integer", minimum: 1, maximum: 10 },
              evidence: { type: "string" },
              marketRelevance: { type: "string" },
            },
            required: ["name", "category", "proficiency", "evidence"],
            additionalProperties: false,
          },
        },
        overallConfidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["skills", "overallConfidence"],
      additionalProperties: false,
    },
  },
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    const text = body.text ?? "";
    if (!text.trim() && !body.imageBase64) {
      return new Response(JSON.stringify({ error: "empty_input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guard = sanitizeUserPrompt(text);
    if (guard.flags.length > 0) {
      console.log("prompt-guard flags", guard.flags);
    }

    const userContent: Array<Record<string, unknown>> = [];
    if (guard.cleaned) userContent.push({ type: "text", text: guard.cleaned });
    if (body.imageBase64) {
      const mime = (body.mimeType || "image/jpeg").replace(/[^a-z0-9/+.-]/gi, "");
      // Cap base64 length to ~6MB raw (~8MB encoded) to avoid huge payloads.
      if (body.imageBase64.length > 9_000_000) {
        return new Response(JSON.stringify({ error: "image_too_large" }), {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${body.imageBase64}` },
      });
    }

    const upstream = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "extract_skills" } },
      }),
    });

    if (!upstream.ok) {
      console.error("upstream", upstream.status, await upstream.text().catch(() => ""));
      return mapGatewayError(upstream.status, corsHeaders);
    }

    const data = await upstream.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({ error: "no_tool_call" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch (e) {
      console.error("invalid tool args", e);
      return new Response(JSON.stringify({ error: "bad_tool_args" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, profile: parsed, guardFlags: guard.flags }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-skills-multimodal error", e);
    return new Response(
      JSON.stringify({ error: "internal", message: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
