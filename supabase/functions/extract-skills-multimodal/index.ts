import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sanitizeUserPrompt } from "../_shared/prompt-guard.ts";
import { LOVABLE_AI_URL, aiHeaders, mapGatewayError } from "../_shared/lovable-ai.ts";
import { validateExtractSkills, BadRequest } from "../_shared/validation.ts";
import { checkLimit } from "../_shared/rate-limit.ts";
import { logEvent, newRequestId } from "../_shared/logger.ts";
import { requireUser } from "../_shared/auth.ts";

const FN = "extract-skills-multimodal";
const MODEL = "google/gemini-2.5-pro";

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

function jsonResp(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const requestId = newRequestId();
  const started = performance.now();
  

  try {
    // Require authenticated caller — prevents anon-key abuse of AI credits.
    const auth = await requireUser(req);
    if (!auth.ok) {
      logEvent({ fn: FN, requestId, status: auth.status ?? 401, latencyMs: performance.now() - started, errorCode: auth.error ?? "unauthorized" });
      return jsonResp({ error: auth.error ?? "unauthorized" }, auth.status ?? 401);
    }
    const userId = auth.userId!;

    // Rate limit: per-user 10/min (falls back to IP for logging)
    const rl = await checkLimit({ bucket: "ai:extract", identifier: `u:${userId}`, limit: 10, windowSeconds: 60 });
    if (!rl.allowed) {
      logEvent({ fn: FN, requestId, status: 429, latencyMs: performance.now() - started, errorCode: "rate_limited", userId });
      return jsonResp({ error: "rate_limited", message: "Too many requests" }, 429);
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      logEvent({ fn: FN, requestId, status: 400, latencyMs: performance.now() - started, errorCode: "bad_json", userId });
      return jsonResp({ error: "bad_json" }, 400);
    }

    let clean;
    try { clean = validateExtractSkills(body); }
    catch (e) {
      const code = e instanceof BadRequest ? e.code : "validation";
      const msg = e instanceof Error ? e.message : "invalid";
      logEvent({ fn: FN, requestId, status: 400, latencyMs: performance.now() - started, errorCode: code, userId });
      return jsonResp({ error: code, message: msg }, 400);
    }

    const guard = sanitizeUserPrompt(clean.text);

    const userContent: Array<Record<string, unknown>> = [];
    if (guard.cleaned) userContent.push({ type: "text", text: guard.cleaned });
    if (clean.image) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${clean.image.mime};base64,${clean.image.base64}` },
      });
    }

    const upstream = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "extract_skills" } },
      }),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => "");
      logEvent({
        fn: FN, requestId, status: upstream.status, latencyMs: performance.now() - started,
        model: MODEL, userId, errorCode: "upstream", message: errBody.slice(0, 200),
      });
      return mapGatewayError(upstream.status, corsHeaders);
    }

    const data = await upstream.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      logEvent({ fn: FN, requestId, status: 502, latencyMs: performance.now() - started, model: MODEL, userId, errorCode: "no_tool_call" });
      return jsonResp({ error: "no_tool_call" }, 502);
    }

    let parsed: unknown;
    try { parsed = JSON.parse(call.function.arguments); }
    catch {
      logEvent({ fn: FN, requestId, status: 502, latencyMs: performance.now() - started, model: MODEL, userId, errorCode: "bad_tool_args" });
      return jsonResp({ error: "bad_tool_args" }, 502);
    }

    logEvent({
      fn: FN, requestId, status: 200, latencyMs: performance.now() - started, model: MODEL, userId,
      meta: { guardFlags: guard.flags.length, hasImage: !!clean.image },
    });
    return jsonResp({ ok: true, profile: parsed, guardFlags: guard.flags, requestId }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    logEvent({ fn: FN, requestId, status: 500, latencyMs: performance.now() - started, userId, errorCode: "internal", message: msg });
    return jsonResp({ error: "internal", requestId }, 500);
  }
});
