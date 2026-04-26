/**
 * Typed wrapper around the Lovable AI Gateway (OpenAI-compatible).
 * Server-only. Reads LOVABLE_API_KEY from process.env.
 *
 * Usage:
 *   const result = await callLovableAITool({ ... })
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface LovableAIError extends Error {
  status: number;
  retriable: boolean;
}

function makeError(message: string, status: number): LovableAIError {
  const e = new Error(message) as LovableAIError;
  e.status = status;
  e.retriable = status === 429 || status >= 500;
  return e;
}

export interface ToolCallRequest {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  tool: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
  /** seconds; default 25 */
  timeoutSec?: number;
}

/**
 * Calls the gateway with `tool_choice` forcing the named tool.
 * Returns the parsed tool arguments object.
 */
export async function callLovableAITool<T = unknown>(req: ToolCallRequest): Promise<T> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    throw makeError("LOVABLE_API_KEY is not configured", 500);
  }

  const controller = new AbortController();
  const timeoutMs = (req.timeoutSec ?? 25) * 1000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: req.model ?? "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: req.tool.name,
              description: req.tool.description,
              parameters: req.tool.parameters,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: req.tool.name } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        throw makeError("AI rate limit exceeded — try again shortly", 429);
      }
      if (res.status === 402) {
        throw makeError("AI credits exhausted — top up Lovable AI workspace credits", 402);
      }
      const body = await res.text().catch(() => "");
      console.error("Lovable AI gateway error", res.status, body.slice(0, 400));
      throw makeError(`AI gateway returned ${res.status}`, res.status);
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    };

    const call = json.choices?.[0]?.message?.tool_calls?.[0]?.function;
    if (!call?.arguments) {
      throw makeError("AI did not return a tool call", 502);
    }

    try {
      return JSON.parse(call.arguments) as T;
    } catch (e) {
      console.error("Failed to parse tool arguments:", call.arguments);
      throw makeError("AI returned malformed JSON arguments", 502);
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw makeError("AI request timed out", 504);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
