import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/people/actions", () => ({ createInvitationAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { InviteControl } from "./invite-control";
import { ROLES } from "./test-view";

describe("InviteControl", () => {
  it("has the phone's icon button, named Invite someone, and the labelled Invite button from 768 px", () => {
    render(<InviteControl roles={ROLES} />);
    const icon = screen.getByRole("button", { name: "Invite someone" });
    const labelled = screen.getByRole("button", { name: "Invite" });
    // Tailwind's classes decide which shows; jsdom has no layout, so check the classes that do.
    expect(icon.closest("div")).toHaveClass("md:hidden");
    expect(labelled.closest("div")).toHaveClass("hidden", "md:block");
    expect(icon.className).toContain("size-11");
  });

  it("opens the invite dialog from either button, and Escape closes it with focus back on the button", async () => {
    const user = userEvent.setup();
    render(<InviteControl roles={ROLES} />);
    const labelled = screen.getByRole("button", { name: "Invite" });
    await user.click(labelled);
    expect(screen.getByRole("dialog", { name: "Invite someone" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(labelled).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Invite someone" }));
    expect(screen.getByRole("dialog", { name: "Invite someone" })).toBeInTheDocument();
  });
});
