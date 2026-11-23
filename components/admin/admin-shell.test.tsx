import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/admin", signOut: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname, useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: mocks.signOut } }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }));

import { AdminShell } from "./admin-shell";

const ACCOUNT = { name: "Ada Admin", email: "ada@example.com" };

function shell() {
  return render(
    <AdminShell account={ACCOUNT}>
      <h1>Overview</h1>
    </AdminShell>,
  );
}

beforeEach(() => {
  mocks.pathname = "/admin";
  mocks.signOut.mockResolvedValue({ error: null });
});

describe("AdminShell", () => {
  it("draws the page inside main, behind a skip link", () => {
    shell();
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#content");
  });

  it("lists only the sections that are built, in the sidebar", () => {
    shell();
    const nav = screen.getByRole("navigation", { name: "Admin sections" });
    expect(within(nav).getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Overview", "/admin"],
      ["People", "/admin/people"],
      ["Stores", "/admin/stores"],
      ["Activity", "/admin/activity"],
      ["Admins", "/admin/admins"],
    ]);
  });

  it("marks the page shown, counting pages beneath it, and Overview only on /admin itself", () => {
    mocks.pathname = "/admin/stores/abc";
    shell();
    const nav = screen.getByRole("navigation", { name: "Admin sections" });
    expect(within(nav).getByRole("link", { name: "Stores" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("goes back to the app and signs out from the sidebar", async () => {
    shell();
    const side = screen.getByRole("complementary", { name: "Liminal Bloom admin" });
    expect(within(side).getByRole("link", { name: "Back to the app" })).toHaveAttribute("href", "/home");
    await userEvent.setup().click(within(side).getByRole("button", { name: "Sign out" }));
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/sign-in");
  });

  it("opens the sections from a Menu button in the top bar, with Back to the app and Sign out in it (phone sheet)", async () => {
    shell();
    // The sheet's button comes first and the dropdown's second: CSS shows one of them, jsdom has no CSS.
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Menu" })[0]);
    const sheet = await screen.findByRole("dialog", { name: "Liminal Bloom admin" });
    expect(within(sheet).getAllByRole("link").map((l) => l.textContent)).toEqual(["Overview", "People", "Stores", "Activity", "Admins", "Back to the app"]);
    expect(within(sheet).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("offers the same in a dropdown on a tablet", async () => {
    shell();
    const user = userEvent.setup();
    screen.getAllByRole("button", { name: "Menu" })[1].focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Overview", "People", "Stores", "Activity", "Admins", "Back to the app", "Switch to dark theme", "Sign out"]);
  });
});
