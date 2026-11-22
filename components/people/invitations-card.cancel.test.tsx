import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ cancelInvitationAction: vi.fn() }));
vi.mock("@/app/(app)/store/people-actions", () => actions);
const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const toastMock = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/lib/toast", () => toastMock);

import { InvitationsCard } from "./invitations-card";
import { invitationRow } from "./test-view";

beforeEach(() => vi.clearAllMocks());

const rowOf = (email: string) => screen.getByText(email).closest("li")!;

describe("InvitationsCard cancel", () => {
  it("says Cancelling in the live region while the cancel is busy, since the busy button shows only a spinner", async () => {
    const user = userEvent.setup();
    let finish: (reply: unknown) => void = () => {};
    actions.cancelInvitationAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<InvitationsCard invitations={[invitationRow("jane@x.com")]} />);
    await user.click(screen.getByRole("button", { name: "Cancel invitation for jane@x.com" }));
    expect(screen.getByRole("button", { name: "Cancel invitation for jane@x.com" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Cancelling invitation for jane@x.com");
    await act(async () => finish({ status: "cancelled", email: "jane@x.com" }));
    expect(screen.getByRole("status")).toHaveTextContent("Cancelled invitation for jane@x.com");
  });

  describe("focus when the focused row's Cancel folds it away", () => {
    const cancelled = () => actions.cancelInvitationAction.mockResolvedValue({ status: "cancelled", email: "x" });
    const open = (...emails: string[]) =>
      render(
        <>
          <h1>People</h1>
          <InvitationsCard invitations={emails.map((e) => invitationRow(e))} />
        </>,
      );

    it("goes to the next row's first control", async () => {
      const user = userEvent.setup();
      cancelled();
      open("jane@x.com", "sam@x.com", "tom@x.com");
      await user.click(screen.getByRole("button", { name: "Cancel invitation for sam@x.com" }));
      expect(screen.getByRole("button", { name: "Copy link for tom@x.com" })).toHaveFocus();
    });

    it("goes to the previous row's when it was the last", async () => {
      const user = userEvent.setup();
      cancelled();
      open("jane@x.com", "sam@x.com");
      await user.click(screen.getByRole("button", { name: "Cancel invitation for sam@x.com" }));
      expect(screen.getByRole("button", { name: "Copy link for jane@x.com" })).toHaveFocus();
    });

    it("goes to the list heading when the others are read-only, and the page title when it was the only row", async () => {
      const user = userEvent.setup();
      cancelled();
      const { unmount } = render(
        <>
          <h1>People</h1>
          <InvitationsCard invitations={[invitationRow("boss@x.com", { id: null }), invitationRow("jane@x.com")]} />
        </>,
      );
      await user.click(screen.getByRole("button", { name: "Cancel invitation for jane@x.com" }));
      expect(screen.getByRole("heading", { name: "Invitations waiting" })).toHaveFocus();
      unmount();
      open("jane@x.com");
      await user.click(screen.getByRole("button", { name: "Cancel invitation for jane@x.com" }));
      expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    });

    it("decides by where focus was when Cancel was pressed, since a browser drops it to the page once the button is disabled", async () => {
      const user = userEvent.setup();
      // Disabling the focused button (the busy state) blurs it in a real browser; jsdom does not, so do it as the server call starts.
      actions.cancelInvitationAction.mockImplementation(async () => {
        (document.activeElement as HTMLElement | null)?.blur();
        return { status: "cancelled", email: "sam@x.com" };
      });
      open("jane@x.com", "sam@x.com", "tom@x.com");
      await user.click(screen.getByRole("button", { name: "Cancel invitation for sam@x.com" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Copy link for tom@x.com" })).toHaveFocus());
    });

    it("leaves focus alone when it was not in the row", async () => {
      cancelled();
      open("jane@x.com", "sam@x.com");
      const other = screen.getByRole("button", { name: "Copy link for sam@x.com" });
      // The press lands on the page, not on a control (Safari does not focus a button on click).
      fireEvent.click(screen.getByRole("button", { name: "Cancel invitation for jane@x.com" }));
      await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
      expect(other).not.toHaveFocus();
    });
  });

  it("a refusal stays on the row, which stays open, and the list reloads at once", async () => {
    const user = userEvent.setup();
    actions.cancelInvitationAction.mockResolvedValue({ status: "forbidden" });
    render(<InvitationsCard invitations={[invitationRow("jane@x.com")]} />);
    await user.click(screen.getByRole("button", { name: "Cancel invitation for jane@x.com" }));
    expect(within(rowOf("jane@x.com")).getByText("Your role can't do this anymore.")).toBeInTheDocument();
    expect(rowOf("jane@x.com")).toHaveClass("grid-rows-[1fr]");
    expect(toastMock.toast).not.toHaveBeenCalled();
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("a lost connection stays a toast", async () => {
    const user = userEvent.setup();
    actions.cancelInvitationAction.mockRejectedValue(new Error("offline"));
    render(<InvitationsCard invitations={[invitationRow("jane@x.com")]} />);
    await user.click(screen.getByRole("button", { name: "Cancel invitation for jane@x.com" }));
    expect(toastMock.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Couldn't cancel" }));
  });

  it("a lost connection is also said in the live region, so it does not stay on Cancelling", async () => {
    const user = userEvent.setup();
    actions.cancelInvitationAction.mockRejectedValue(new Error("offline"));
    render(<InvitationsCard invitations={[invitationRow("jane@x.com")]} />);
    await user.click(screen.getByRole("button", { name: "Cancel invitation for jane@x.com" }));
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't cancel the invitation for jane@x.com");
  });
});
