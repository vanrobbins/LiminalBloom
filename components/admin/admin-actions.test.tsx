// The buttons that open the help-action dialogs (spec 0.7.1 7.4): which show for whom, and that each runs its
// own action with the ids it was given and the reason typed.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  signOutEverywhereAction: vi.fn(),
  cancelInvitationAction: vi.fn(),
  resetTwoFactorAction: vi.fn(),
  pauseStoreAction: vi.fn(),
  restoreStoreAction: vi.fn(),
  makeStoreManagerAction: vi.fn(),
  addAdminAction: vi.fn(),
  removeAdminAction: vi.fn(),
}));
vi.mock("@/app/admin/people/actions", () => actions);
vi.mock("@/app/admin/stores/actions", () => actions);
vi.mock("@/app/admin/admins/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

import { AddAdmin, RemoveAdmin } from "./admin-people-actions";
import { CancelInvitation, PersonActions } from "./person-actions";
import { MakeManager, PauseRestore } from "./store-actions";

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(actions)) fn.mockResolvedValue({ status: "done" });
});

async function confirmWith(buttonName: string, confirmName: string, reason = "Owner asked by phone") {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: buttonName }));
  await user.type(screen.getByLabelText("Reason"), reason);
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: confirmName }));
}

describe("PersonActions", () => {
  it("signs the person out everywhere with the reason", async () => {
    render(<PersonActions userId="u1" name="Jane Park" sessions={2} canReset={false} />);
    await confirmWith("Sign out everywhere", "Sign out everywhere");
    expect(actions.signOutEverywhereAction).toHaveBeenCalledWith("u1", "Owner asked by phone");
  });

  it("offers Sign out only with a session, and Reset only when two-step sign-in can be reset", () => {
    const { rerender } = render(<PersonActions userId="u1" name="Jane Park" sessions={0} canReset={false} />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<PersonActions userId="u1" name="Jane Park" sessions={1} canReset />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Sign out everywhere", "Reset two-step sign-in"]);
  });

  it("resets two-step sign-in with the reason", async () => {
    render(<PersonActions userId="u1" name="Jane Park" sessions={0} canReset />);
    await confirmWith("Reset two-step sign-in", "Reset two-step sign-in");
    expect(actions.resetTwoFactorAction).toHaveBeenCalledWith("u1", "Owner asked by phone");
  });

  it("says an admin's reset is the script's when the server refuses it", async () => {
    actions.resetTwoFactorAction.mockResolvedValue({ status: "admin" });
    render(<PersonActions userId="u1" name="Jane Park" sessions={0} canReset />);
    await confirmWith("Reset two-step sign-in", "Reset two-step sign-in");
    expect(await screen.findByRole("status")).toHaveTextContent("can only be reset with the script");
  });
});

describe("CancelInvitation", () => {
  it("names the invitation in its dialog and cancels it by id", async () => {
    render(<CancelInvitation invitationId="i1" email="new@example.com" storeName="Pioneer Place" />);
    await confirmWith("Cancel invitation", "Cancel invitation");
    expect(actions.cancelInvitationAction).toHaveBeenCalledWith("i1", "Owner asked by phone");
  });
});

describe("PauseRestore and MakeManager", () => {
  it("offers Pause for a store that is running, and pauses it", async () => {
    render(<PauseRestore storeId="s1" storeName="Pioneer Place" paused={false} />);
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
    await confirmWith("Pause", "Pause store");
    expect(actions.pauseStoreAction).toHaveBeenCalledWith("s1", "Owner asked by phone");
  });

  it("offers Restore for a paused store, and restores it", async () => {
    render(<PauseRestore storeId="s1" storeName="Pioneer Place" paused />);
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    await confirmWith("Restore", "Restore store");
    expect(actions.restoreStoreAction).toHaveBeenCalledWith("s1", "Owner asked by phone");
  });

  it("makes a Store Manager of the person named, in the store named", async () => {
    render(<MakeManager storeId="s1" storeName="Pioneer Place" userId="u1" name="Jane Park" />);
    await confirmWith("Make Store Manager", "Make Store Manager");
    expect(actions.makeStoreManagerAction).toHaveBeenCalledWith("s1", "u1", "Owner asked by phone");
  });
});

describe("AddAdmin and RemoveAdmin", () => {
  it("asks for the reason only once an email is typed, then adds that address", async () => {
    const user = userEvent.setup();
    render(<AddAdmin />);
    await user.click(screen.getByRole("button", { name: "Add admin" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.click(screen.getByRole("button", { name: "Add admin" }));
    await user.type(screen.getByLabelText("Reason"), "Joins the team");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add admin" }));
    expect(actions.addAdminAction).toHaveBeenCalledWith("new@example.com", "Joins the team");
  });

  it("tells the person when no account has that email", async () => {
    actions.addAdminAction.mockResolvedValue({ status: "no-account" });
    const user = userEvent.setup();
    render(<AddAdmin />);
    await user.type(screen.getByLabelText("Email"), "ghost@example.com");
    await user.click(screen.getByRole("button", { name: "Add admin" }));
    await user.type(screen.getByLabelText("Reason"), "Joins the team");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add admin" }));
    expect(await screen.findByRole("status")).toHaveTextContent("No account has that email. They need to sign up first.");
  });

  it("removes the admin named, and warns the one removing themselves", async () => {
    const { unmount } = render(<RemoveAdmin userId="u2" name="Ada Admin" isSelf={false} />);
    await confirmWith("Remove", "Remove admin");
    expect(actions.removeAdminAction).toHaveBeenCalledWith("u2", "Owner asked by phone");
    unmount();
    render(<RemoveAdmin userId="u1" name="Me" isSelf />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("dialog", { name: "Remove yourself as an admin?" })).toBeInTheDocument();
  });
});
