import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }), usePathname: () => "/products" }));
vi.mock("@/components/shell/use-theme-switch", () => ({ useThemeSwitch: () => ({ isMounted: true, target: "dark", switchTheme: vi.fn() }) }));
vi.mock("@/components/shell/use-switch-store", () => ({ useSwitchStore: () => ({ switchingTo: null, switchTo: vi.fn() }) }));

import { ShellProvider, useShellSheet, type ShellValue } from "@/components/shell/shell-context";

import { CommandPalette } from "./command-palette";

const index = { planograms: [{ fixtureId: "f1", name: "Denim Wall", zoneName: "Men", state: "Version 2", published: true }], zones: [] };
const found = { products: [{ id: "p1", name: "Navy Tee", styleNumber: "NT-104", status: "sold_out", place: "Denim Wall", more: 0, adjustFixtureId: "f1" }], total: 1 };

function Opener() {
  const [, setOpen] = useShellSheet("palette");
  return <button onClick={() => setOpen(true)}>Open palette</button>;
}
const draw = (switches: ShellValue["switches"]) =>
  render(
    <ShellProvider value={{ stores: [{ id: "s1", name: "Pioneer Place" }], activeStoreId: "s1", user: { id: "u1", name: "Van", email: "v@x.co" }, switches }}>
      <Opener />
      <CommandPalette />
      <main id="content" tabIndex={-1} />
    </ShellProvider>,
  );
const open = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Open palette" }));
  return screen.findByRole("combobox");
};
const reply = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

beforeEach(() => {
  mocks.push.mockReset();
  vi.stubGlobal("fetch", vi.fn((url: string) => (String(url).includes("products") ? reply(found) : reply(index))));
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("CommandPalette: Quick Adjust commands (0.7.0.9)", () => {
  it("offers Quick Adjust <fixture> and Adjust <product> to a drafter, and picking one opens the adjust page", async () => {
    draw(["view", "planograms.draft"]);
    await open();
    await userEvent.keyboard("adjust");
    expect(await screen.findByRole("option", { name: "Quick Adjust Denim Wall" })).toBeInTheDocument();
    await userEvent.keyboard("{Backspace>6/}navy");
    await userEvent.click(await screen.findByRole("option", { name: "Adjust Navy Tee" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
    expect(String(mocks.push.mock.calls[0][0])).toContain("/planograms/f1/adjust?product=p1");
  });

  it("offers neither without planograms.draft, even if the answers carried them", async () => {
    draw(["view", "planograms.publish"]);
    await open();
    await userEvent.keyboard("adjust");
    await waitFor(() => expect(screen.queryByText(/Searching|Loading/)).not.toBeInTheDocument());
    expect(screen.queryByRole("option", { name: /Quick Adjust|^Adjust / })).not.toBeInTheDocument();
  });
});
