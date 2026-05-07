import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DropImportZone } from "@/components/DropImportZone";

function makeFile(name: string, body: string): File {
  return new File([body], name, { type: "application/json" });
}

describe("DropImportZone", () => {
  it("is a keyboard-accessible button with descriptive label", () => {
    render(<DropImportZone onFiles={() => {}} />);
    const zone = screen.getByRole("button", { name: /drop backup json files/i });
    expect(zone.getAttribute("tabindex")).toBe("0");
  });

  it("invokes onFiles with dropped files", () => {
    const onFiles = vi.fn();
    render(<DropImportZone onFiles={onFiles} />);
    const zone = screen.getByRole("button", { name: /drop backup json files/i });
    const file = makeFile("a.json", "{}");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0][0].name).toBe("a.json");
  });

  it("Enter key opens the file picker", () => {
    render(<DropImportZone onFiles={() => {}} />);
    const zone = screen.getByRole("button", { name: /drop backup json files/i });
    const input = zone.parentElement?.querySelector("input[type=file]") as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    fireEvent.keyDown(zone, { key: "Enter" });
    expect(click).toHaveBeenCalled();
  });
});
