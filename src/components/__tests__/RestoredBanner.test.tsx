import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { RestoredBanner } from "@/components/RestoredBanner";

describe("RestoredBanner", () => {
  it("renders nothing when count is 0", () => {
    const { container } = render(
      <RestoredBanner count={0} onDismiss={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("uses singular copy for 1 draft", () => {
    render(<RestoredBanner count={1} onDismiss={() => {}} />);
    expect(
      screen.getByText(/1 draft restored from this browser/i)
    ).toBeTruthy();
  });

  it("uses plural copy for >1", () => {
    render(<RestoredBanner count={3} onDismiss={() => {}} />);
    expect(
      screen.getByText(/3 drafts restored from this browser/i)
    ).toBeTruthy();
  });

  it("has role=status for assistive tech", () => {
    render(<RestoredBanner count={2} onDismiss={() => {}} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("invokes onDismiss when the close button is clicked", () => {
    const onDismiss = vi.fn();
    render(<RestoredBanner count={2} onDismiss={onDismiss} />);
    fireEvent.click(
      screen.getByRole("button", { name: /dismiss restored drafts notice/i })
    );
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
