import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ cancelInvitationAction: vi.fn() }));
vi.mock("@/app/(app)/people/actions", () => actions);
const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const toastMock = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/lib/toast", () => toastMock);

import { InvitationsCard } from "./invitations-card";
import { invitationRow } from "./test-view";

beforeEach(() => vi.clearAllMocks());

const rowOf = (email: string) => screen.getByText(email).closest("li")!;

describe("InvitationsCard", () => {
  it("lists each invitation with its role and expiry, and offers Copy link and Cancel named for the address", () => {
    render(<InvitationsCard invitations={[invitationRow("jane@x.com")]} />);
    expect(screen.getByRole("heading", { name: "Invitations waiting" })).toBeInTheDocument();
    expect(screen.getByText(/Sales Associate role · Expires/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link for jane@x.com" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel invitation for jane@x.com" })).toBeInTheDocument();
  });

  it("offers an expired invitation Cancel only, and a row the rank rule doesn't reach nothing", () => {
    render(<InvitationsCard invitations={[invitationRow("old@x.com", { expired: true }), invitationRow("boss@x.com", { canAct: false })]} />);
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy link for old@x.com" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel invitation for old@x.com" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /boss@x.com/ })).toBeNull();
    expect(screen.getByText("boss@x.com")).toBeInTheDocument();
  });

  it("says a lapsed invitation (its inviter can no longer grant the role) is Lapsed, and offers Cancel only", () => {
    render(<InvitationsCard invitations={[invitationRow("gone@x.com", { lapsed: true })]} />);
    expect(screen.getByText(/Sales Associate role · Lapsed/)).toBeInTheDocument();
    expect(screen.queryByText(/Expires/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy link for gone@x.com" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel invitation for gone@x.com" })).toBeInTheDocument();
  });

  it("offers an invitation with no role (made before roles existed) Cancel only, since its link opens as missing", () => {
    render(<InvitationsCard invitations={[invitationRow("old@x.com", { linkWorks: false, roleName: "No role" })]} />);
    expect(screen.queryByRole("button", { name: "Copy link for old@x.com" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel invitation for old@x.com" })).toBeInTheDocument();
    expect(screen.getByText(/^No role · Expires/)).toBeInTheDocument();
  });

  it("shows a row that carries no id (the server withheld it) read-only, without crashing", () => {
    render(<InvitationsCard invitations={[invitationRow("boss@x.com", { id: null }), invitationRow("jane@x.com")]} />);
    expect(screen.queryByRole("button", { name: /boss@x.com/ })).toBeNull();
    expect(screen.getByText("boss@x.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel invitation for jane@x.com" })).toBeInTheDocument();
  });

  it("copies the invitation link: the icon swaps to a check for 1.5 s, no toast", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
      render(<InvitationsCard invitations={[invitationRow("jane@x.com")]} />);
      const button = screen.getByRole("button", { name: "Copy link for jane@x.com" });
      expect(button.querySelector("[data-copied]")).toHaveClass("opacity-0");
      await user.click(button);
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/i-jane@x.com`);
      expect(button.querySelector("[data-copied]")).toHaveClass("opacity-100");
      expect(screen.getByRole("status")).toHaveTextContent("Link copied");
      expect(toastMock.toast).not.toHaveBeenCalled();
      act(() => void vi.advanceTimersByTime(1400));
      expect(button.querySelector("[data-copied]")).toHaveClass("opacity-100");
      act(() => void vi.advanceTimersByTime(200));
      expect(button.querySelector("[data-copied]")).toHaveClass("opacity-0");
      expect(button).toHaveAccessibleName("Copy link for jane@x.com");
    } finally {
      vi.useRealTimers();
    }
  });

  it("says so on the row when the clipboard refuses, with no toast and no check", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<InvitationsCard invitations={[invitationRow("jane@x.com"), invitationRow("sam@x.com")]} />);
    await user.click(screen.getByRole("button", { name: "Copy link for jane@x.com" }));
    expect(within(rowOf("jane@x.com")).getByText("Couldn't copy the link. Try again.")).toBeInTheDocument();
    expect(within(rowOf("sam@x.com")).queryByText(/Couldn't copy/)).toBeNull();
    expect(screen.getByRole("button", { name: "Copy link for jane@x.com" }).querySelector("[data-copied]")).toHaveClass("opacity-0");
    expect(toastMock.toast).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "cancelled", email: "jane@x.com" }, "Cancelled invitation for jane@x.com"],
    [{ status: "gone" }, "Invitation for jane@x.com is already gone"],
  ])("a cancelled or already-gone invitation is said in the live region, folds shut, then the list reloads (%o)", async (reply, said) => {
    const user = userEvent.setup();
    actions.cancelInvitationAction.mockResolvedValue(reply);
    render(<InvitationsCard invitations={[invitationRow("jane@x.com"), invitationRow("sam@x.com")]} />);
    await user.click(screen.getByRole("button", { name: "Cancel invitation for jane@x.com" }));
    expect(actions.cancelInvitationAction).toHaveBeenCalledWith("i-jane@x.com");
    expect(rowOf("jane@x.com")).toHaveClass("grid-rows-[0fr]");
    expect(rowOf("jane@x.com")).toHaveAttribute("inert");
    expect(rowOf("sam@x.com")).toHaveClass("grid-rows-[1fr]");
    expect(screen.getByRole("status")).toHaveTextContent(said);
    expect(toastMock.toast).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
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

  it("copying the same link twice is announced twice", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<InvitationsCard invitations={[invitationRow("jane@x.com")]} />);
    const button = screen.getByRole("button", { name: "Copy link for jane@x.com" });
    await user.click(button);
    const first = screen.getByRole("status").textContent;
    await user.click(button);
    expect(screen.getByRole("status").textContent).not.toBe(first);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
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
});
