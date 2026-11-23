// The ways into /company from the avatar menu and the store lists (spec 0.7.1 6.1, 11): shown to a company person,
// with the company's name on the foot link beside New store; absent for everyone else.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("@/app/(app)/switch-store-actions", () => ({ switchStore: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }));

import { UserMenu } from "./user-menu";

const PROPS = { user: { name: "Van", email: "van@example.com" }, stores: [{ id: "a", name: "Pioneer Place" }, { id: "b", name: "Washington Square" }], activeStoreId: "a" };

async function openDropdown(user: ReturnType<typeof userEvent.setup>) {
  screen.getByRole("button", { name: "Account menu" }).focus();
  await user.keyboard("{Enter}");
  return screen.findByRole("menu");
}

describe("UserMenu: Company", () => {
  it("is in the dropdown for a company person, going to /company", async () => {
    render(<UserMenu variant="rail" companyName="Acme" {...PROPS} />);
    await openDropdown(userEvent.setup());
    expect(screen.getByRole("menuitem", { name: "Company" })).toHaveAttribute("href", "/company");
  });

  it("is not in the dropdown for anyone else", async () => {
    render(<UserMenu variant="rail" {...PROPS} />);
    await openDropdown(userEvent.setup());
    expect(screen.queryByRole("menuitem", { name: "Company" })).toBeNull();
  });

  it("is in the phone sheet for a company person, and not for anyone else", async () => {
    const first = render(<UserMenu variant="sheet" companyName="Acme" {...PROPS} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Account menu" }));
    expect(await screen.findByRole("link", { name: "Company" })).toHaveAttribute("href", "/company");
    first.unmount();

    render(<UserMenu variant="sheet" {...PROPS} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Account menu" }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("link", { name: "Company" })).toBeNull();
  });
});

describe("the store lists' foot link", () => {
  it("names the company beside New store in the phone's list", async () => {
    render(<UserMenu variant="sheet" companyName="Acme" {...PROPS} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(await screen.findByRole("button", { name: /Switch store/ }));
    expect(screen.getByRole("link", { name: "New store" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acme" })).toHaveAttribute("href", "/company");
  });

  it("is not in the phone's list for someone with no company", async () => {
    render(<UserMenu variant="sheet" {...PROPS} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(await screen.findByRole("button", { name: /Switch store/ }));
    expect(screen.getByRole("link", { name: "New store" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Acme" })).toBeNull();
  });

  it("names the company beside New store in the dropdown's submenu", async () => {
    render(<UserMenu variant="rail" companyName="Acme" {...PROPS} />);
    const user = userEvent.setup();
    await openDropdown(user);
    await user.click(screen.getByRole("menuitem", { name: "Switch store" }));
    expect(await screen.findByRole("menuitem", { name: "Acme" })).toHaveAttribute("href", "/company");
    expect(screen.getByRole("menuitem", { name: "New store" })).toBeInTheDocument();
  });
});
