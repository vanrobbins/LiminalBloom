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
    await userEvent.click(within(zone).getByRole("button", { name: "Open Front tables" }));
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

  it("opens the zone holding the selection", () => {
    render(<LayoutList layout={layout} selection={["in"]} issues={[]} dispatch={() => {}} storeKey="s" />);
    expect(screen.getByRole("button", { name: /Table 1/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("the zone's whole row selects it and shows it selected; the arrow alone folds", async () => {
    const dispatch = vi.fn();
    const { rerender } = render(<LayoutList layout={layout} selection={[]} issues={[]} dispatch={dispatch} storeKey="s" />);
    expect(screen.queryByRole("button", { name: /Show .* on the map/ })).toBeNull();
    const row = screen.getByRole("button", { name: /^Front tables/ });
    expect(row).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(row);
    expect(dispatch).toHaveBeenCalledWith({ type: "reveal", id: "zone-a" });
    // Selecting didn't fold or unfold anything: only the arrow does.
    expect(screen.queryByRole("button", { name: /Table 1/ })).toBeNull();
    const arrow = screen.getByRole("button", { name: "Open Front tables" });
    expect(arrow).toHaveAttribute("aria-expanded", "false");
    dispatch.mockClear();
    await userEvent.click(arrow);
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close Front tables" })).toHaveAttribute("aria-expanded", "true");
    rerender(<LayoutList layout={layout} selection={["zone-a"]} issues={[]} dispatch={dispatch} storeKey="s" />);
    expect(screen.getByRole("button", { name: /^Front tables/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("a lone zone folds by its arrow and opens again", async () => {
    const one = { ...layout, zones: [zone()] };
    render(<LayoutList layout={one} selection={[]} issues={[]} dispatch={() => {}} storeKey="lone" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Open Front tables" }));
    expect(screen.getByRole("button", { name: /Table 1/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close Front tables" }));
    expect(screen.queryByRole("button", { name: /Table 1/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Open Front tables" }));
    expect(screen.getByRole("button", { name: /Table 1/ })).toBeInTheDocument();
  });

  it("folding the zone that holds the selection works and stays folded", async () => {
    const one = { ...layout, zones: [zone()] };
    render(<LayoutList layout={one} selection={["in"]} issues={[]} dispatch={() => {}} storeKey="lone2" />);
    await userEvent.click(screen.getByRole("button", { name: "Close Front tables" }));
    expect(screen.queryByRole("button", { name: /Table 1/ })).toBeNull();
  });

  describe("runs and table sets", () => {
    const rack = (id: string, name: string, runIndex: number, over = {}) =>
      fixture({ id, name, type: "rack", x: 100 + runIndex * 40, y: 100, zoneId: "zone-a", runId: "run-1", runIndex, ...over });
    const grouped = {
      ...store(),
      zones: [zone(), zone({ id: "zone-b", name: "Back wall", points: [] })],
      fixtures: [
        rack("r2", "Rack 2", 1),
        rack("r1", "Rack 1", 0),
        fixture({ id: "up", name: "Window table", x: 150, y: 150, zoneId: "zone-a" }),
        fixture({ id: "low", name: "Window table, left", x: 100, y: 150, zoneId: "zone-a", tableSetId: "set-1", setSide: "left" }),
      ],
      tableSets: [{ id: "set-1", upperFixtureId: "up", version: 1 }],
    };

    it("a run is a fold inside its zone, titled by its first and last rack, and its row selects all its racks", async () => {
      const dispatch = vi.fn();
      render(<LayoutList layout={grouped} selection={[]} issues={[]} dispatch={dispatch} storeKey="s" />);
      await userEvent.click(screen.getByRole("button", { name: "Open Front tables" }));
      const run = screen.getByRole("region", { name: /Run · Rack 1–Rack 2/ });
      expect(within(run).queryByRole("button", { name: /^Rack 1/ })).toBeNull();
      await userEvent.click(within(run).getByRole("button", { name: /^Run · / }));
      expect(dispatch).toHaveBeenCalledWith({ type: "reveal", id: "r1", ids: ["r1", "r2"] });
      await userEvent.click(within(run).getByRole("button", { name: /Open Run/ }));
      expect(within(run).getAllByRole("button", { name: /^Rack/ }).map((b) => b.textContent)).toEqual(["Rack 1", "Rack 2"]);
    });

    it("a table set is titled by its upper table: the row selects the upper, the lowers sit inside", async () => {
      const dispatch = vi.fn();
      render(<LayoutList layout={grouped} selection={[]} issues={[]} dispatch={dispatch} storeKey="s" />);
      await userEvent.click(screen.getByRole("button", { name: "Open Front tables" }));
      const set = screen.getByRole("region", { name: /Window table/ });
      expect(within(set).queryByRole("button", { name: /left/ })).toBeNull();
      await userEvent.click(within(set).getByRole("button", { name: /^Window table/ }));
      expect(dispatch).toHaveBeenCalledWith({ type: "reveal", id: "up" });
      await userEvent.click(within(set).getByRole("button", { name: /Open Window table/ }));
      expect(within(set).getByRole("button", { name: /left/ })).toBeInTheDocument();
    });

    it("a map selection inside a run inside a zone opens both folds, and a table set's lower opens its fold", () => {
      const { rerender } = render(<LayoutList layout={grouped} selection={[]} issues={[]} dispatch={() => {}} storeKey="s" />);
      expect(screen.queryByRole("button", { name: /^Rack 1/ })).toBeNull();
      rerender(<LayoutList layout={grouped} selection={["r2"]} issues={[]} dispatch={() => {}} storeKey="s" />);
      expect(screen.getByRole("button", { name: /^Rack 2/ })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Close Front tables" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Close Run/ })).toBeInTheDocument();
      rerender(<LayoutList layout={grouped} selection={["low"]} issues={[]} dispatch={() => {}} storeKey="s" />);
      expect(screen.getByRole("button", { name: /^Window table, left/ })).toHaveAttribute("aria-pressed", "true");
    });

    it("a run is selected when all its racks are", () => {
      render(<LayoutList layout={grouped} selection={["r1", "r2"]} issues={[]} dispatch={() => {}} storeKey="s" />);
      expect(screen.getByRole("button", { name: /^Run · / })).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("sorts by name the way people count and drops a type the name already says", () => {
    const racks = { ...store(), fixtures: [fixture({ id: "a", type: "rack", name: "Rack 10" }), fixture({ id: "b", type: "rack", name: "Rack 2" })] };
    render(<LayoutList layout={racks} selection={[]} issues={[]} dispatch={() => {}} storeKey="s" />);
    const names = screen.getAllByRole("button", { name: /^Rack/ }).map((b) => b.textContent);
    expect(names).toEqual(["Rack 2", "Rack 10"]);
  });
});
