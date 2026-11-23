// The request form (spec 0.7.1 5.1): the name rule, the confirmation in the hand-off's words for a person in a
// company, a refusal under the field, and the refresh into the waiting card. The action is stood in for.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));
vi.mock("@/app/(app)/request-company/actions", () => ({ sendCompanyRequestAction: mocks.send, withdrawCompanyRequestAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { RequestForm } from "./request-form";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ status: "done", id: "r1" });
});

describe("RequestForm with no company", () => {
  it("needs a name of 2 to 60 characters before Send request turns on", async () => {
    render(<RequestForm currentCompany={null} />);
    const user = userEvent.setup();
    const send = screen.getByRole("button", { name: "Send request" });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("Company name"), "A");
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("Company name"), "c");
    expect(send).toBeEnabled();
    expect(screen.getByLabelText("Company name")).toHaveAttribute("maxlength", "60");
  });

  it("sends the name as typed (the server cleans it) with no confirmation, then refreshes", async () => {
    render(<RequestForm currentCompany={null} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Company name"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.send).toHaveBeenCalledWith("Acme Corp");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("says under the field that a request is already waiting, and refreshes into it", async () => {
    mocks.send.mockResolvedValue({ status: "pending" });
    render(<RequestForm currentCompany={null} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Company name"), "Acme");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText("You already have a request waiting. Withdraw it first to send a new one.")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("says under the field that an owner hands off first", async () => {
    mocks.send.mockResolvedValue({ status: "owner" });
    render(<RequestForm currentCompany={null} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Company name"), "Acme");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText("You own a company. Hand it to a corporate admin first.")).toBeInTheDocument();
  });

  it("shows the name refusal without refreshing", async () => {
    mocks.send.mockResolvedValue({ status: "invalid-name" });
    render(<RequestForm currentCompany={null} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Company name"), "Acme");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText("Use 2 to 60 characters.")).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("toasts once when the server cannot be reached", async () => {
    mocks.send.mockRejectedValue(new Error("offline"));
    render(<RequestForm currentCompany={null} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Company name"), "Acme");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error" })));
  });
});

describe("RequestForm for a person in a company", () => {
  it("asks first, in the hand-off's words with both names, and sends only on Send request in the dialog", async () => {
    render(<RequestForm currentCompany="Globex" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Company name"), "  Acme   Corp ");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    const dialog = screen.getByRole("dialog", { name: "Request a new company?" });
    expect(dialog).toHaveTextContent("Requesting Acme Corp will move you out of Globex once Liminal Bloom approves it. You will become the owner of Acme Corp and will lose access to Globex's stores and people. Other corporate admins can add you back later.");
    expect(mocks.send).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));
    expect(mocks.send).toHaveBeenCalledWith("  Acme   Corp ");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("Cancel sends nothing and closes the dialog", async () => {
    render(<RequestForm currentCompany="Globex" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Company name"), "Acme");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
