import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import type { PlanogramWork, PlanogramWorkRow } from "@/lib/home/types";

import { PlanogramWorkCard } from "./planogram-work-card";

const row = (name: string, o: Partial<PlanogramWorkRow> = {}): PlanogramWorkRow => ({
  fixtureId: name.toLowerCase().replace(/ /g, "-"),
  name,
  typeLabel: "Rack",
  publishedVersion: null,
  publishedAt: null,
  hasDraft: false,
  dueDate: null,
  overdue: false,
  ...o,
});
const work = (rows: PlanogramWorkRow[], total = rows.length): PlanogramWork => ({ rows, total, today: "2026-11-16" });

describe("PlanogramWorkCard", () => {
  it("lists rows in the order given, each linking to its planogram", () => {
    render(<PlanogramWorkCard work={work([row("Front table", { hasDraft: true }), row("Wall 2", { hasDraft: true })])} />);
    const links = within(screen.getByRole("region", { name: "Planograms to finish" })).getAllByRole("link", { name: /^(Front table|Wall 2)/ });
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/planograms/front-table", "/planograms/wall-2"]);
  });

  it("names the state and the due date in the row's link name", () => {
    render(
      <PlanogramWorkCard
        work={work([
          row("Front table", { hasDraft: true, dueDate: "2026-11-09", overdue: true }),
          row("Wall 2", { publishedVersion: 3, publishedAt: new Date("2026-11-01T12:00:00Z"), dueDate: "2026-11-20" }),
          row("Endcap", { dueDate: "2026-11-30" }),
        ])}
      />,
    );
    expect(screen.getByRole("link", { name: "Front table, Rack, Draft, Overdue · Nov 9" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wall 2, Rack, Version 3, Due Nov 20" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Endcap, Rack, Not published, Due Nov 30" })).toBeInTheDocument();
  });

  it("shows the due chip with its words, and the type only when the name doesn't say it", () => {
    render(<PlanogramWorkCard work={work([row("Front", { hasDraft: true, dueDate: "2026-11-09", overdue: true }), row("Back rack", { hasDraft: true })])} />);
    expect(screen.getByText("Overdue · Nov 9")).toBeInTheDocument();
    expect(screen.getAllByText("Rack")).toHaveLength(1);
  });

  it("spans both columns on a tablet", () => {
    render(<PlanogramWorkCard work={work([row("A", { hasDraft: true })])} />);
    expect(screen.getByRole("region", { name: "Planograms to finish" })).toHaveClass("md:col-span-2");
  });

  it("names the remainder on the see-all link", () => {
    render(<PlanogramWorkCard work={work([row("A", { hasDraft: true }), row("B", { hasDraft: true })], 6)} />);
    expect(screen.getByRole("link", { name: "All planograms, 4 more" })).toHaveAttribute("href", "/planograms");
  });

  it("leaves the remainder out when every planogram is shown", () => {
    render(<PlanogramWorkCard work={work([row("A", { hasDraft: true })])} />);
    expect(screen.getByRole("link", { name: "All planograms" })).toBeInTheDocument();
  });

  it("shows a Quick Adjust draft with its own word and a link to the adjust page", () => {
    render(<PlanogramWorkCard work={work([row("Wall 2", { publishedVersion: 3, adjustment: "draft" })])} />);
    const link = screen.getByRole("link", { name: "Wall 2, Rack, Adjusting" });
    expect(link).toHaveAttribute("href", "/planograms/wall-2/adjust");
    expect(within(link).getByText("Adjusting")).toBeInTheDocument();
  });

  it("a planogram with a monthly draft too keeps its monthly link and the Draft word, and adds Adjusting", () => {
    render(<PlanogramWorkCard work={work([row("Wall 2", { hasDraft: true, adjustment: "draft" })])} />);
    const link = screen.getByRole("link", { name: "Wall 2, Rack, Draft, Adjusting" });
    expect(link).toHaveAttribute("href", "/planograms/wall-2");
  });

  it("an adjustment on the floor adds no word and no change of link", () => {
    render(<PlanogramWorkCard work={work([row("Wall 2", { hasDraft: true, adjustment: "published" })])} />);
    expect(screen.getByRole("link", { name: "Wall 2, Rack, Draft" })).toHaveAttribute("href", "/planograms/wall-2");
  });
});
