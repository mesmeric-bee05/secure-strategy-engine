import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sanitizeUserPrompt } from "../_shared/prompt-guard.ts";
import { LOVABLE_AI_URL, aiHeaders, mapGatewayError } from "../_shared/lovable-ai.ts";
import { validateExplain, BadRequest } from "../_shared/validation.ts";
import { checkLimit } from "../_shared/rate-limit.ts";
import { logEvent, newRequestId } from "../_shared/logger.ts";
import { requireUser } from "../_shared/auth.ts";

const FN = "match-explanation";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM = `You are a careful labour-market analyst. Explain in 2 short paragraphs (max ~120 words)
WHY a given person's skill profile matches an opportunity. Be honest about gaps. Cite the specific
required skills you saw evidence for. Avoid hype; do not invent qualifications.`;

const sseHeaders = {
  ...corsHeaders,
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

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

    const rl = await checkLimit({ bucket: "ai:explain", identifier: `u:${userId}`, limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      logEvent({ fn: FN, requestId, status: 429, latencyMs: performance.now() - started, errorCode: "rate_limited", userId });
      return jsonResp({ error: "rate_limited" }, 429);
    }

    let raw: unknown;
    try { raw = await req.json(); } catch {
      logEvent({ fn: FN, requestId, status: 400, latencyMs: performance.now() - started, errorCode: "bad_json", userId });
      return jsonResp({ error: "bad_json" }, 400);
    }

    let body;
    try { body = validateExplain(raw); }
    catch (e) {
      const code = e instanceof BadRequest ? e.code : "validation";
      logEvent({ fn: FN, requestId, status: 400, latencyMs: performance.now() - started, errorCode: code, userId });
      return jsonResp({ error: code, message: e instanceof Error ? e.message : "invalid" }, 400);
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
        model: MODEL,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userText },
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      logEvent({
        fn: FN, requestId, status: upstream.status, latencyMs: performance.now() - started,
        model: MODEL, userId, errorCode: "upstream",
      });
      return mapGatewayError(upstream.status, corsHeaders);
    }

    logEvent({ fn: FN, requestId, status: 200, latencyMs: performance.now() - started, model: MODEL, userId, meta: { streaming: true } });
    return new Response(upstream.body, { status: 200, headers: sseHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    logEvent({ fn: FN, requestId, status: 500, latencyMs: performance.now() - started, userId, errorCode: "internal", message: msg });
    return jsonResp({ error: "internal", requestId }, 500);
  }
});
