export const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export function aiHeaders() {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

/** Map an upstream gateway response to a structured error JSON Response. */
export function mapGatewayError(status: number, baseHeaders: HeadersInit) {
  if (status === 429) {
    return new Response(
      JSON.stringify({ error: "rate_limited", message: "Too many requests. Try again shortly." }),
      { status: 429, headers: { ...baseHeaders, "Content-Type": "application/json" } },
    );
  }
  if (status === 402) {
    return new Response(
      JSON.stringify({
        error: "payment_required",
        message: "AI credits exhausted. Add credits in Lovable workspace settings.",
      }),
      { status: 402, headers: { ...baseHeaders, "Content-Type": "application/json" } },
    );
  }
  return new Response(
    JSON.stringify({ error: "ai_gateway_error", status }),
    { status: 502, headers: { ...baseHeaders, "Content-Type": "application/json" } },
  );
}
