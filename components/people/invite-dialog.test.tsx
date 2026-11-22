import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ createInvitationAction: vi.fn() }));
vi.mock("@/app/(app)/store/people-actions", () => actions);
const routerMock = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

import { InviteDialog } from "./invite-dialog";
import { ROLES } from "./test-view";

const created = { status: "created", id: "secret-id-123", email: "jane@x.com", roleName: "Sales Associate", expiresAt: "2026-11-13T23:40:00.000Z" };

beforeEach(() => vi.clearAllMocks());

function open(onClose = vi.fn()) {
  const user = userEvent.setup();
  render(<InviteDialog roles={ROLES} onClose={onClose} onCloseAutoFocus={() => {}} />);
  return { user, onClose };
}

async function createFor(user: ReturnType<typeof userEvent.setup>, email = "jane@x.com") {
  await user.type(screen.getByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: "Create invite link" }));
}

describe("InviteDialog, the form", () => {
  it("asks for an email and a role, offering only the roles it was given and starting on the lowest", () => {
    open();
    expect(screen.getByRole("dialog", { name: "Invite someone" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    const role = screen.getByLabelText("Role") as HTMLSelectElement;
    expect([...role.options].map((o) => o.text)).toEqual(["Assistant Manager", "Visual Merchandising Worker", "Sales Associate"]);
    expect(role.value).toBe("r-sa");
    expect(screen.getByText("You can invite into roles below yours.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What's role?" })).toBeInTheDocument();
  });

  it("sends the email and the chosen role", async () => {
    actions.createInvitationAction.mockResolvedValue(created);
    const { user } = open();
    await user.selectOptions(screen.getByLabelText("Role"), "r-vmw");
    await createFor(user);
    expect(actions.createInvitationAction).toHaveBeenCalledWith("jane@x.com", "r-vmw");
  });

  it.each([
    [{ status: "bad-email" }, "Enter an email address."],
    [{ status: "already-member", name: "Jane Park" }, "Jane Park is already in this store."],
    [{ status: "already-invited" }, "An invitation is already waiting for this email. Copy its link or cancel it first."],
    [{ status: "people-full" }, "This store has 100 people, the most it can hold."],
    [{ status: "invitations-full" }, "100 invitations are waiting, the most allowed. Cancel some first."],
    [{ status: "forbidden" }, "Your role can't invite into that role."],
    [{ status: "invalid" }, "That role isn't available. Close and look again."],
  ])("says so inside the dialog when the server answers %j, and keeps the form", async (answer, message) => {
    actions.createInvitationAction.mockResolvedValue(answer);
    const { user } = open();
    await createFor(user, "jane@x.com");
    expect(await screen.findByRole("status")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Create invite link" })).toBeEnabled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("shows the server's refusal for a blank address too (the browser's own check is off)", async () => {
    actions.createInvitationAction.mockResolvedValue({ status: "bad-email" });
    const { user } = open();
    await user.click(screen.getByRole("button", { name: "Create invite link" }));
    expect(actions.createInvitationAction).toHaveBeenCalledWith("", "r-sa");
    expect(await screen.findByRole("status")).toHaveTextContent("Enter an email address.");
  });

  it("names the connection when the request throws", async () => {
    actions.createInvitationAction.mockRejectedValue(new TypeError("Failed to fetch"));
    const { user } = open();
    await createFor(user);
    expect(await screen.findByRole("status")).toHaveTextContent("Couldn't save. Check your connection and try again.");
  });
});

describe("InviteDialog, the link", () => {
  async function toLink() {
    actions.createInvitationAction.mockResolvedValue(created);
    const view = open();
    await createFor(view.user);
    await screen.findByLabelText("Invite link");
    return view;
  }

  it("turns into the link, who it is for and when it stops working, with no promise of an email, and refreshes the invitations behind it", async () => {
    await toLink();
    expect(screen.getByText(/Send this link to jane@x.com\./)).toHaveTextContent("It works until");
    expect(screen.getByText(/\(48 hours\)/)).toBeInTheDocument();
    expect(document.querySelector("time")).toHaveAttribute("datetime", "2026-11-13T23:40:00.000Z");
    const link = screen.getByLabelText("Invite link") as HTMLInputElement;
    expect(link.value).toBe(`${window.location.origin}/invite/secret-id-123`);
    expect(link).toHaveAttribute("readonly");
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(document.body.textContent).not.toMatch(/we.ll email|emailed|check your inbox/i);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("copies the link and says Copied", async () => {
    const { user } = await toLink();
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(write).toHaveBeenCalledWith(`${window.location.origin}/invite/secret-id-123`);
    expect(await screen.findByRole("status")).toHaveTextContent("Copied");
  });

  it("when the clipboard is refused, selects the link and says to copy it by hand", async () => {
    const { user } = await toLink();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Couldn't copy. Select the link and copy it yourself.");
    const link = screen.getByLabelText("Invite link") as HTMLInputElement;
    await waitFor(() => expect(link.selectionStart === 0 && link.selectionEnd === link.value.length).toBe(true));
  });

  it("Done closes the dialog", async () => {
    const { user, onClose } = await toLink();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });
});
