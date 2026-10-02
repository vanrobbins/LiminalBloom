import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { entrance, fixture, store, zone } from "@/lib/layout/test-layouts";

import { LayoutList } from "./layout-list";

const layout = {
  ...store(),
  zones: [zone()],
  fixtures: [fixture({ id: "in", x: 100, y: 100, zoneId: "zone-a" }), fixture({ id: "loose", name: "Cash wrap" })],
  entrances: [entrance()],
};

describe("LayoutList", () => {
  it("lists everything: the outline, zones with their fixtures, store-level fixtures, entrances", () => {
    render(<LayoutList layout={layout} selection={[]} issues={[]} dispatch={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "Everything on the map" });
    expect(within(nav).getByRole("button", { name: /Store outline/ })).toBeInTheDocument();
    const zoneItem = within(nav).getByRole("button", { name: /Front tables/ }).closest("li")!;
    expect(within(zoneItem).getByRole("button", { name: /Table 1/ })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Cash wrap/ })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Entrance 1/ })).toBeInTheDocument();
  });

  it("reveals an item on the map and shows its problem", async () => {
    const dispatch = vi.fn();
    const issues = [{ itemId: "loose", kind: "overlap" as const, message: "Blocked by Table 1." }];
    render(<LayoutList layout={layout} selection={["loose"]} issues={issues} dispatch={dispatch} />);
    const button = screen.getByRole("button", { name: /Cash wrap/ });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Blocked by Table 1.")).toBeInTheDocument();
    await userEvent.click(button);
    expect(dispatch).toHaveBeenCalledWith({ type: "reveal", id: "loose" });
  });
});
