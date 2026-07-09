import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// Mocks must be declared before the component import.
const getSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { MatchExplanation } from "@/components/MatchExplanation";
import { toast } from "sonner";

const opportunity = {
  title: "Junior electrician",
  employer: "Acme Ltd",
  location: "Nairobi",
  required_skills: ["wiring", "safety"],
};

function mockFetchStream() {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: {"choices":[{"delta":{"content":"ok"}}]}\n`));
      controller.enqueue(encoder.encode(`data: [DONE]\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("MatchExplanation auth contract", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    getSession.mockReset();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the signed-in user's bearer token when calling the edge function", async () => {
    getSession.mockResolvedValueOnce({ data: { session: { access_token: "test-jwt" } } });
    fetchSpy.mockResolvedValueOnce(mockFetchStream());

    render(<MatchExplanation opportunity={opportunity} personaSummary="Handy" />);
    await userEvent.click(screen.getByRole("button", { name: /explain match/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/functions\/v1\/match-explanation$/);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-jwt");
    expect(headers["Content-Type"]).toBe("application/json");
    // apikey header is set from the publishable key — must not be the user token
    expect(headers.apikey).toBeDefined();
    expect(headers.apikey).not.toBe("test-jwt");
  });

  it("does not call fetch when there is no session", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } });

    render(<MatchExplanation opportunity={opportunity} personaSummary="Handy" />);
    await userEvent.click(screen.getByRole("button", { name: /explain match/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/sign in/i)),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows a sign-in prompt on 401 from the edge function", async () => {
    getSession.mockResolvedValueOnce({ data: { session: { access_token: "stale" } } });
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 401 }));

    render(<MatchExplanation opportunity={opportunity} personaSummary="Handy" />);
    await userEvent.click(screen.getByRole("button", { name: /explain match/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/sign in/i)),
    );
  });
});
