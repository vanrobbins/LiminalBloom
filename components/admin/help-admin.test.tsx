// The admin help screens (spec 0.7.1 9.2): the queue's three sections, the thread with the Context card, and Reply
// and Close. The actions are stood in for (lib/admin/actions-help.db.test.ts proves what they write).

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reply: vi.fn(), close: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/admin/help/actions", () => ({ adminReplyHelpAction: mocks.reply, adminCloseHelpAction: mocks.close }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

import type { AdminHelpItem } from "@/lib/admin/help-reads";

import { AdminReplyForm, CloseHelp } from "./help-admin-actions";
import { AdminHelpThread, HelpContextCard } from "./help-admin-thread";
import { HelpQueue } from "./help-queue";

beforeEach(() => vi.clearAllMocks());

const at = new Date("2026-11-20T10:00:00Z");
const item = (over: Partial<AdminHelpItem> = {}): AdminHelpItem => ({ id: "r1", kind: "broken", status: "open", requesterName: "Rita Requester", firstLine: "My planogram will not open", createdAt: at, updatedAt: at, ...over });

describe("HelpQueue", () => {
  it("lists Open, Replied and Closed, each row a link to its thread with who asked", () => {
    render(<HelpQueue open={[item(), item({ id: "r2", requesterName: "Omar Other" })]} replied={[item({ id: "r3", status: "answered" })]} closed={[]} />);
    const open = screen.getByRole("region", { name: /Open/ });
    expect(within(open).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/admin/help/r1", "/admin/help/r2"]);
    expect(within(open).getByText("Rita Requester")).toBeInTheDocument();
    expect(within(open).getAllByText("My planogram will not open")).toHaveLength(2);
    expect(within(screen.getByRole("region", { name: /Replied/ })).getByRole("link")).toHaveTextContent("Rita RequesterSomething isn't workingReplied");
    expect(within(screen.getByRole("region", { name: /Closed/ })).getByText("No closed requests.")).toBeInTheDocument();
  });

  it("says nobody is waiting when Open is empty", () => {
    render(<HelpQueue open={[]} replied={[]} closed={[]} />);
    expect(screen.getByText("Nobody is waiting for an answer.")).toBeInTheDocument();
  });
});

describe("AdminHelpThread and the Context card", () => {
  it("shows each author, marks the admin's as sent as Liminal Bloom, and keeps the body as plain text", () => {
    render(
      <AdminHelpThread
        messages={[
          { id: "m1", fromAdmin: false, authorName: "Rita Requester", body: "<b>help</b>", createdAt: at },
          { id: "m2", fromAdmin: true, authorName: "Ada Admin", body: "Try again.", createdAt: at },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Rita Requester");
    expect(within(items[0]).getByText("<b>help</b>")).toBeInTheDocument();
    expect(items[1]).toHaveTextContent("Ada Admin");
    expect(items[1]).toHaveTextContent("sent as Liminal Bloom");
  });

  it("the Context card names the person, their email and what the server wrote", () => {
    render(<HelpContextCard name="Rita Requester" email="rita@example.test" context={{ state: "member", store: { id: "s", name: "Pioneer Place" }, role: "Sales Associate" }} />);
    const card = screen.getByRole("heading", { name: "Context" }).parentElement!;
    for (const text of ["Rita Requester", "rita@example.test", "member", "Pioneer Place", "Sales Associate"]) expect(within(card).getByText(text)).toBeInTheDocument();
  });
});

describe("AdminReplyForm", () => {
  it("says it is sent as Liminal Bloom, sends the reply for this request, clears and refreshes", async () => {
    mocks.reply.mockResolvedValue({ status: "done" });
    render(<AdminReplyForm id="r1" />);
    const user = userEvent.setup();
    const field = screen.getByRole("textbox", { name: "Reply" });
    expect(field).toHaveAccessibleDescription(/Sent as Liminal Bloom/);
    await user.type(field, "Try again now");
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    expect(mocks.reply).toHaveBeenCalledWith("r1", "Try again now");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(field).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("Reply sent.");
    expect(field).toHaveFocus();
  });

  it("shows a full thread beside the field and keeps the text", async () => {
    mocks.reply.mockResolvedValue({ status: "too-many-messages" });
    render(<AdminReplyForm id="r1" />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Reply" }), "one more");
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    expect(await screen.findByRole("textbox", { name: "Reply" })).toHaveAccessibleDescription(/This thread is full/);
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("one more");
  });
});

describe("CloseHelp", () => {
  it("asks for a reason and closes this request with it", async () => {
    mocks.close.mockResolvedValue({ status: "done" });
    render(<CloseHelp id="r1" name="Rita Requester" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close" }));
    const dialog = await screen.findByRole("dialog", { name: "Close this request?" });
    expect(mocks.close).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText("Reason"), "Fixed by phone");
    await user.click(within(dialog).getByRole("button", { name: "Close request" }));
    expect(mocks.close).toHaveBeenCalledWith("r1", "Fixed by phone");
  });
});
