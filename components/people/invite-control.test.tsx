import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/store/people-actions", () => ({ createInvitationAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { InviteControl } from "./invite-control";
import { ROLES } from "./test-view";

describe("InviteControl", () => {
  it("is one 44 px icon button, named Invite someone, at every size", () => {
    render(<InviteControl roles={ROLES} />);
    const icon = screen.getByRole("button", { name: "Invite someone" });
    expect(icon.className).toContain("size-11");
    expect(icon.closest("[class~='hidden'], [class~='md:hidden']")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("opens the invite dialog, and Escape closes it with focus back on the button", async () => {
    const user = userEvent.setup();
    render(<InviteControl roles={ROLES} />);
    const button = screen.getByRole("button", { name: "Invite someone" });
    await user.click(button);
    expect(screen.getByRole("dialog", { name: "Invite someone" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();
  });
});
