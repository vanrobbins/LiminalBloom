// Reply, Close and the seen mark: the three client pieces of a thread.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reply: vi.fn(), close: vi.fn(), seen: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));
vi.mock("@/app/(app)/help/actions", () => ({ replyHelpAction: mocks.reply, closeHelpAction: mocks.close, markSeenAction: mocks.seen }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { CloseButton } from "./close-button";
import { ReplyForm } from "./reply-form";
import { SeenMark } from "./seen-mark";

beforeEach(() => vi.clearAllMocks());

describe("ReplyForm", () => {
  it("sends the reply for this thread, clears the field and refreshes the thread", async () => {
    mocks.reply.mockResolvedValue({ status: "done" });
    render(<ReplyForm id="t1" sticky={false} />);
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Reply" }), "Still stuck");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(mocks.reply).toHaveBeenCalledWith("t1", "Still stuck");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("");
  });

  it("says a full thread is full, beside the field, without a toast", async () => {
    mocks.reply.mockResolvedValue({ status: "too-many-messages" });
    render(<ReplyForm id="t1" sticky />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Reply" }), "one more");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("textbox", { name: "Reply" })).toHaveAccessibleDescription(/This thread is full/);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("a lost connection is a toast and keeps the text", async () => {
    mocks.reply.mockRejectedValue(new Error("offline"));
    render(<ReplyForm id="t1" sticky={false} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Reply" }), "text");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("text");
  });
});

describe("CloseButton", () => {
  it("asks first, and closes nothing until confirmed", async () => {
    render(<CloseButton id="t1" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Close request" }));
    expect(await screen.findByRole("dialog", { name: "Close this request?" })).toBeInTheDocument();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it("closes the thread on confirm and refreshes to the closed view", async () => {
    mocks.close.mockResolvedValue({ status: "done" });
    render(<CloseButton id="t1" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close request" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(dialog.querySelector("button:not([aria-label])") as HTMLElement);
    expect(mocks.close).toHaveBeenCalledWith("t1");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });
});

describe("SeenMark", () => {
  it("marks the thread seen once it is shown, then refreshes so the dot drops", async () => {
    mocks.seen.mockResolvedValue(undefined);
    const { container } = render(<SeenMark id="t1" />);
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(mocks.seen).toHaveBeenCalledWith("t1"));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("stays quiet when it cannot reach the server", async () => {
    mocks.seen.mockRejectedValue(new Error("offline"));
    render(<SeenMark id="t1" />);
    await waitFor(() => expect(mocks.seen).toHaveBeenCalled());
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
