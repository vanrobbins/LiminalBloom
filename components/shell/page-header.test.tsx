import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ path: "/products" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => nav.path }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { PageHeader } from "./page-header";
import { ShellProvider, type ShellValue } from "./shell-context";

const user = { id: "u", name: "Van", email: "v@x.co" };
const two: ShellValue = { stores: [{ id: "a", name: "Pioneer Place" }, { id: "b", name: "Washington Square" }], activeStoreId: "a", user, switches: ["view"], isPlatformAdmin: false, helpReplies: 0 };
const one: ShellValue = { stores: [{ id: "a", name: "Pioneer Place" }], activeStoreId: "a", user, switches: ["view"], isPlatformAdmin: false, helpReplies: 0 };

describe("PageHeader", () => {
  it("draws one h1, the back links and the account menu", () => {
    render(
      <ShellProvider value={two}>
        <PageHeader title="Table 1" back={{ href: "/planograms", label: "Planograms" }} />
      </ShellProvider>,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Back to Planograms" })).toHaveAttribute("href", "/planograms");
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });

  it("shows the store line, plain text rather than a button, for someone in two stores", () => {
    render(
      <ShellProvider value={two}>
        <PageHeader title="Planograms" />
      </ShellProvider>,
    );
    expect(screen.getByText("Pioneer Place")).toHaveAttribute("data-store-current", "Pioneer Place");
    expect(screen.queryByRole("button", { name: /Pioneer Place/ })).not.toBeInTheDocument();
  });

  it("has no store line for someone in one store (council 10-10)", () => {
    render(
      <ShellProvider value={one}>
        <PageHeader title="Planograms" />
      </ShellProvider>,
    );
    expect(screen.queryByText("Pioneer Place")).not.toBeInTheDocument();
  });

  it("puts the search trigger just before the account menu, after the page's own actions, and only inside the shell", () => {
    const { unmount } = render(
      <ShellProvider value={two}>
        <PageHeader title="Table 1" actions={<button>History</button>} />
      </ShellProvider>,
    );
    const names = within(screen.getByRole("banner")).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent);
    expect(names.slice(0, 3)).toEqual(["History", "Search", "Account menu"]);
    unmount();
    render(<PageHeader title="Table 1" />);
    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
  });

  it("keeps a long title on one line, whole in its title attribute (Review Focus 1)", () => {
    const long = "Denim Wall · Bay 3 · Spring Reset North";
    render(<PageHeader title={long} />);
    const h1 = screen.getByRole("heading", { level: 1, name: long });
    expect(h1).toHaveAttribute("title", long);
  });

  // loading.tsx and the page each draw a header, so the one a sheet was opened from
  // is swapped for another when the page arrives (B7).
  it.each([["Account menu", "Van"]])("a sheet opened from %s stays open when the page replaces the loading header, and closes on navigation", async (trigger, sheet) => {
    nav.path = "/products";
    const user = userEvent.setup();
    const { rerender } = render(
      <ShellProvider value={two}>
        <PageHeader key="loading" title="Products" />
      </ShellProvider>,
    );
    await user.click(screen.getByRole("button", { name: trigger }));
    expect(screen.getByRole("dialog", { name: sheet })).toBeInTheDocument();

    rerender(
      <ShellProvider value={two}>
        <PageHeader key="page" title="Products" />
      </ShellProvider>,
    );
    expect(screen.getByRole("dialog", { name: sheet })).toBeInTheDocument();

    nav.path = "/layout";
    rerender(
      <ShellProvider value={two}>
        <PageHeader key="layout" title="Store layout" />
      </ShellProvider>,
    );
    expect(screen.queryByRole("dialog", { name: sheet })).not.toBeInTheDocument();
  });
});
