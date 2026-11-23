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

  it("shows one state per row: the version, else Draft, else plain Not published, never both", async () => {
    const drafted = { ...rack, fixtureId: "d", name: "Table 2", typeLabel: "Table", hasDraft: true, dueDate: null };
    render(<PlanogramList groups={[{ zoneId: "z", zoneName: "Zone", items: [bay, drafted, { ...rack, fixtureId: "n", name: "Table 3", typeLabel: "Table", dueDate: null }] }]} today="2026-10-08" storeKey="s" />);
    const row = (name: RegExp) => screen.getByRole("link", { name });
    expect(row(/Denim Wall/)).toHaveTextContent("Version 4 · Oct 8");
    expect(row(/Denim Wall/)).not.toHaveTextContent("Draft");
    expect(row(/Table 2/)).toHaveTextContent("Draft");
    expect(row(/Table 2/)).not.toHaveTextContent("Not published");
    const plain = within(row(/Table 3/)).getByText("Not published");
    expect(plain).toHaveClass("text-ink-muted");
    expect(plain).not.toHaveClass("border-dashed");
  });

  it("appends adjusted or adjusting to the version, and nothing when there is no Quick Adjust", () => {
    const row = (fixtureId: string, adjustment: "draft" | "published" | null) => ({ ...bay, fixtureId, name: `Bay ${fixtureId}`, hasDraft: false, dueDate: null, adjustment });
    render(<PlanogramList groups={[{ zoneId: "z", zoneName: "Zone", items: [row("a", "published"), row("b", "draft"), row("c", null)] }]} today="2026-10-08" storeKey="s" />);
    expect(screen.getByRole("link", { name: /Bay a/ })).toHaveTextContent(/Version 4 · Oct 8.* · adjusted/);
    expect(screen.getByRole("link", { name: /Bay b/ })).toHaveTextContent(/Version 4 · Oct 8.* · adjusting/);
    expect(screen.getByRole("link", { name: /Bay c/ })).not.toHaveTextContent(/adjust/);
  });

  it("shows version, draft and due state in words once a zone is opened", async () => {
    render(<PlanogramList groups={groups} today="2026-10-08" storeKey="s" />);
    const denim = screen.getByRole("region", { name: "Denim" });
    expect(within(denim).queryByRole("link")).toBeNull();
    await userEvent.setup().click(within(denim).getByRole("button", { name: /Denim/ }));
    const bayLink = within(denim).getByRole("link", { name: /Denim Wall · Bay 3/ });
    expect(bayLink).toHaveAttribute("href", "/planograms/bay");
    expect(bayLink).toHaveTextContent("Version 4 · Oct 8");
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

  it("sums up what needs doing (drafts, overdue) for a folded zone, and drops the summary once it opens", async () => {
    render(<PlanogramList groups={groups} today="2026-10-08" storeKey="s" />);
    const denim = screen.getByRole("region", { name: "Denim" });
    expect(within(denim).getByText("1 draft · 1 overdue")).toBeInTheDocument();
    await userEvent.setup().click(within(denim).getByRole("button", { name: /Denim/ }));
    expect(within(denim).queryByText("1 draft · 1 overdue")).toBeNull();
    // Not published is a state of the row, not a chore for the summary; nothing to do says nothing.
    expect(zoneSummary([rack], "2026-10-08")).toBe("");
    expect(zoneSummary([{ ...bay, hasDraft: false, dueDate: null }], "2026-10-08")).toBe("");
  });
});
