import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/products" }));

import { ShellProvider, useShellSheet, type ShellValue } from "@/components/shell/shell-context";

import { PaletteTrigger } from "./palette-trigger";

const value: ShellValue = { stores: [], activeStoreId: "s", user: { id: "u", name: "Van", email: "v@x.co" }, switches: ["view"] };

function Open() {
  const [open] = useShellSheet("palette");
  return <p>{open ? "palette open" : "palette closed"}</p>;
}
const draw = (variant: "sidebar" | "rail" | "header") =>
  render(
    <ShellProvider value={value}>
      <PaletteTrigger variant={variant} />
      <Open />
    </ShellProvider>,
  );

afterEach(() => vi.unstubAllGlobals());

describe("PaletteTrigger", () => {
  it.each(["sidebar", "rail", "header"] as const)("the %s trigger is named Search, announces the dialog and the shortcut, and opens the palette", async (variant) => {
    draw(variant);
    const button = screen.getByRole("button", { name: "Search" });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
    await userEvent.click(button);
    expect(screen.getByText("palette open")).toBeInTheDocument();
  });

  it("only the sidebar keeps the word Search and the shortcut hint; the others are icons", () => {
    const { unmount } = draw("sidebar");
    expect(screen.getByRole("button", { name: "Search" })).toHaveTextContent("Search");
    unmount();
    draw("rail");
    expect(screen.getByRole("button", { name: "Search" })).toHaveTextContent("");
  });

  it("the hint reads Ctrl K, and the symbol on a Mac, and is hidden from screen readers", () => {
    draw("sidebar");
    const hint = screen.getByText("Ctrl K");
    expect(hint).toHaveAttribute("aria-hidden", "true");
    vi.stubGlobal("navigator", { ...navigator, platform: "MacIntel", userAgent: "Macintosh" });
    document.body.innerHTML = "";
    draw("sidebar");
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("the server render has no hint, so nothing can mismatch", () => {
    const html = renderToString(
      <ShellProvider value={value}>
        <PaletteTrigger variant="sidebar" />
      </ShellProvider>,
    );
    expect(html).toContain("Search");
    expect(html).not.toContain("Ctrl");
    expect(html).not.toContain("⌘");
  });
});
