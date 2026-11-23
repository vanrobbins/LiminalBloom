import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentMember: vi.fn(),
  replies: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("@/lib/current-member", () => ({ getCurrentMember: mocks.getCurrentMember }));
vi.mock("@/lib/help/badge", () => ({ helpRepliesFor: mocks.replies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));

import PausedPage from "./page";

const USER = { id: "u1", name: "Van", email: "van@example.com" };
const paused = (...names: string[]) => ({ kind: "paused", user: USER, stores: names.map((name, i) => ({ id: `s${i}`, name, kind: "store" })) });
const pausedRows = (...stores: { name: string; kind: "store" | "company" }[]) => ({ kind: "paused", user: USER, stores: stores.map((s, i) => ({ id: `r${i}`, ...s })) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.replies.mockResolvedValue(0);
});

describe("/paused", () => {
  it("says which store is paused and that nothing was deleted", async () => {
    mocks.getCurrentMember.mockResolvedValue(paused("Pioneer Place"));
    render(await PausedPage());
    expect(screen.getByRole("heading", { level: 1, name: "Your store is paused" })).toBeInTheDocument();
    expect(screen.getByText(/is paused by Liminal Bloom/)).toHaveTextContent("Pioneer Place is paused by Liminal Bloom. Nothing has been deleted.");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("says Liminal Bloom replied, linking to Help, only when there is a reply", async () => {
    mocks.getCurrentMember.mockResolvedValue(paused("Pioneer Place"));
    const { unmount } = render(await PausedPage());
    expect(screen.queryByText("Liminal Bloom replied.")).toBeNull();
    unmount();
    mocks.replies.mockResolvedValue(1);
    render(await PausedPage());
    expect(mocks.replies).toHaveBeenCalledWith("u1");
    expect(screen.getByText("Liminal Bloom replied.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read the reply" })).toHaveAttribute("href", "/help");
  });

  it("offers Ask Liminal Bloom, from /paused", async () => {
    mocks.getCurrentMember.mockResolvedValue(paused("Pioneer Place"));
    render(await PausedPage());
    expect(screen.getByRole("link", { name: "Ask Liminal Bloom" })).toHaveAttribute("href", "/help/new?kind=account&from=%2Fpaused");
  });

  it("lists several paused stores", async () => {
    mocks.getCurrentMember.mockResolvedValue(paused("Pioneer Place", "Washington Square"));
    render(await PausedPage());
    expect(screen.getByRole("heading", { level: 1, name: "Your stores are paused" })).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveTextContent("Pioneer Place");
    expect(screen.getByRole("list")).toHaveTextContent("Washington Square");
  });

  it("says a paused company is paused, not the store, with the company's name and that nothing was deleted", async () => {
    mocks.getCurrentMember.mockResolvedValue(pausedRows({ name: "Acme Coffee", kind: "company" }));
    render(await PausedPage());
    expect(screen.getByRole("heading", { level: 1, name: "Acme Coffee is paused" })).toBeInTheDocument();
    expect(screen.queryByText("Your store is paused")).toBeNull();
    expect(screen.getByText(/Liminal Bloom paused/)).toHaveTextContent("Liminal Bloom paused Acme Coffee. Nothing has been deleted.");
    expect(screen.getByRole("link", { name: "Ask Liminal Bloom" })).toHaveAttribute("href", "/help/new?kind=account&from=%2Fpaused");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("lists several paused companies as companies", async () => {
    mocks.getCurrentMember.mockResolvedValue(pausedRows({ name: "Acme Coffee", kind: "company" }, { name: "Birch Co", kind: "company" }));
    render(await PausedPage());
    expect(screen.getByRole("heading", { level: 1, name: "Your companies are paused" })).toBeInTheDocument();
    expect(screen.getByText("Liminal Bloom paused these companies. Nothing has been deleted.")).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveTextContent("Acme Coffee");
    expect(screen.getByRole("list")).toHaveTextContent("Birch Co");
  });

  it("lists a paused company beside a paused store, marking the company, under a heading that covers both", async () => {
    mocks.getCurrentMember.mockResolvedValue(pausedRows({ name: "Acme Coffee", kind: "company" }, { name: "Pioneer Place", kind: "store" }));
    render(await PausedPage());
    expect(screen.getByRole("heading", { level: 1, name: "Some of your access is paused" })).toBeInTheDocument();
    expect(screen.getByText("Liminal Bloom paused these. Nothing has been deleted.")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Acme Coffee (company)");
    expect(items[1]).toHaveTextContent("Pioneer Place");
    expect(items[1]).not.toHaveTextContent("(company)");
  });

  it.each([
    [{ kind: "signed-out" }, "/sign-in"],
    [{ kind: "no-store" }, "/welcome"],
    [{ kind: "member" }, "/home"],
    [{ kind: "needs-two-factor" }, "/account"],
  ])("sends %j to %s", async (current, path) => {
    mocks.getCurrentMember.mockResolvedValue(current);
    await expect(PausedPage()).rejects.toThrow(`redirect:${path}`);
  });
});
