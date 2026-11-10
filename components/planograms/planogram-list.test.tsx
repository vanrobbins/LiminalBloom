import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { PlanogramList, zoneSummary } from "./planogram-list";

const bay = { fixtureId: "bay", name: "Denim Wall · Bay 3", typeLabel: "Wall bay", publishedVersion: 4, publishedAt: new Date("2026-10-08T12:00:00Z"), hasDraft: true, dueDate: "2026-10-01" };
const rack = { fixtureId: "rack", name: "4-way Rack 2", typeLabel: "Rack", publishedVersion: null, publishedAt: null, hasDraft: false, dueDate: "2026-10-15" };
const groups = [
  { zoneId: "z1", zoneName: "Denim", items: [bay, rack] },
  { zoneId: null, zoneName: "Not in a zone", items: [{ ...rack, fixtureId: "t", name: "Table 1", typeLabel: "Table", dueDate: null }] },
];

describe("PlanogramList", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows version, draft and due state in words once a zone is opened", async () => {
    render(<PlanogramList groups={groups} today="2026-10-08" storeKey="s" />);
    const denim = screen.getByRole("region", { name: "Denim" });
    expect(within(denim).queryByRole("link")).toBeNull();
    await userEvent.setup().click(within(denim).getByRole("button", { name: /Denim/ }));
    const bayLink = within(denim).getByRole("link", { name: /Denim Wall · Bay 3/ });
    expect(bayLink).toHaveAttribute("href", "/planograms/bay");
    expect(bayLink).toHaveTextContent("Version 4 · Oct 8");
    expect(bayLink).toHaveTextContent("Draft");
    expect(bayLink).toHaveTextContent("Overdue · Oct 1");
    const rackLink = within(denim).getByRole("link", { name: /4-way Rack 2/ });
    expect(rackLink).toHaveTextContent("Not published");
    expect(rackLink).toHaveTextContent("Due Oct 15");
  });

  it("drops the type when the name says it (Rack 2 is a rack)", async () => {
    render(<PlanogramList groups={groups} today="2026-10-08" storeKey="s" />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Denim/ }));
    expect(screen.getByRole("link", { name: /4-way Rack 2/ })).not.toHaveTextContent(/Rack$/);
    expect(screen.getByRole("link", { name: /Denim Wall/ })).toHaveTextContent("Wall bay");
  });

  it("sums up each zone, folded", () => {
    render(<PlanogramList groups={groups} today="2026-10-08" storeKey="s" />);
    expect(within(screen.getByRole("region", { name: "Denim" })).getByText("1 draft · 1 overdue · 1 not published")).toBeInTheDocument();
    expect(zoneSummary([{ ...bay, hasDraft: false, dueDate: null }], "2026-10-08")).toBe("All published");
  });
});
