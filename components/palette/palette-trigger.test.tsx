import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/products" }));

import { ShellProvider, useShellSheet, type ShellValue } from "@/components/shell/shell-context";

import { PaletteTrigger } from "./palette-trigger";

const value: ShellValue = { stores: [], activeStoreId: "s", user: { id: "u", name: "Van", email: "v@x.co" }, switches: ["view"], isPlatformAdmin: false };

function Open() {
  const [open] = useShellSheet("palette");
  return <p>{open ? "palette open" : "palette closed"}</p>;
}
const draw = () =>
  render(
    <ShellProvider value={value}>
      <PaletteTrigger />
      <Open />
    </ShellProvider>,
  );

describe("PaletteTrigger", () => {
  it("is an icon named Search that announces the dialog and the shortcut, and opens the palette", async () => {
    draw();
    const button = screen.getByRole("button", { name: "Search" });
    expect(button).toHaveTextContent("");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
    await userEvent.click(button);
    expect(screen.getByText("palette open")).toBeInTheDocument();
  });
});
