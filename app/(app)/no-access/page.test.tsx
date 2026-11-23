import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Only requireMember: this page must never ask for a switch, or a member without
// one would be sent back here in a loop.
const requireMember = vi.hoisted(() => vi.fn(async () => ({ kind: "member" })));
vi.mock("@/lib/current-member", () => ({ requireMember }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import NoAccessPage from "./page";

describe("NoAccessPage", () => {
  it("says plainly that the person has no access, and links back to Home", async () => {
    render(await NoAccessPage());
    expect(screen.getByRole("heading", { level: 1, name: "You don't have access to this" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Hub" })).toHaveAttribute("href", "/home");
  });

  it("is a page for any signed-in member, so it cannot loop", async () => {
    render(await NoAccessPage());
    expect(requireMember).toHaveBeenCalled();
  });
});
