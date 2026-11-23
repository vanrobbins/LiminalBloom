// /company's People and Ownership: each control shows only for the viewer's rank (the server decides `canAct` and
// the invite roles by the same rule and checks again on every write), and each dialog sends what the page showed,
// the assignment's version included, and says the server's refusal in words.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), invite: vi.fn(), cancel: vi.fn(), changeRegion: vi.fn(), remove: vi.fn(), handOff: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }) }));
vi.mock("@/app/(app)/company/people-actions", () => ({ inviteCompanyPersonAction: mocks.invite, cancelCompanyInvitationAction: mocks.cancel, changeRegionAction: mocks.changeRegion, removeCompanyPersonAction: mocks.remove }));
vi.mock("@/app/(app)/company/ownership-actions", () => ({ handOffOwnershipAction: mocks.handOff }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { assignableRoles, type CompanyInvitationRow, type PersonRow } from "@/lib/companies/people-read";

import { OwnershipSection } from "./ownership-section";
import { PeopleSection } from "./people-section";

const person = (over: Partial<PersonRow>): PersonRow => ({ userId: "u", name: "Pat", email: "pat@example.com", role: "corporate_admin", roleName: "Corporate Admin", regionId: null, regionName: null, version: 1, canAct: true, ...over });
const OWNER = person({ userId: "o", name: "Ana Owner", role: "owner", roleName: "Owner", version: 0, canAct: false });
const ADMIN = person({ userId: "a", name: "Cy Admin" });
const MANAGER = person({ userId: "m", name: "Rae Manager", role: "regional_manager", roleName: "Regional Manager", regionId: "r1", regionName: "North", version: 4 });
const REGIONS = [
  { id: "r1", name: "North" },
  { id: "r2", name: "South" },
];
const INVITATION: CompanyInvitationRow = { id: "inv1", email: "new@example.com", roleName: "Regional Manager", regionName: "South", expiresAt: "2026-11-25T20:00:00Z" };

beforeEach(() => vi.clearAllMocks());

describe("assignableRoles (the invite role list)", () => {
  it("is the roles strictly below the viewer's own", () => {
    expect(assignableRoles("owner").map((r) => r.key)).toEqual(["corporate_admin", "regional_manager"]);
    expect(assignableRoles("corporate_admin").map((r) => r.key)).toEqual(["regional_manager"]);
    expect(assignableRoles("regional_manager")).toEqual([]);
  });
});

describe("PeopleSection", () => {
  it("offers Invite only while there is a role below the viewer's", () => {
    const { rerender } = render(<PeopleSection people={[OWNER]} invitations={[]} roles={assignableRoles("corporate_admin")} regions={REGIONS} />);
    expect(screen.getByRole("button", { name: "Invite" })).toBeInTheDocument();
    rerender(<PeopleSection people={[OWNER]} invitations={[]} roles={[]} regions={REGIONS} />);
    expect(screen.queryByRole("button", { name: "Invite" })).toBeNull();
  });

  it("gives a menu only to a row the viewer outranks; the owner's row never has one", () => {
    render(<PeopleSection people={[OWNER, ADMIN, { ...MANAGER, canAct: false }]} invitations={[]} roles={[]} regions={REGIONS} />);
    expect(screen.queryByRole("button", { name: "More for Ana Owner" })).toBeNull();
    expect(screen.getByRole("button", { name: "More for Cy Admin" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More for Rae Manager" })).toBeNull();
    expect(screen.getByText("Rae Manager")).toBeInTheDocument();
  });

  it("offers Change region only for a regional manager, and Remove for both", async () => {
    const user = userEvent.setup();
    render(<PeopleSection people={[OWNER, ADMIN, MANAGER]} invitations={[]} roles={[]} regions={REGIONS} />);
    await user.click(screen.getByRole("button", { name: "More for Cy Admin" }));
    expect(screen.queryByRole("menuitem", { name: "Change region" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Remove" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "More for Rae Manager" }));
    expect(screen.getByRole("menuitem", { name: "Change region" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Remove" })).toBeInTheDocument();
  });

  it("Remove sends the person and the version the page showed, then reloads", async () => {
    mocks.remove.mockResolvedValue({ status: "saved", message: "Saved" });
    const user = userEvent.setup();
    render(<PeopleSection people={[OWNER, MANAGER]} invitations={[]} roles={[]} regions={REGIONS} />);
    await user.click(screen.getByRole("button", { name: "More for Rae Manager" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(mocks.remove).toHaveBeenCalledWith("m", 4);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("Change region starts on the current region, sends the new one with the version, and shows a stale refusal inside", async () => {
    mocks.changeRegion.mockResolvedValue({ status: "refused", message: "That is out of date. Reload the page and try again." });
    const user = userEvent.setup();
    render(<PeopleSection people={[OWNER, MANAGER]} invitations={[]} roles={[]} regions={REGIONS} />);
    await user.click(screen.getByRole("button", { name: "More for Rae Manager" }));
    await user.click(screen.getByRole("menuitem", { name: "Change region" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Change region" })).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText("Region"), "r2");
    await user.click(within(dialog).getByRole("button", { name: "Change region" }));
    expect(mocks.changeRegion).toHaveBeenCalledWith("m", "r2", 4);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("out of date");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("lists waiting invitations, with Copy link and Cancel only where the server sent an id", () => {
    render(<PeopleSection people={[OWNER]} invitations={[INVITATION, { ...INVITATION, id: null, email: "admin@example.com", roleName: "Corporate Admin", regionName: null }]} roles={[]} regions={REGIONS} />);
    expect(screen.getByRole("button", { name: "Copy link for new@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel invitation for new@example.com" })).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy link for admin@example.com" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel invitation for admin@example.com" })).toBeNull();
  });

  it("Cancel asks first, then sends the id", async () => {
    mocks.cancel.mockResolvedValue({ status: "saved", message: "Invitation cancelled" });
    const user = userEvent.setup();
    render(<PeopleSection people={[OWNER]} invitations={[INVITATION]} roles={[]} regions={REGIONS} />);
    await user.click(screen.getByRole("button", { name: "Cancel invitation for new@example.com" }));
    expect(mocks.cancel).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel invitation" }));
    expect(mocks.cancel).toHaveBeenCalledWith("inv1");
  });
});

describe("the invite dialog", () => {
  it("lists only the viewer's roles, asks for a region for a regional manager, and shows the link once made", async () => {
    mocks.invite.mockResolvedValue({ status: "created", id: "abc", email: "new@example.com", expiresAt: "2026-11-25T20:00:00Z" });
    const user = userEvent.setup();
    render(<PeopleSection people={[OWNER]} invitations={[]} roles={assignableRoles("corporate_admin")} regions={REGIONS} />);
    await user.click(screen.getByRole("button", { name: "Invite" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("option").map((o) => o.textContent)).toEqual(["Regional Manager", "North", "South"]);
    await user.type(within(dialog).getByLabelText("Email"), "new@example.com");
    await user.selectOptions(within(dialog).getByLabelText("Region"), "r2");
    await user.click(within(dialog).getByRole("button", { name: "Create invite link" }));
    expect(mocks.invite).toHaveBeenCalledWith("new@example.com", "regional_manager", "r2");
    expect(await within(dialog).findByLabelText("Invite link")).toHaveValue(`${window.location.origin}/invite/abc`);
  });

  it("an owner sees both roles, and a corporate admin invite sends no region", async () => {
    mocks.invite.mockResolvedValue({ status: "refused", message: "That address already has an invitation waiting. Cancel it first to send a new one." });
    const user = userEvent.setup();
    render(<PeopleSection people={[OWNER]} invitations={[]} roles={assignableRoles("owner")} regions={REGIONS} />);
    await user.click(screen.getByRole("button", { name: "Invite" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Role"), "corporate_admin");
    expect(within(dialog).queryByLabelText("Region")).toBeNull();
    await user.type(within(dialog).getByLabelText("Email"), "x@example.com");
    await user.click(within(dialog).getByRole("button", { name: "Create invite link" }));
    expect(mocks.invite).toHaveBeenCalledWith("x@example.com", "corporate_admin", null);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("already has an invitation");
  });
});

describe("OwnershipSection", () => {
  it("with no corporate admin says to appoint one and offers Invite, not Hand off", async () => {
    const user = userEvent.setup();
    render(<OwnershipSection companyName="Acme" admins={[]} version={3} roles={assignableRoles("owner")} regions={REGIONS} />);
    expect(screen.getByText("Appoint a corporate admin before you hand off ownership.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hand off ownership" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Invite" }));
    expect(within(screen.getByRole("dialog")).getByLabelText("Role")).toHaveValue("corporate_admin");
  });

  it("hands off to the chosen admin with the company version, and tells in a toast", async () => {
    mocks.handOff.mockResolvedValue({ status: "handed", name: "Cy Admin" });
    const user = userEvent.setup();
    render(<OwnershipSection companyName="Acme" admins={[{ userId: "a", name: "Cy Admin" }, { userId: "b", name: "Dee Admin" }]} version={3} roles={[]} regions={REGIONS} />);
    await user.click(screen.getByRole("button", { name: "Hand off ownership" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Cy Admin becomes the owner. You stay as a corporate admin");
    await user.selectOptions(within(dialog).getByLabelText("New owner"), "b");
    await user.click(within(dialog).getByRole("button", { name: "Hand off" }));
    expect(mocks.handOff).toHaveBeenCalledWith("b", 3);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Dee Admin is now the owner" }));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows a refusal inside the dialog and does not toast", async () => {
    mocks.handOff.mockResolvedValue({ status: "refused", message: "That person is no longer a corporate admin. Reload the page and choose again." });
    const user = userEvent.setup();
    render(<OwnershipSection companyName="Acme" admins={[{ userId: "a", name: "Cy Admin" }]} version={3} roles={[]} regions={REGIONS} />);
    await user.click(screen.getByRole("button", { name: "Hand off ownership" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Hand off" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer a corporate admin");
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
