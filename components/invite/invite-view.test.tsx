import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/invite/[id]/actions", () => ({ acceptInvitationAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import type { InvitationState } from "@/lib/access/invitation-look";

import { InviteView } from "./invite-view";

const named = { storeName: "Spring Street", roleName: "Sales Associate" };
const show = (look: InvitationState, signedInAs: string | null = null) => render(<InviteView id="abc123" look={look} signedInAs={signedInAs} />);

describe("InviteView", () => {
  it("offers a signed-out visitor sign in and create account, each returning to this invitation, and no Accept", () => {
    show({ state: "signed-out", ...named });
    expect(screen.getByRole("heading", { level: 1, name: "Join Spring Street" })).toBeInTheDocument();
    expect(screen.getByText(/You're invited to join/)).toHaveTextContent("You're invited to join Spring Street as Sales Associate.");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in?next=%2Finvite%2Fabc123");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/sign-up?next=%2Finvite%2Fabc123");
    expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
  });

  it("offers Accept to the invited person, saying which account is signed in", () => {
    show({ state: "ready", ...named }, "nia@example.test");
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeInTheDocument();
    expect(screen.getByText("You're signed in as nia@example.test.")).toBeInTheDocument();
  });

  it.each([
    ["wrong-email", /different email address/],
    ["expired", /has expired/],
    ["already-member", /already in Spring Street/],
    ["full", /has 100 people/],
  ] as const)("gives one plain message and no Accept for %s", (state, message) => {
    show({ state, ...named }, "nia@example.test");
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
  });

  it("lets someone with the wrong email sign in as another account, and a member go to products", () => {
    const { unmount } = show({ state: "wrong-email", ...named }, "nia@example.test");
    expect(screen.getByRole("link", { name: "Sign in with another account" })).toHaveAttribute("href", "/sign-in?next=%2Finvite%2Fabc123");
    unmount();
    show({ state: "already-member", ...named }, "nia@example.test");
    expect(screen.getByRole("link", { name: "Go to products" })).toHaveAttribute("href", "/products");
  });

  it.each([
    ["missing", /isn't valid/],
    ["used", /already used/],
    ["cancelled", /was cancelled/],
  ] as const)("names no store for %s", (state, message) => {
    show({ state });
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(document.body.textContent).not.toContain("Spring Street");
  });
});
