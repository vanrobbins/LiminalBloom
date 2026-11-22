import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import type { ChangeRow } from "@/lib/home/types";

import { RecentChangesCard } from "./recent-changes-card";

const change = (id: string, text: string): ChangeRow => ({ id, text, at: new Date("2026-11-15T18:00:00Z") });

describe("RecentChangesCard", () => {
  it("shows each line as worded, in order, with its moment", () => {
    const { container } = render(<RecentChangesCard rows={[change("1", "Van made Ana a Store Manager"), change("2", "Van removed Lee")]} />);
    expect(screen.getAllByRole("listitem").map((li) => li.textContent?.split(" · ")[0])).toEqual(["Van made Ana a Store Manager", "Van removed Lee"]);
    expect(container.querySelectorAll("time")).toHaveLength(2);
  });

  it("shows at most five lines", () => {
    render(<RecentChangesCard rows={Array.from({ length: 7 }, (_, i) => change(String(i), `Change ${i}`))} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("has a see-all link to Roles", () => {
    render(<RecentChangesCard rows={[change("1", "Van removed Lee")]} />);
    expect(screen.getByRole("link", { name: "All roles" })).toHaveAttribute("href", "/store/roles");
  });

  it("prints only the words it was given, so an email the server left out is not there", () => {
    const { container } = render(<RecentChangesCard rows={[change("1", "Van invited someone")]} />);
    expect(container.textContent).not.toContain("@");
  });
});
