import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { entrance, fixture, store, zone } from "@/lib/layout/test-layouts";

import { LayoutList } from "./layout-list";

const layout = {
  ...store(),
  zones: [zone(), zone({ id: "zone-b", name: "Back wall", points: [] })],
  fixtures: [fixture({ id: "in", x: 100, y: 100, zoneId: "zone-a" }), fixture({ id: "loose", name: "Cash wrap" })],
  entrances: [entrance()],
};

describe("LayoutList", () => {
  beforeEach(() => window.localStorage.clear());

  it("lists everything: the outline, zones with their fixtures, store-level fixtures, entrances", async () => {
    render(<LayoutList layout={layout} selection={[]} issues={[]} dispatch={() => {}} storeKey="s" />);
    const nav = screen.getByRole("navigation", { name: "Everything on the map" });
    expect(within(nav).getByRole("button", { name: /Store outline/ })).toBeInTheDocument();
    const zone = within(nav).getByRole("region", { name: "Front tables" });
    expect(within(zone).queryByRole("button", { name: /Table 1/ })).toBeNull();
    await userEvent.click(within(zone).getByRole("button", { name: /Front tables/, expanded: false }));
    expect(within(zone).getByRole("button", { name: /Table 1/ })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Cash wrap/ })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Entrance 1/ })).toBeInTheDocument();
  });

  it("reveals an item on the map and shows its problem", async () => {
    const dispatch = vi.fn();
    const issues = [{ itemId: "loose", kind: "overlap" as const, message: "Blocked by Table 1." }];
    render(<LayoutList layout={layout} selection={["loose"]} issues={issues} dispatch={dispatch} storeKey="s" />);
    const button = screen.getByRole("button", { name: /Cash wrap/ });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Blocked by Table 1.")).toBeInTheDocument();
    await userEvent.click(button);
    expect(dispatch).toHaveBeenCalledWith({ type: "reveal", id: "loose" });
  });

  it("opens the zone holding the selection, and selects a zone from its Show on the map button", async () => {
    const dispatch = vi.fn();
    render(<LayoutList layout={layout} selection={["in"]} issues={[]} dispatch={dispatch} storeKey="s" />);
    expect(screen.getByRole("button", { name: /Table 1/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Show Front tables on the map" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "reveal", id: "zone-a" });
  });

  it("sorts by name the way people count and drops a type the name already says", () => {
    const racks = { ...store(), fixtures: [fixture({ id: "a", type: "rack", name: "Rack 10" }), fixture({ id: "b", type: "rack", name: "Rack 2" })] };
    render(<LayoutList layout={racks} selection={[]} issues={[]} dispatch={() => {}} storeKey="s" />);
    const names = screen.getAllByRole("button", { name: /^Rack/ }).map((b) => b.textContent);
    expect(names).toEqual(["Rack 2", "Rack 10"]);
  });
});
