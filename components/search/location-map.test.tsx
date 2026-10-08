import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

// jsdom has no layout: report a phone-sized frame once mounted.
vi.mock("@/components/store-map/use-element-size", () => ({
  useElementSize: (onSize: (v: { width: number; height: number }) => void) => {
    useEffect(() => onSize({ width: 320, height: 176 }), [onSize]);
    return { current: null };
  },
}));

import { fixture, store, zone } from "@/lib/layout/test-layouts";

import { LocationMap, zoneLabelSpot } from "./location-map";

const frame = { width: 320, height: 176 };

describe("zoneLabelSpot", () => {
  it("pulls a name that would run off the edge back inside the frame", () => {
    const spot = zoneLabelSpot({ minX: 200, minY: 0, maxX: 600, maxY: 176 }, { x: 330, y: 90 }, "Stockroom", frame);
    expect(spot).not.toBeNull();
    // About 0.6 em a letter at 13 px, so "Stockroom" needs roughly 35 px either side of its middle.
    expect(spot!.x + 35).toBeLessThanOrEqual(frame.width);
    expect(spot!.y).toBe(90);
  });

  it("keeps a name inside its own zone where the zone is in view", () => {
    const spot = zoneLabelSpot({ minX: -300, minY: 0, maxX: 120, maxY: 176 }, { x: -90, y: 60 }, "Front", frame);
    expect(spot!.x).toBeGreaterThan(0);
    expect(spot!.x).toBeLessThan(120);
  });

  it("leaves out a zone that is out of view or too thin to hold its name", () => {
    expect(zoneLabelSpot({ minX: 400, minY: 0, maxX: 600, maxY: 176 }, { x: 500, y: 90 }, "Stockroom", frame)).toBeNull();
    expect(zoneLabelSpot({ minX: 300, minY: 0, maxX: 330, maxY: 176 }, { x: 315, y: 90 }, "Stockroom", frame)).toBeNull();
  });
});

describe("LocationMap", () => {
  it("fills the product's fixture, not just its outline, and names the zones once", () => {
    const layout = { ...store(), zones: [zone()], fixtures: [fixture({ id: "f1", name: "Table 1", x: 120, y: 90, zoneId: "zone-a" })] };
    const { container } = render(<LocationMap layout={layout} fixtureId="f1" />);
    const highlight = container.querySelector("[data-highlight]");
    expect(highlight).not.toBeNull();
    expect(highlight!.getAttribute("fill")).toBe("var(--brand)");
    expect(highlight!.getAttribute("stroke")).toBe("var(--brand-strong)");
    expect(screen.getAllByText("Front tables")).toHaveLength(1);
    expect(screen.getByText("Table 1, highlighted on the store map")).toBeInTheDocument();
  });
});
