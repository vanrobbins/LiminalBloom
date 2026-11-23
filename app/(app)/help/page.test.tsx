// The three Help pages: they guard with requireSignedIn, choose the frame from who is asking, and a thread that
// is not the person's is a 404.

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSignedIn: vi.fn(),
  listRequests: vi.fn(),
  getThread: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("@/lib/current-member", () => ({ requireSignedIn: mocks.requireSignedIn }));
vi.mock("@/lib/help/queries", () => ({ listRequests: mocks.listRequests, getThread: mocks.getThread }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, usePathname: () => "/help", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(app)/help/actions", () => ({ openHelpAction: vi.fn(), replyHelpAction: vi.fn(), closeHelpAction: vi.fn(), markSeenAction: vi.fn(async () => {}) }));
vi.mock("@/components/shell/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <header data-shell-header>{title}</header> }));
vi.mock("@/components/corner-theme-toggle", () => ({ CornerThemeToggle: () => null }));

import HelpThreadPage from "./[id]/page";
import NewHelpPage from "./new/page";
import HelpPage from "./page";

const USER = { id: "u1", name: "Van", email: "van@example.com" };
const MEMBER = { kind: "member", user: USER };
const NO_STORE = { kind: "no-store", user: USER };
const THREAD = { id: "t1", kind: "broken", status: "answered", unread: true, messages: [{ id: "m1", fromAdmin: false, body: "It will not open", createdAt: "2026-11-22T20:00:00.000Z" }, { id: "m2", fromAdmin: true, body: "Try again", createdAt: "2026-11-22T21:00:00.000Z" }] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSignedIn.mockResolvedValue(MEMBER);
  mocks.listRequests.mockResolvedValue([]);
});

describe("/help", () => {
  it("reads only the signed-in person's requests, in the shell for a member", async () => {
    render(await HelpPage());
    expect(mocks.listRequests).toHaveBeenCalledWith("u1");
    expect(document.querySelector("[data-shell-header]")).toHaveTextContent("Help");
    expect(screen.getByRole("link", { name: "Ask Liminal Bloom" })).toHaveAttribute("href", "/help/new");
  });

  it("draws the bare card for a person with no store", async () => {
    mocks.requireSignedIn.mockResolvedValue(NO_STORE);
    render(await HelpPage());
    expect(screen.getByRole("heading", { level: 1, name: "Help" })).toBeInTheDocument();
    expect(document.querySelector("[data-shell-header]")).toBeNull();
  });

  it("sends a signed-out visitor to sign in", async () => {
    mocks.requireSignedIn.mockRejectedValue(new Error("redirect:/sign-in"));
    await expect(HelpPage()).rejects.toThrow("redirect:/sign-in");
    expect(mocks.listRequests).not.toHaveBeenCalled();
  });
});

describe("/help/new", () => {
  it("preselects the kind from the address and keeps only a listed from", async () => {
    render(await NewHelpPage({ searchParams: Promise.resolve({ kind: "broken", from: "/paused" }) }));
    expect(screen.getByRole("radio", { name: "Something isn't working" })).toBeChecked();
  });

  it("falls back to Account for a kind it does not offer, such as company_request before 0.7.1b", async () => {
    render(await NewHelpPage({ searchParams: Promise.resolve({ kind: ["company_request"], from: "https://evil.example" }) }));
    expect(screen.getByRole("radio", { name: "Account or access" })).toBeChecked();
  });
});

describe("/help/[id]", () => {
  const open = (id = "t1") => HelpThreadPage({ params: Promise.resolve({ id }) });

  it("shows the thread for the signed-in person, signed You and Liminal Bloom, with a Reply field and Close", async () => {
    mocks.getThread.mockResolvedValue(THREAD);
    render(await open());
    expect(mocks.getThread).toHaveBeenCalledWith("u1", "t1");
    expect(screen.getByText("Liminal Bloom")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close request" })).toBeInTheDocument();
  });

  it("is a 404 when the thread is not theirs or does not exist", async () => {
    mocks.getThread.mockResolvedValue(null);
    await expect(open("someone-elses")).rejects.toThrow("notFound");
  });

  it("a closed thread says so, offers Ask again and takes no reply", async () => {
    mocks.getThread.mockResolvedValue({ ...THREAD, status: "closed", unread: false });
    render(await open());
    expect(screen.getByText("Closed. Ask again if you still need help.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask Liminal Bloom" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Reply" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close request" })).toBeNull();
  });
});
