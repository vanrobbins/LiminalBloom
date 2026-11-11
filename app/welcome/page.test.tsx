import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  getSession: vi.fn(),
  waiting: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/current-member", () => ({ getCurrentMember: mocks.current }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/access/invitation-look", () => ({ pendingInvitationsFor: mocks.waiting }));
vi.mock("@/app/invite/[id]/actions", () => ({ acceptInvitationAction: vi.fn() }));

import WelcomePage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.current.mockResolvedValue({ kind: "no-store" });
  mocks.getSession.mockResolvedValue({ user: { id: "u1", name: "Nia", email: "nia@example.test" } });
  mocks.waiting.mockResolvedValue([]);
});

describe("WelcomePage", () => {
  it("sends a signed-out visitor to sign in and a person who has a store to products", async () => {
    mocks.current.mockResolvedValue({ kind: "signed-out" });
    await expect(WelcomePage()).rejects.toThrow("redirect:/sign-in");
    mocks.current.mockResolvedValue({ kind: "member" });
    await expect(WelcomePage()).rejects.toThrow("redirect:/products");
  });

  it("offers a person with no store the invitations waiting for their email, each with Accept, and Create a store", async () => {
    mocks.waiting.mockResolvedValue([
      { id: "i1", storeName: "Spring Street", roleName: "Sales Associate", expiresAt: "2026-11-13T23:40:00.000Z" },
      { id: "i2", storeName: "Pioneer Place", roleName: "Visual Merchandising Worker", expiresAt: "2026-11-13T23:40:00.000Z" },
    ]);
    render(await WelcomePage());
    expect(mocks.waiting).toHaveBeenCalledWith({ id: "u1", email: "nia@example.test" });
    expect(screen.getByRole("heading", { name: "Invitations for you" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept invitation to Spring Street" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept invitation to Pioneer Place" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a store" })).toHaveAttribute("href", "/create-store");
  });

  it("says nothing is waiting, and still offers Create a store, when there are no invitations", async () => {
    render(await WelcomePage());
    expect(screen.queryByRole("heading", { name: "Invitations for you" })).toBeNull();
    expect(screen.getByText(/No invitations are waiting for nia@example.test/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a store" })).toHaveAttribute("href", "/create-store");
  });
});
