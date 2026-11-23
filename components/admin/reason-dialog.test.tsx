import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { ReasonDialog } from "./reason-dialog";

beforeEach(() => vi.clearAllMocks());

function open(run: (reason: string) => Promise<{ status: string }>, extra: Partial<React.ComponentProps<typeof ReasonDialog>> = {}) {
  const onClose = vi.fn();
  render(<ReasonDialog title="Pause Pioneer Place?" description="What will happen." confirm="Pause store" loadingText="Pausing…" run={run as never} onClose={onClose} {...extra} />);
  return { onClose, user: userEvent.setup() };
}
const confirm = () => screen.getByRole("button", { name: "Pause store" });

describe("ReasonDialog", () => {
  it("names the dialog and the field, and keeps the confirm off until a reason of 5 characters is typed", async () => {
    const { user } = open(vi.fn());
    expect(screen.getByRole("dialog", { name: "Pause Pioneer Place?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Reason")).toBeRequired();
    expect(confirm()).toBeDisabled();
    await user.type(screen.getByLabelText("Reason"), "abcd");
    expect(confirm()).toBeDisabled();
    await user.type(screen.getByLabelText("Reason"), "e");
    expect(confirm()).toBeEnabled();
  });

  it("does not run with a blank or spaces-only reason, even from the keyboard", async () => {
    const run = vi.fn();
    const { user } = open(run);
    await user.type(screen.getByLabelText("Reason"), "      {Enter}");
    expect(run).not.toHaveBeenCalled();
  });

  it("runs with the trimmed reason, then refreshes the page, closes and toasts when asked to", async () => {
    const run = vi.fn().mockResolvedValue({ status: "done" });
    const { user, onClose } = open(run, { doneToast: "Store paused." });
    await user.type(screen.getByLabelText("Reason"), "  Billing question  ");
    await user.click(confirm());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(run).toHaveBeenCalledWith("Billing question");
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({ tone: "success", title: "Store paused." });
  });

  it("makes no toast when none is given (the page reloading is the confirmation)", async () => {
    const { user, onClose } = open(vi.fn().mockResolvedValue({ status: "done" }));
    await user.type(screen.getByLabelText("Reason"), "Owner asked");
    await user.click(confirm());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("says a refusal inline and stays open; one that is final turns the confirm off and reloads the page on close", async () => {
    const { user, onClose } = open(vi.fn().mockResolvedValue({ status: "already" }), { messages: { already: "That store is already paused. Close and look again." } });
    await user.type(screen.getByLabelText("Reason"), "Owner asked");
    await user.click(confirm());
    expect(await screen.findByRole("status")).toHaveTextContent("That store is already paused. Close and look again.");
    expect(confirm()).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(mocks.refresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the confirm on after a refusal that is the person's to fix (the last admin)", async () => {
    const { user } = open(vi.fn().mockResolvedValue({ status: "last" }));
    await user.type(screen.getByLabelText("Reason"), "Owner asked");
    await user.click(confirm());
    expect(await screen.findByRole("status")).toHaveTextContent("That's the last admin. Add another first.");
    expect(confirm()).toBeEnabled();
  });

  it("says so when the network fails, and can be tried again", async () => {
    const { user } = open(vi.fn().mockRejectedValue(new Error("offline")));
    await user.type(screen.getByLabelText("Reason"), "Owner asked");
    await user.click(confirm());
    expect(await screen.findByRole("status")).toHaveTextContent("Couldn't save. Check your connection and try again.");
    expect(confirm()).toBeEnabled();
  });
});
