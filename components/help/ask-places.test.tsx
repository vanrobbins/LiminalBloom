// "Ask Liminal Bloom" on the screens where people get stuck (spec 0.7.1 9.5, plan A9).

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/current-member", () => ({ requireMember: vi.fn(async () => ({ kind: "member" })) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/error", () => ({ catchError: (f: unknown) => f }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));

import { CardsFallback } from "@/components/home/cards-boundary";
import { InviteView } from "@/components/invite/invite-view";
import NoAccessPage from "@/app/(app)/no-access/page";

const ask = () => screen.getByRole("link", { name: "Ask Liminal Bloom" });

describe("Ask Liminal Bloom placements", () => {
  it("is on /no-access, from /no-access", async () => {
    render(await NoAccessPage());
    expect(ask()).toHaveAttribute("href", "/help/new?kind=account&from=%2Fno-access");
  });

  it.each(["missing", "used", "cancelled", "expired", "lapsed", "full", "wrong-email"] as const)("is on the %s invitation refusal, from /invite (no id)", (state) => {
    render(<InviteView id="abc" look={{ state, storeName: "Pioneer Place", roleName: "Sales Associate" } as never} signedInAs="a@b.co" />);
    expect(ask()).toHaveAttribute("href", expect.stringContaining("from=%2Finvite"));
    expect(ask().getAttribute("href")).not.toContain("abc");
  });

  it.each(["missing", "used", "expired"] as const)("sends a signed-out visitor on the %s refusal through sign-in to the form", (state) => {
    render(<InviteView id="abc" look={{ state, storeName: "P", roleName: "R" } as never} signedInAs={null} />);
    expect(ask()).toHaveAttribute("href", `/sign-in?next=${encodeURIComponent("/help/new?kind=account&from=%2Finvite")}`);
  });

  it("is on a refusal once, and not on already-member", () => {
    const { unmount } = render(<InviteView id="abc" look={{ state: "full", storeName: "P", roleName: "R" } as never} signedInAs="a@b.co" />);
    expect(screen.getAllByRole("link", { name: "Ask Liminal Bloom" })).toHaveLength(1);
    unmount();
    render(<InviteView id="abc" look={{ state: "already-member", storeName: "P", roleName: "R" } as never} signedInAs="a@b.co" />);
    expect(screen.queryByRole("link", { name: "Ask Liminal Bloom" })).toBeNull();
  });

  it("is not on an invitation that can be accepted", () => {
    render(<InviteView id="abc" look={{ state: "signed-out", storeName: "P", roleName: "R" } as never} signedInAs={null} />);
    expect(screen.queryByRole("link", { name: "Ask Liminal Bloom" })).toBeNull();
  });

  it("is under the Hub cards' error fallback", () => {
    const Fallback = CardsFallback as unknown as (p: object, i: { error: Error; retry: () => void }) => React.ReactElement;
    const Shown = () => Fallback({}, { error: new Error("x"), retry: vi.fn() });
    render(<Shown />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(ask()).toBeInTheDocument();
  });
});
