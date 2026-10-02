import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { handlesFor, OVERVIEW } from "@/lib/layout/hit-test";
import { entrance, face, fixture, store, zone } from "@/lib/layout/test-layouts";

import { StoreMap } from "./store-map";

const layout = {
  ...store(),
  zones: [zone()],
  fixtures: [fixture({ id: "in", x: 100, y: 100, zoneId: "zone-a" }), fixture({ id: "loose", name: "Table 2", x: 380, y: 100 })],
  faces: [face({ fixtureId: "in" }), face({ id: "f2", fixtureId: "loose" })],
  entrances: [entrance()],
};

const base = {
  layout,
  camera: { x: 0, y: 0, scale: 1 },
  viewport: { width: 800, height: 600 },
  focus: OVERVIEW,
  selection: [] as string[],
  vertex: null,
  issues: [],
  guides: [],
  handles: [],
  drawing: null,
  drawPreview: null,
  marquee: null,
};

describe("StoreMap", () => {
  it("is one labelled image summarising the map", () => {
    render(<StoreMap {...base} />);
    expect(screen.getByRole("img", { name: "Store layout: 1 zone, 2 fixtures, 1 entrance" })).toBeInTheDocument();
  });

  it("draws zones, fixtures and entrances with their ids", () => {
    const { container } = render(<StoreMap {...base} />);
    expect(container.querySelector('[data-zone-name="Front tables"]')).not.toBeNull();
    expect(container.querySelector('[data-fixture-name="Table 2"]')).not.toBeNull();
    expect(container.querySelector('[data-entrance-id="entrance-a"]')).not.toBeNull();
  });

  it("dims fixtures inside zones at the overview", () => {
    const { container } = render(<StoreMap {...base} />);
    expect(container.querySelector('[data-fixture-id="in"]')).toHaveAttribute("opacity", "0.35");
    expect(container.querySelector('[data-fixture-id="loose"]')).toHaveAttribute("opacity", "1");
  });

  it("draws the selected item's handles and marks problems", () => {
    const handles = handlesFor(layout, ["loose"], base.camera);
    const issues = [{ itemId: "loose", kind: "overlap" as const, message: "Blocked by Table 1." }];
    const { container } = render(<StoreMap {...base} selection={["loose"]} handles={handles} issues={issues} />);
    expect(container.querySelectorAll("[data-handle]")).toHaveLength(handles.length);
    expect(container.querySelector('[data-fixture-id="loose"]')).toHaveAttribute("data-problem", "true");
  });
});
