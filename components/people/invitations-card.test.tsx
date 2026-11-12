import { render, screen } from "@testing-library/react";
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

  it("copies the invitation link and says so", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<InvitationsCard invitations={[invitationRow("jane@x.com")]} />);
    await user.click(screen.getByRole("button", { name: "Copy link for jane@x.com" }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/i-jane@x.com`);
    expect(toastMock.toast).toHaveBeenCalledWith({ tone: "success", title: "Link copied" });
  });

  it("says so when the clipboard refuses", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<InvitationsCard invitations={[invitationRow("jane@x.com")]} />);
    await user.click(screen.getByRole("button", { name: "Copy link for jane@x.com" }));
    expect(toastMock.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Couldn't copy the link" }));
  });

  it.each([
    [{ status: "cancelled", email: "jane@x.com" }, { tone: "success", title: "Cancelled the invitation for jane@x.com" }],
    [{ status: "gone" }, { tone: "error", title: "This invitation was already used or cancelled." }],
    [{ status: "forbidden" }, { tone: "error", title: "Your role can't do this anymore." }],
  ])("cancels and then reloads, telling the outcome in words (%o)", async (reply, toast) => {
    const user = userEvent.setup();
    actions.cancelInvitationAction.mockResolvedValue(reply);
    render(<InvitationsCard invitations={[invitationRow("jane@x.com")]} />);
    await user.click(screen.getByRole("button", { name: "Cancel invitation for jane@x.com" }));
    expect(actions.cancelInvitationAction).toHaveBeenCalledWith("i-jane@x.com");
    expect(toastMock.toast).toHaveBeenCalledWith(toast);
    expect(routerMock.refresh).toHaveBeenCalled();
  });
});
