// The avatar menu's Help item and the reply dot (spec 0.7.1 9.2, 11): Help for everyone, with "· N replies" and
// a dot on the avatar only when Liminal Bloom has replied since the person last looked.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("@/app/(app)/switch-store-actions", () => ({ switchStore: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }));

import { helpLabel } from "@/lib/help/label";

import { UserMenu } from "./user-menu";

const PROPS = { user: { name: "Van", email: "van@example.com" }, stores: [{ id: "a", name: "Pioneer Place" }], activeStoreId: "a" };

describe("helpLabel", () => {
  it("is Help, then the count in words", () => {
    expect([0, 1, 3].map(helpLabel)).toEqual(["Help", "Help · 1 reply", "Help · 3 replies"]);
  });
});

describe("UserMenu: Help", () => {
  it("is in the dropdown for everyone, going to /help, with no dot when nothing is new", async () => {
    const { container } = render(<UserMenu variant="rail" {...PROPS} />);
    expect(container.querySelector("[data-help-dot]")).toBeNull();
    screen.getByRole("button", { name: "Account menu" }).focus();
    await userEvent.setup().keyboard("{Enter}");
    expect(await screen.findByRole("menuitem", { name: "Help" })).toHaveAttribute("href", "/help");
  });

  it("shows the reply count on the item and a dot on the avatar, whose name says so too", async () => {
    const { container } = render(<UserMenu variant="rail" helpReplies={2} {...PROPS} />);
    expect(container.querySelector("[data-help-dot]")).not.toBeNull();
    screen.getByRole("button", { name: "Account menu, 2 help replies" }).focus();
    await userEvent.setup().keyboard("{Enter}");
    expect(await screen.findByRole("menuitem", { name: "Help · 2 replies" })).toHaveAttribute("href", "/help");
  });

  it("is in the phone sheet too, with the count", async () => {
    render(<UserMenu variant="sheet" helpReplies={1} {...PROPS} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Account menu, 1 help reply" }));
    expect(await screen.findByRole("link", { name: "Help · 1 reply" })).toHaveAttribute("href", "/help");
  });
});
