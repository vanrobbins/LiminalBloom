import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import type { InvitationRow } from "@/lib/home/types";

import { WaitingInvitationsCard } from "./waiting-invitations-card";

const inv = (email: string, o: Partial<InvitationRow> = {}): InvitationRow => ({ id: email, email, roleName: "Sales Associate", state: "pending", expiresAt: new Date("2026-11-20T18:00:00Z"), ...o });
const items = () => screen.getAllByRole("listitem");

describe("WaitingInvitationsCard", () => {
  it("shows email, role and when it expires, as the People card words it", () => {
    render(<WaitingInvitationsCard rows={[inv("ana@example.test")]} />);
    const row = items()[0];
    expect(within(row).getByText("ana@example.test")).toBeInTheDocument();
    expect(row).toHaveTextContent("Sales Associate role · Expires");
    expect(row.querySelector("time")).toHaveAttribute("dateTime", "2026-11-20T18:00:00.000Z");
  });

  it("says Expired with its moment, and Lapsed with none", () => {
    render(<WaitingInvitationsCard rows={[inv("a@example.test", { state: "expired" }), inv("b@example.test", { state: "lapsed" })]} />);
    expect(items()[0]).toHaveTextContent(/· Expired/);
    expect(items()[0].querySelector("time")).not.toBeNull();
    expect(items()[1]).toHaveTextContent("· Lapsed");
    expect(items()[1].querySelector("time")).toBeNull();
  });

  it("keeps order, and does not add the word role to No role", () => {
    render(<WaitingInvitationsCard rows={[inv("a@example.test", { roleName: "No role" }), inv("b@example.test")]} />);
    expect(items()[0]).toHaveTextContent("No role · Expires");
    expect(items()[0]).not.toHaveTextContent("No role role");
    expect(items()[1]).toHaveTextContent("Sales Associate role");
    expect(items().map((li) => li.querySelector("span")?.textContent)).toEqual(["a@example.test", "b@example.test"]);
  });

  it("shows at most five rows and names the remainder on the see-all link to Store", () => {
    render(<WaitingInvitationsCard rows={Array.from({ length: 8 }, (_, i) => inv(`p${i}@example.test`))} />);
    expect(items()).toHaveLength(5);
    expect(screen.getByRole("link", { name: "All invitations, 3 more" })).toHaveAttribute("href", "/store");
  });

  it("has no row links: the actions live in Store", () => {
    render(<WaitingInvitationsCard rows={[inv("a@example.test")]} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
