// The Company request card (spec 0.7.1 5.2), the account company card (10) and Withdraw (5.1). The actions are
// stood in for (lib/companies/request.db.test.ts proves what they write).

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ withdraw: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));
vi.mock("@/app/(app)/request-company/actions", () => ({ withdrawCompanyRequestAction: mocks.withdraw, sendCompanyRequestAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import type { RequestCard as Data } from "@/lib/companies/request-reads";

import { AccountCompanyCard } from "./account-company-card";
import { RequestCard } from "./request-card";

beforeEach(() => vi.clearAllMocks());

const pending = (over: Partial<Data> = {}): Data => ({ id: "r1", name: "Acme", status: "pending", reason: null, thread: null, ...over });
const rejected = (over: Partial<Data> = {}): Data => ({ id: "r1", name: "Acme", status: "rejected", reason: "We could not verify it", thread: null, ...over });

describe("RequestCard", () => {
  it("says a waiting request is waiting for Liminal Bloom, with Withdraw and nothing else", () => {
    render(<RequestCard card={pending()} />);
    expect(screen.getByRole("heading", { name: "Company request" })).toBeInTheDocument();
    expect(screen.getByText(/Your request for/)).toHaveTextContent("Your request for Acme is waiting for Liminal Bloom.");
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links to the thread when Liminal Bloom asked a question", () => {
    render(<RequestCard card={pending({ thread: { id: "t1", answered: true } })} />);
    expect(screen.getByRole("link", { name: "Liminal Bloom asked a question." })).toHaveAttribute("href", "/help/t1");
  });

  it("links to the person's own messages when they wrote first and nobody has answered", () => {
    render(<RequestCard card={pending({ thread: { id: "t1", answered: false } })} />);
    expect(screen.getByRole("link", { name: "See your messages" })).toHaveAttribute("href", "/help/t1");
  });

  it("shows a rejection with the reason, Ask Liminal Bloom about the request, and Request again", () => {
    render(<RequestCard card={rejected()} />);
    expect(screen.getByText(/didn't approve/)).toHaveTextContent("Liminal Bloom didn't approve Acme: We could not verify it");
    expect(screen.getByRole("link", { name: "Ask Liminal Bloom" })).toHaveAttribute("href", "/help/new?kind=company_request&from=%2Frequest-company");
    expect(screen.getByRole("link", { name: "Request again" })).toHaveAttribute("href", "/request-company");
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
  });

  it("drops Request again on /request-company itself, where the form is right below", () => {
    render(<RequestCard card={rejected({ reason: null })} onRequestPage />);
    expect(screen.getByText(/didn't approve/)).toHaveTextContent("Liminal Bloom didn't approve Acme.");
    expect(screen.queryByRole("link", { name: "Request again" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ask Liminal Bloom" })).toBeInTheDocument();
  });
});

describe("Withdraw", () => {
  it("asks first, then withdraws this request and refreshes with no toast", async () => {
    mocks.withdraw.mockResolvedValue({ status: "done" });
    render(<RequestCard card={pending()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    const dialog = screen.getByRole("dialog", { name: "Withdraw this request?" });
    expect(dialog).toHaveTextContent("Liminal Bloom will no longer look at your request for Acme.");
    expect(mocks.withdraw).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Withdraw request" }));
    expect(mocks.withdraw).toHaveBeenCalledWith("r1");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("cancels without calling anything", async () => {
    render(<RequestCard card={pending()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.withdraw).not.toHaveBeenCalled();
  });

  it("toasts once when the server cannot be reached, and keeps the dialog open", async () => {
    mocks.withdraw.mockRejectedValue(new Error("offline"));
    render(<RequestCard card={pending()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    await user.click(screen.getByRole("button", { name: "Withdraw request" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Couldn't reach the server" })));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("AccountCompanyCard", () => {
  it("offers Request a company to a person in none", () => {
    render(<AccountCompanyCard standing={null} card={null} />);
    expect(screen.getByRole("heading", { name: "Company" })).toBeInTheDocument();
    expect(screen.getByText("You're not part of a company.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a company" })).toHaveAttribute("href", "/request-company");
  });

  it("names the company and the role, with Open company for the people who have the page", () => {
    render(<AccountCompanyCard standing={{ id: "c", name: "Acme", role: "regional_manager" }} card={null} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText(/Regional manager/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open company" })).toHaveAttribute("href", "/company");
    expect(screen.getByRole("link", { name: "Request a new company" })).toBeInTheDocument();
  });

  it("gives a person who only works in its stores no Open company link", () => {
    render(<AccountCompanyCard standing={{ id: "c", name: "Acme", role: "member" }} card={null} />);
    expect(screen.queryByRole("link", { name: "Open company" })).toBeNull();
    expect(screen.getByText(/Works in its stores/)).toBeInTheDocument();
  });

  it("offers an owner no request at all (they hand off first)", () => {
    render(<AccountCompanyCard standing={{ id: "c", name: "Acme", role: "owner" }} card={null} />);
    expect(screen.getByRole("link", { name: "Open company" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Request a/ })).toBeNull();
  });

  it("shows the request card instead of a Request link while one waits or was rejected", () => {
    const { unmount } = render(<AccountCompanyCard standing={null} card={pending()} />);
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Request a company" })).toBeNull();
    unmount();
    render(<AccountCompanyCard standing={null} card={rejected()} />);
    expect(screen.getByText(/didn't approve/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Request a company" })).toBeNull();
    expect(screen.getByRole("link", { name: "Request again" })).toBeInTheDocument();
  });
});
