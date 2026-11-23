// Approve, Reject and Ask a question on an admin's company request page (spec 0.7.1 5.3, 12). The actions are
// stood in for (lib/companies/*.db.test.ts proves what they write); what is checked here is that each sends
// the version the admin looked at, toasts as R2 says, and shows a refusal where the admin is looking.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ approve: vi.fn(), reject: vi.fn(), ask: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));
vi.mock("@/app/admin/requests/actions", () => ({ approveRequestAction: mocks.approve, rejectRequestAction: mocks.reject, askQuestionAction: mocks.ask }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { ApproveRequest, AskQuestionForm, RejectRequest } from "./request-actions";

beforeEach(() => vi.clearAllMocks());

const target = { id: "r1", version: 4, name: "Acme", requesterName: "Rita Requester" };

describe("ApproveRequest", () => {
  it("says who becomes the owner, takes a reason, sends the version and toasts", async () => {
    mocks.approve.mockResolvedValue({ status: "done" });
    render(<ApproveRequest {...target} leaving={null} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve Acme?" });
    expect(dialog).toHaveTextContent("Rita Requester becomes the owner of Acme.");
    expect(dialog).not.toHaveTextContent("They leave");
    await user.type(within(dialog).getByLabelText("Reason"), "Checked their website");
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));
    expect(mocks.approve).toHaveBeenCalledWith("r1", 4, "Checked their website");
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ tone: "success", title: "Company approved." }));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("warns that the person leaves the company they are in, and keeps standalone stores", async () => {
    render(<ApproveRequest {...target} leaving="Globex" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("They leave Globex and lose access to its stores and people; any store of their own stays theirs.");
  });

  it("shows a taken company name inline, and no toast", async () => {
    mocks.approve.mockResolvedValue({ status: "slug-taken" });
    render(<ApproveRequest {...target} leaving={null} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.type(screen.getByLabelText("Reason"), "Looks fine");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("A company with that name already exists. Reject, or ask them to rename.")).toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});

describe("RejectRequest", () => {
  it("says the reason is shown to the person, sends the version and toasts", async () => {
    mocks.reject.mockResolvedValue({ status: "done" });
    render(<RejectRequest {...target} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog", { name: "Reject Acme?" });
    expect(within(dialog).getByText("Shown to the person who asked. 5 to 500 characters.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Reason"), "Not a chain we can verify");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));
    expect(mocks.reject).toHaveBeenCalledWith("r1", 4, "Not a chain we can verify");
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ tone: "success", title: "Request rejected." }));
  });

  it("says a request already decided is out of date, and turns the confirm off", async () => {
    mocks.reject.mockResolvedValue({ status: "already" });
    render(<RejectRequest {...target} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(screen.getByLabelText("Reason"), "Not a chain we can verify");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("That has already changed. Close and look again.")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Reject" })).toBeDisabled();
  });
});

describe("AskQuestionForm", () => {
  it("sends the question for this request as Liminal Bloom, clears the field and announces it", async () => {
    mocks.ask.mockResolvedValue({ status: "done" });
    render(<AskQuestionForm id="r1" requesterName="Rita Requester" hasThread={false} />);
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Send question" })).toBeDisabled();
    expect(screen.getByText(/They never see your name/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Ask a question" }), "How many stores?");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(mocks.ask).toHaveBeenCalledWith("r1", "How many stores?");
    expect(await screen.findByRole("status")).toHaveTextContent("Question sent.");
    expect(screen.getByRole("textbox", { name: "Ask a question" })).toHaveValue("");
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("is labelled for a follow-up when a thread is open", () => {
    render(<AskQuestionForm id="r1" requesterName="Rita Requester" hasThread />);
    expect(screen.getByRole("textbox", { name: "Ask another question" })).toBeInTheDocument();
  });

  it("shows a decided request's refusal beside the field and reloads", async () => {
    mocks.ask.mockResolvedValue({ status: "not-pending" });
    render(<AskQuestionForm id="r1" requesterName="Rita Requester" hasThread={false} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Hello?");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(await screen.findByText("That request has been decided. Close and look again.")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("says when the server cannot be reached, keeping what was typed", async () => {
    mocks.ask.mockRejectedValue(new Error("offline"));
    render(<AskQuestionForm id="r1" requesterName="Rita Requester" hasThread={false} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "Hello?");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(await screen.findByText(/connection|reach/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Hello?");
  });
});
