import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ accept: vi.fn(), replace: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));
vi.mock("@/app/invite/[id]/actions", () => ({ acceptInvitationAction: mocks.accept }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/lib/toast", () => ({ toast: mocks.toast }));

import { AcceptButton } from "./accept-button";

beforeEach(() => vi.clearAllMocks());

async function click() {
  const user = userEvent.setup();
  render(<AcceptButton invitationId="inv-1" storeName="Spring Street" />);
  await user.click(screen.getByRole("button", { name: "Accept invitation" }));
}

describe("AcceptButton", () => {
  it("accepts the invitation it was given, says so, and opens the store; it stays on Joining… until the page changes", async () => {
    mocks.accept.mockResolvedValue({ status: "accepted", storeName: "Spring Street", roleName: "Sales Associate" });
    await click();
    expect(mocks.accept).toHaveBeenCalledWith("inv-1");
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/products"));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "success", title: "Joined Spring Street as Sales Associate" }));
    expect(screen.getByRole("button", { name: /Joining…/ })).toBeDisabled();
  });

  it.each([
    ["expired", "This invitation has expired. Ask for a new one."],
    ["cancelled", "This invitation was cancelled. Ask for a new one."],
    ["used", "This invitation was already used."],
    ["wrong-email", "This invitation was sent to a different email address than the one you're signed in with. Sign in with the address it was sent to."],
    ["already-member", "You're already in Spring Street."],
    ["full", "Spring Street has 100 people, the most it can hold. Ask a manager to make room."],
    ["missing", "This invitation link isn't valid. Check that you copied all of it, or ask for a new one."],
    ["stale", "Something changed while you were joining. Reload the page and try again."],
    ["invalid", "This invitation link isn't valid. Check that you copied all of it, or ask for a new one."],
  ])("says why in plain words when the answer is %s, and lets them try again", async (status, message) => {
    mocks.accept.mockResolvedValue({ status });
    await click();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeEnabled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("says to sign in again when the session has gone", async () => {
    mocks.accept.mockResolvedValueOnce({ status: "signed-out" });
    await click();
    expect(await screen.findByRole("alert")).toHaveTextContent("You're signed out.");
  });

  it("names the connection when the request throws", async () => {
    mocks.accept.mockRejectedValue(new TypeError("Failed to fetch"));
    await click();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't join. Check your connection and try again.");
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeEnabled();
  });
});
