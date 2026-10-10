import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlanogramList } from "./planogram-list";

const groups = [
  {
    zoneName: "Denim",
    items: [
      { fixtureId: "bay", name: "Denim Wall · Bay 3", typeLabel: "Wall bay", publishedVersion: 4, publishedAt: new Date("2026-10-08T12:00:00Z"), hasDraft: true, dueDate: "2026-10-01" },
      { fixtureId: "rack", name: "4-way Rack 2", typeLabel: "Rack", publishedVersion: null, publishedAt: null, hasDraft: false, dueDate: "2026-10-15" },
    ],
  },
];

describe("PlanogramList", () => {
  it("shows version, draft and due state in words", () => {
    render(<PlanogramList groups={groups} today="2026-10-08" />);
    const denim = screen.getByRole("region", { name: "Denim" });
    const bay = within(denim).getByRole("link", { name: /Denim Wall · Bay 3/ });
    expect(bay).toHaveAttribute("href", "/planograms/bay");
    expect(bay).toHaveTextContent("Version 4 · Oct 8");
    expect(bay).toHaveTextContent("Draft");
    expect(bay).toHaveTextContent("Overdue · Oct 1");
    const rack = within(denim).getByRole("link", { name: /4-way Rack 2/ });
    expect(rack).toHaveTextContent("Not published");
    expect(rack).toHaveTextContent("Due Oct 15");
  });
});
