// The avatar menu's "Liminal Bloom admin" link (spec 0.7.1 11): only for a Liminal Bloom admin, in the dropdown and the
// phone sheet. It is only a link: /admin re-reads the admin table on every request.

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

const PROPS = { user: { name: "Van", email: "van@example.com" }, stores: [{ id: "a", name: "Pioneer Place" }], activeStoreId: "a" };

async function openDropdown(user: ReturnType<typeof userEvent.setup>) {
  screen.getByRole("button", { name: "Account menu" }).focus();
  await user.keyboard("{Enter}");
  return screen.findByRole("menu");
}

describe("UserMenu: Liminal Bloom admin", () => {
  it("is in the dropdown for an admin, going to /admin", async () => {
    render(<UserMenu variant="rail" isPlatformAdmin {...PROPS} />);
    await openDropdown(userEvent.setup());
    expect(screen.getByRole("menuitem", { name: "Liminal Bloom admin" })).toHaveAttribute("href", "/admin");
  });

  it("is not in the dropdown for anyone else", async () => {
    render(<UserMenu variant="rail" {...PROPS} />);
    await openDropdown(userEvent.setup());
    expect(screen.queryByRole("menuitem", { name: "Liminal Bloom admin" })).toBeNull();
  });

  it("is in the phone sheet for an admin, and closes the sheet when followed", async () => {
    render(<UserMenu variant="sheet" isPlatformAdmin {...PROPS} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    const link = await screen.findByRole("link", { name: "Liminal Bloom admin" });
    expect(link).toHaveAttribute("href", "/admin");
  });

  it("is not in the phone sheet for anyone else", async () => {
    render(<UserMenu variant="sheet" {...PROPS} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Account menu" }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("link", { name: "Liminal Bloom admin" })).toBeNull();
  });
});
