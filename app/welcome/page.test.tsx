import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  getSession: vi.fn(),
  waiting: vi.fn(),
  replies: vi.fn(),
  card: vi.fn<(id: string) => Promise<unknown>>(async () => null),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/current-member", () => ({ getCurrentMember: mocks.current }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/companies/request-reads", () => ({ requestCardFor: mocks.card }));
vi.mock("@/app/(app)/request-company/actions", () => ({ withdrawCompanyRequestAction: vi.fn() }));
vi.mock("@/lib/help/badge", () => ({ helpRepliesFor: mocks.replies }));
vi.mock("@/lib/access/invitation-look", () => ({ pendingInvitationsFor: mocks.waiting }));
vi.mock("@/app/invite/[id]/actions", () => ({ acceptInvitationAction: vi.fn() }));

import WelcomePage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.current.mockResolvedValue({ kind: "no-store" });
  mocks.getSession.mockResolvedValue({ user: { id: "u1", name: "Nia", email: "nia@example.test" } });
  mocks.waiting.mockResolvedValue([]);
  mocks.replies.mockResolvedValue(0);
  mocks.card.mockResolvedValue(null);
});

describe("WelcomePage", () => {
  it("sends a signed-out visitor to sign in and a person who has a store to Home", async () => {
    mocks.current.mockResolvedValue({ kind: "signed-out" });
    await expect(WelcomePage()).rejects.toThrow("redirect:/sign-in");
    mocks.current.mockResolvedValue({ kind: "member" });
    await expect(WelcomePage()).rejects.toThrow("redirect:/home");
  });

  it("sends a person whose role needs two-step sign-in to Account, which does not send them back here", async () => {
    mocks.current.mockResolvedValue({ kind: "needs-two-factor" });
    await expect(WelcomePage()).rejects.toThrow("redirect:/account");
  });

  it("sends a person whose stores are all paused to /paused, not to a welcome for people with no store", async () => {
    mocks.current.mockResolvedValue({ kind: "paused" });
    await expect(WelcomePage()).rejects.toThrow("redirect:/paused");
  });

  it("says Liminal Bloom replied, linking to Help, only when there is a reply for this person", async () => {
    const { unmount } = render(await WelcomePage());
    expect(screen.queryByText("Liminal Bloom replied.")).toBeNull();
    unmount();
    mocks.replies.mockResolvedValue(2);
    render(await WelcomePage());
    expect(mocks.replies).toHaveBeenCalledWith("u1");
    expect(screen.getByRole("link", { name: "Read the replies" })).toHaveAttribute("href", "/help");
  });

  it("offers a third choice, Request a company, until there is a request", async () => {
    render(await WelcomePage());
    expect(screen.getByRole("link", { name: "Request a company" })).toHaveAttribute("href", "/request-company");
  });

  it("shows the request card instead of the choice while a request is waiting, with Withdraw", async () => {
    mocks.card.mockResolvedValue({ id: "r1", name: "Acme", status: "pending", reason: null, thread: null });
    render(await WelcomePage());
    expect(screen.getByText(/Your request for/)).toHaveTextContent("Your request for Acme is waiting for Liminal Bloom.");
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Request a company" })).toBeNull();
  });

  it("shows a rejection with its reason, Ask Liminal Bloom about it and Request again", async () => {
    mocks.card.mockResolvedValue({ id: "r1", name: "Acme", status: "rejected", reason: "Not verified", thread: null });
    render(await WelcomePage());
    expect(screen.getByText(/didn't approve/)).toHaveTextContent("Liminal Bloom didn't approve Acme: Not verified");
    expect(screen.getByRole("link", { name: "Request again" })).toHaveAttribute("href", "/request-company");
    expect(screen.getAllByRole("link", { name: "Ask Liminal Bloom" }).map((l) => l.getAttribute("href"))).toContain("/help/new?kind=company_request&from=%2Frequest-company");
    expect(screen.queryByRole("link", { name: "Request a company" })).toBeNull();
  });

  it("offers Ask Liminal Bloom, from /welcome", async () => {
    render(await WelcomePage());
    expect(screen.getByRole("link", { name: "Ask Liminal Bloom" })).toHaveAttribute("href", "/help/new?kind=account&from=%2Fwelcome");
  });

  it("lists the invitations waiting for their email by store, role and expiry, and tells them to paste their link", async () => {
    // The ids are in the data here on purpose: nothing from them may reach the page, as text, link or button (the link is the secret, spec 4.9).
    mocks.waiting.mockResolvedValue([
      { id: "SECRET-ID-ONE", storeName: "Spring Street", roleName: "Sales Associate", expiresAt: "2026-11-13T23:40:00.000Z" },
      { id: "SECRET-ID-TWO", storeName: "Pioneer Place", roleName: "Visual Merchandising Worker", expiresAt: "2026-11-13T23:40:00.000Z" },
    ]);
    const { container } = render(await WelcomePage());
    expect(mocks.waiting).toHaveBeenCalledWith({ id: "u1", email: "nia@example.test" });
    expect(screen.getByRole("heading", { name: "Invitations for you" })).toBeInTheDocument();
    expect(screen.getByText("Spring Street")).toBeInTheDocument();
    expect(screen.getByText(/Visual Merchandising Worker role/)).toBeInTheDocument();
    expect(screen.getByText("Paste the invite link you were sent below to join.")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("SECRET-ID");
    // The only Accept is the paste form's, which takes a link and never carries an id.
    expect(screen.getAllByRole("button", { name: /accept/i })).toHaveLength(1);
    expect(screen.getByLabelText("Invite link or code")).toHaveValue("");
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/create-store", "/request-company", "/help/new?kind=account&from=%2Fwelcome"]);
  });

  it("says nothing is waiting, and still offers Create a store, when there are no invitations", async () => {
    render(await WelcomePage());
    expect(screen.queryByRole("heading", { name: "Invitations for you" })).toBeNull();
    expect(screen.getByText(/No invitations are waiting for nia@example.test/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a store" })).toHaveAttribute("href", "/create-store");
    expect(screen.getByLabelText("Invite link or code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
  });
});
