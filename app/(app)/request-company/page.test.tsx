// /request-company (spec 0.7.1 5.1, 9.3): guarded by requireSignedIn, framed by who is asking, and one of four
// things: the form (with the confirmation copy when in a company), a waiting request, a rejection above the form
// (so they can ask again), or the owner's "hand it off first".

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSignedIn: vi.fn(), card: vi.fn(), standing: vi.fn() }));
vi.mock("@/lib/current-member", () => ({ requireSignedIn: mocks.requireSignedIn }));
vi.mock("@/lib/companies/request-reads", () => ({ requestCardFor: mocks.card, standingCompanyOf: mocks.standing }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/(app)/request-company/actions", () => ({ sendCompanyRequestAction: vi.fn(), withdrawCompanyRequestAction: vi.fn() }));
vi.mock("@/components/shell/page-header", () => ({ PageHeader: ({ title, back }: { title: string; back?: { href: string } }) => <header data-shell-header data-back={back?.href}>{title}</header> }));

import RequestCompanyPage from "./page";

const USER = { id: "u1", name: "Van", email: "van@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSignedIn.mockResolvedValue({ kind: "member", user: USER });
  mocks.card.mockResolvedValue(null);
  mocks.standing.mockResolvedValue(null);
});

describe("/request-company", () => {
  it("guards with requireSignedIn, coming back here after sign-in, and reads only that person's own rows", async () => {
    render(await RequestCompanyPage());
    expect(mocks.requireSignedIn).toHaveBeenCalledWith("/request-company");
    expect(mocks.card).toHaveBeenCalledWith("u1");
    expect(mocks.standing).toHaveBeenCalledWith("u1");
  });

  it("shows the form in the shell's page for a member, with Account as the way back", async () => {
    render(await RequestCompanyPage());
    expect(document.querySelector("[data-shell-header]")).toHaveTextContent("Request a company");
    expect(document.querySelector("[data-shell-header]")).toHaveAttribute("data-back", "/account");
    expect(screen.getByLabelText("Company name")).toBeInTheDocument();
  });

  it("draws the bare card, with its own heading and a way back, for a person with no store", async () => {
    mocks.requireSignedIn.mockResolvedValue({ kind: "no-store", user: USER });
    render(await RequestCompanyPage());
    expect(screen.getByRole("heading", { level: 1, name: "Request a company" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/welcome");
    expect(screen.getByLabelText("Company name")).toBeInTheDocument();
  });

  it("shows only the waiting request, with Withdraw, while one is pending", async () => {
    mocks.card.mockResolvedValue({ id: "r1", name: "Acme", status: "pending", reason: null, thread: null });
    render(await RequestCompanyPage());
    expect(screen.getByText(/Your request for/)).toHaveTextContent("Acme");
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Company name")).toBeNull();
  });

  it("shows a rejection above the form, with Ask Liminal Bloom and no Request again link", async () => {
    mocks.card.mockResolvedValue({ id: "r1", name: "Acme", status: "rejected", reason: "Not verified", thread: null });
    render(await RequestCompanyPage());
    expect(screen.getByText(/didn't approve/)).toHaveTextContent("Not verified");
    expect(screen.getByRole("link", { name: "Ask Liminal Bloom" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Request again" })).toBeNull();
    expect(screen.getByLabelText("Company name")).toBeInTheDocument();
  });

  it("tells an owner to hand the company off first, with a link to Ownership, and no form", async () => {
    mocks.standing.mockResolvedValue({ id: "c", name: "Globex", role: "owner" });
    render(await RequestCompanyPage());
    expect(screen.getByText(/You own Globex\. Hand it to a corporate admin first\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Ownership" })).toHaveAttribute("href", "/company#ownership");
    expect(screen.queryByLabelText("Company name")).toBeNull();
  });

  it("gives a person in a company the form that asks before sending", async () => {
    mocks.standing.mockResolvedValue({ id: "c", name: "Globex", role: "corporate_admin" });
    render(await RequestCompanyPage());
    expect(screen.getByLabelText("Company name")).toBeInTheDocument();
  });
});
