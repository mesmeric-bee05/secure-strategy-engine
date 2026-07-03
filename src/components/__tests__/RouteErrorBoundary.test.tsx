/**
 * Integration test for RouteErrorBoundary's retry flow.
 *
 * Asserts that:
 *  1. Clicking "Retry" calls router.invalidate() and reset()
 *  2. A success toast is emitted when invalidate resolves
 *  3. A failure toast is emitted when invalidate rejects
 *  4. The error is logged to the audit trail on mount and on retry failure
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// ---- Mocks ----
const invalidate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));

const logErrorImpl = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => logErrorImpl,
}));

const toastSuccess = vi.fn<(message: string, opts?: unknown) => void>();
const toastError = vi.fn<(message: string, opts?: unknown) => void>();
const toastLoading = vi.fn<(message: string, opts?: unknown) => string>(() => "toast-id");
vi.mock("sonner", () => ({
  toast: {
    success: (message: string, opts?: unknown) => toastSuccess(message, opts),
    error: (message: string, opts?: unknown) => toastError(message, opts),
    loading: (message: string, opts?: unknown) => toastLoading(message, opts),
  },
}));

vi.mock("@/lib/server-fns/audit.functions", () => ({
  logClientError: vi.fn(),
}));

// Import AFTER mocks so the component picks them up.
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

beforeEach(() => {
  vi.clearAllMocks();
  invalidate.mockReset();
  logErrorImpl.mockReset().mockResolvedValue({ ok: true });
});

describe("RouteErrorBoundary retry flow", () => {
  it("logs the error on mount", async () => {
    const reset = vi.fn();
    render(
      <RouteErrorBoundary
        error={new Error("boom on load")}
        reset={reset}
        module="Skills Signal Engine"
      />,
    );
    await waitFor(() => {
      expect(logErrorImpl).toHaveBeenCalledTimes(1);
    });
    const call = logErrorImpl.mock.calls[0]?.[0] as {
      data: { module: string; message: string };
    };
    expect(call.data.module).toBe("Skills Signal Engine");
    expect(call.data.message).toBe("boom on load");
    expect(screen.getByText("boom on load")).toBeTruthy();
  });

  it("emits a success toast when retry succeeds", async () => {
    invalidate.mockResolvedValueOnce(undefined);
    const reset = vi.fn();

    render(
      <RouteErrorBoundary
        error={new Error("transient failure")}
        reset={reset}
        module="Skills Signal Engine"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ sync: true });
      expect(reset).toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalledWith(
        "Skills Signal Engine loaded",
        expect.objectContaining({ id: "toast-id" }),
      );
    });
  });

  it("shows technical details in development mode", async () => {
    const reset = vi.fn();
    render(
      <RouteErrorBoundary
        error={new Error("secret stack detail")}
        reset={reset}
        module="Skills Signal Engine"
      />
    );
    expect(screen.getByText(/Technical details/i)).toBeTruthy();
    expect(screen.getByText("secret stack detail")).toBeTruthy();
  });

  it("emits a failure toast and re-logs when retry fails", async () => {
    invalidate.mockRejectedValueOnce(new Error("still down"));
    const reset = vi.fn();

    render(
      <RouteErrorBoundary
        error={new Error("initial failure")}
        reset={reset}
        module="Skills Signal Engine"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("still down"),
        expect.objectContaining({ id: "toast-id" }),
      );
      // One log on mount + one on retry failure.
      expect(logErrorImpl).toHaveBeenCalledTimes(2);
    });
    expect(reset).not.toHaveBeenCalled();

    const retryLog = logErrorImpl.mock.calls[1]?.[0] as {
      data: { message: string };
    };
    expect(retryLog.data.message).toContain("retry_failed");
  });
});
