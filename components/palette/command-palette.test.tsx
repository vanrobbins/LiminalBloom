import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  switchTheme: vi.fn(),
  switchTo: vi.fn(),
  path: "/products",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }), usePathname: () => mocks.path }));
vi.mock("@/components/shell/use-theme-switch", () => ({ useThemeSwitch: () => ({ isMounted: true, target: "dark", switchTheme: mocks.switchTheme }) }));
vi.mock("@/components/shell/use-switch-store", () => ({ useSwitchStore: () => ({ switchingTo: null, switchTo: mocks.switchTo }) }));

import { ShellProvider, useShellSheet, type ShellValue } from "@/components/shell/shell-context";

import { CommandPalette } from "./command-palette";

const value: ShellValue = {
  stores: [{ id: "s1", name: "Pioneer Place" }, { id: "s2", name: "Washington Square" }],
  activeStoreId: "s1",
  user: { id: "u1", name: "Van", email: "v@x.co" },
  switches: ["view", "products.edit"],
};
const index = {
  planograms: [{ fixtureId: "f1", name: "Denim Wall", zoneName: "Men", state: "Draft" }],
  zones: [{ id: "00000000-0000-4000-8000-000000000001", name: "Women", fixtureCount: 3 }],
};
const found = { products: [{ id: "00000000-0000-4000-8000-0000000000aa", name: "Navy Tee", styleNumber: "NT-104", status: "sold_out", place: "Front table", more: 0 }], total: 1 };

function Opener() {
  const [, setOpen] = useShellSheet("palette");
  return <button onClick={() => setOpen(true)}>Open palette</button>;
}
const draw = () =>
  render(
    <ShellProvider value={value}>
      <Opener />
      <CommandPalette />
      <main id="content" tabIndex={-1} />
    </ShellProvider>,
  );
const open = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Open palette" }));
  return screen.findByRole("combobox");
};

const fetchMock = vi.fn();
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  mocks.push.mockReset();
  mocks.refresh.mockReset();
  mocks.switchTheme.mockReset();
  mocks.switchTo.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => (String(url).includes("products") ? reply(found) : reply(index)));
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("CommandPalette", () => {
  it("opens as the dialog 'Search the store' with the field focused and Go to and Actions listed", async () => {
    draw();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const field = await open();
    expect(screen.getByRole("dialog", { name: "Search the store" })).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(screen.getByRole("group", { name: "Go to" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Add product" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Roles and permissions" })).not.toBeInTheDocument();
  });

  it("Escape closes it and focus goes back to the opener", async () => {
    draw();
    await open();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Open palette" })).toHaveFocus();
  });

  it("Ctrl+K opens it and, from nothing focused, closing sends focus to #content", async () => {
    draw();
    await userEvent.keyboard("{Control>}k{/Control}");
    await screen.findByRole("combobox");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.getElementById("content")).toHaveFocus();
  });

  it("Ctrl+K again closes it, and it never opens over another modal", async () => {
    draw();
    await open();
    await userEvent.keyboard("{Control>}k{/Control}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const other = document.createElement("div");
    other.setAttribute("role", "dialog");
    document.body.append(other);
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    other.remove();
  });

  it("a planogram found in the index opens its page, closes, and focus goes to #content", async () => {
    draw();
    await open();
    await userEvent.keyboard("denim");
    await screen.findByRole("option", { name: /Denim Wall/ });
    await userEvent.keyboard("{Enter}");
    expect(mocks.push).toHaveBeenCalledWith("/planograms/f1");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.getElementById("content")).toHaveFocus();
  });

  it("a zone opens the map on it, with a fresh nonce so choosing it twice still re-applies", async () => {
    draw();
    await open();
    await userEvent.keyboard("women");
    await userEvent.click(await screen.findByRole("option", { name: /Women/ }));
    const href = String(mocks.push.mock.calls[0][0]);
    expect(href).toMatch(/^\/layout\?zone=00000000-0000-4000-8000-000000000001&n=[a-z0-9]+$/);
  });

  it("a product opens Products with its sheet, the same query and a nonce; All products has no nonce", async () => {
    draw();
    await open();
    await userEvent.keyboard("navy");
    await userEvent.click(await screen.findByRole("option", { name: /Navy Tee/ }));
    expect(String(mocks.push.mock.calls[0][0])).toMatch(/^\/products\?q=navy&open=00000000-0000-4000-8000-0000000000aa&n=[a-z0-9]+$/);
    await open();
    await userEvent.keyboard("navy");
    await userEvent.click(await screen.findByRole("option", { name: /All 1 products matching/ }));
    expect(mocks.push).toHaveBeenLastCalledWith("/products?q=navy");
  });

  it("the theme command switches in place and focus returns to the opener", async () => {
    draw();
    await open();
    await userEvent.click(screen.getByRole("option", { name: "Switch to dark theme" }));
    expect(mocks.switchTheme).toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Open palette" })).toHaveFocus();
  });

  it("another store's command switches stores in place", async () => {
    draw();
    await open();
    await userEvent.click(screen.getByRole("option", { name: "Switch to Washington Square" }));
    expect(mocks.switchTo).toHaveBeenCalledWith("s2");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("a 401 closes it and refreshes", async () => {
    fetchMock.mockImplementation(() => reply({}, 401));
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Open palette" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("starts empty on every open, and lists the last picks first when the field is empty", async () => {
    draw();
    await open();
    await userEvent.keyboard("{Escape}");
    await userEvent.type(await open(), "xyz");
    await userEvent.keyboard("{Escape}");
    expect(await open()).toHaveValue("");
    await userEvent.click(screen.getByRole("option", { name: "Products not placed" }));
    await open();
    const recent = screen.getByRole("group", { name: "Recent" });
    expect(recent).toHaveTextContent("Products not placed");
  });

  it("shows the index meanwhile and says when a product search fails, inline", async () => {
    fetchMock.mockImplementation((url: string) => (String(url).includes("products") ? Promise.reject(new TypeError("offline")) : reply(index)));
    draw();
    await open();
    await userEvent.keyboard("navy");
    expect(await screen.findByText(/Couldn.t search products/)).toBeVisible();
  });
});
